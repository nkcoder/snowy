package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type Datasource struct {
	ID                     string `json:"id"`
	Name                   string `json:"name"`
	Host                   string `json:"host"`
	Port                   int    `json:"port"`
	Database               string `json:"database"`
	Username               string `json:"username"`
	Password               string `json:"password"` // transient: sent by frontend when saving; never persisted
	ProjectID              string `json:"projectId"`
	Env                    string `json:"env"`     // local | dev | stg | prod
	SSLMode                string `json:"sslMode"` // disable | require | verify-ca | verify-full
	NeedsKeychainMigration bool   `json:"needsKeychainMigration,omitempty"` // true when a legacy plaintext password exists in config.json
}

// datasourceRecord is the on-disk JSON shape. It carries the legacy plaintext
// password field so we can detect and preserve it during migration.
type datasourceRecord struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Host           string `json:"host"`
	Port           int    `json:"port"`
	Database       string `json:"database"`
	Username       string `json:"username"`
	LegacyPassword string `json:"password,omitempty"`
	ProjectID      string `json:"projectId"`
	Env            string `json:"env"`
	SSLMode        string `json:"sslMode"`
}

type Project struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Config struct {
	Projects    []Project    `json:"projects"`
	Datasources []Datasource `json:"datasources"`
	Theme       string       `json:"theme,omitempty"` // "dark" | "light"; empty means dark (default)
}

// configFile mirrors Config but uses datasourceRecord for I/O.
type configFile struct {
	Projects    []Project          `json:"projects"`
	Datasources []datasourceRecord `json:"datasources"`
	Theme       string             `json:"theme,omitempty"`
}

type ConfigManager struct {
	configPath      string
	mu              sync.RWMutex
	keyring         KeyringStore
	legacyPasswords map[string]string // dsID → plaintext; in-memory only until migrated
	legacyMu        sync.Mutex
}

func NewConfigManager() (*ConfigManager, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	configDir := filepath.Join(home, ".snowy")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, err
	}
	configPath := filepath.Join(configDir, "config.json")

	cm := &ConfigManager{
		configPath:      configPath,
		keyring:         systemKeyring{},
		legacyPasswords: map[string]string{},
	}

	// Create default config if not exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		defaultConfig := Config{
			Projects:    []Project{{ID: "default", Name: "Default Project"}},
			Datasources: []Datasource{},
		}
		if err := cm.SaveConfig(defaultConfig); err != nil {
			return nil, err
		}
	}

	return cm, nil
}

func (cm *ConfigManager) LoadConfig() (Config, error) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	data, err := os.ReadFile(cm.configPath)
	if err != nil {
		return Config{}, err
	}

	var raw configFile
	if err := json.Unmarshal(data, &raw); err != nil {
		return Config{}, err
	}

	datasources := make([]Datasource, len(raw.Datasources))
	for i, rec := range raw.Datasources {
		ds := Datasource{
			ID:        rec.ID,
			Name:      rec.Name,
			Host:      rec.Host,
			Port:      rec.Port,
			Database:  rec.Database,
			Username:  rec.Username,
			ProjectID: rec.ProjectID,
			Env:       rec.Env,
			SSLMode:   rec.SSLMode,
		}
		if rec.LegacyPassword != "" {
			// Check whether this datasource already has a Keychain entry.
			_, kerr := cm.keyring.Get(keychainService, rec.ID)
			if kerr != nil {
				// No keychain entry yet — flag for migration and hold the legacy password in memory.
				ds.NeedsKeychainMigration = true
				cm.legacyMu.Lock()
				cm.legacyPasswords[rec.ID] = rec.LegacyPassword
				cm.legacyMu.Unlock()
			}
			// Either way, never expose the plaintext to callers.
		}
		datasources[i] = ds
	}

	return Config{
		Projects:    raw.Projects,
		Datasources: datasources,
		Theme:       raw.Theme,
	}, nil
}

func (cm *ConfigManager) SaveConfig(config Config) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	// Read existing records so we can detect removed datasources.
	var existing configFile
	if data, err := os.ReadFile(cm.configPath); err == nil {
		_ = json.Unmarshal(data, &existing)
	}

	// Build a set of incoming IDs to detect removals.
	incoming := make(map[string]bool, len(config.Datasources))
	for _, ds := range config.Datasources {
		incoming[ds.ID] = true
	}

	// Delete keychain entries for datasources that have been removed.
	for _, rec := range existing.Datasources {
		if !incoming[rec.ID] {
			_ = cm.keyring.Delete(keychainService, rec.ID)
			cm.legacyMu.Lock()
			delete(cm.legacyPasswords, rec.ID)
			cm.legacyMu.Unlock()
		}
	}

	// Convert to on-disk records, preserving legacy passwords for unmigrated datasources.
	records := make([]datasourceRecord, len(config.Datasources))
	for i, ds := range config.Datasources {
		rec := datasourceRecord{
			ID:        ds.ID,
			Name:      ds.Name,
			Host:      ds.Host,
			Port:      ds.Port,
			Database:  ds.Database,
			Username:  ds.Username,
			ProjectID: ds.ProjectID,
			Env:       ds.Env,
			SSLMode:   ds.SSLMode,
		}
		// Preserve legacy plaintext only while migration is still pending.
		cm.legacyMu.Lock()
		rec.LegacyPassword = cm.legacyPasswords[ds.ID]
		cm.legacyMu.Unlock()
		records[i] = rec
	}

	out := configFile{
		Projects:    config.Projects,
		Datasources: records,
		Theme:       config.Theme,
	}
	data, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(cm.configPath, data, 0644)
}

func (cm *ConfigManager) GetConfigPath() string {
	return cm.configPath
}

// UpdateDatasource replaces the datasource with matching ID in config.
// If ds.Password is non-empty, it is stored in the Keychain and the legacy
// plaintext entry (if any) is removed from the in-memory map and config.json.
func (cm *ConfigManager) UpdateDatasource(ds Datasource) error {
	if ds.Password != "" {
		if err := cm.keyring.Set(keychainService, ds.ID, ds.Password); err != nil {
			return fmt.Errorf("keychain write: %w", err)
		}
		cm.legacyMu.Lock()
		delete(cm.legacyPasswords, ds.ID)
		cm.legacyMu.Unlock()
	}

	cm.mu.Lock()
	defer cm.mu.Unlock()

	var raw configFile
	data, err := os.ReadFile(cm.configPath)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	found := false
	for i, rec := range raw.Datasources {
		if rec.ID == ds.ID {
			raw.Datasources[i] = datasourceRecord{
				ID:        ds.ID,
				Name:      ds.Name,
				Host:      ds.Host,
				Port:      ds.Port,
				Database:  ds.Database,
				Username:  ds.Username,
				ProjectID: ds.ProjectID,
				Env:       ds.Env,
				SSLMode:   ds.SSLMode,
				// LegacyPassword intentionally omitted — cleared on migration.
			}
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("datasource %s not found", ds.ID)
	}

	out, err := json.MarshalIndent(raw, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(cm.configPath, out, 0644)
}

// GetDatasourcePassword retrieves the password for dsID from the Keychain.
func (cm *ConfigManager) GetDatasourcePassword(dsID string) (string, error) {
	return cm.keyring.Get(keychainService, dsID)
}

// GetEffectivePassword returns the best available password for dsID:
// the Keychain entry if one exists, otherwise the legacy plaintext held in
// memory for unmigrated datasources.
func (cm *ConfigManager) GetEffectivePassword(dsID string) string {
	if pw, err := cm.keyring.Get(keychainService, dsID); err == nil {
		return pw
	}
	cm.legacyMu.Lock()
	defer cm.legacyMu.Unlock()
	return cm.legacyPasswords[dsID]
}
