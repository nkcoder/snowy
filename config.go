package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type Datasource struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Host      string `json:"host"`
	Port      int    `json:"port"`
	Database  string `json:"database"`
	Username  string `json:"username"`
	Password  string `json:"password,omitempty"` // transient: sent by frontend when saving; never written to disk
	ProjectID string `json:"projectId"`
	Env       string `json:"env"`     // local | dev | stg | prod
	SSLMode   string `json:"sslMode"` // disable | require | verify-ca | verify-full
}

// datasourceRecord is the on-disk shape — no password field.
type datasourceRecord struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Host      string `json:"host"`
	Port      int    `json:"port"`
	Database  string `json:"database"`
	Username  string `json:"username"`
	ProjectID string `json:"projectId"`
	Env       string `json:"env"`
	SSLMode   string `json:"sslMode"`
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

type configFile struct {
	Projects    []Project          `json:"projects"`
	Datasources []datasourceRecord `json:"datasources"`
	Theme       string             `json:"theme,omitempty"`
}

type ConfigManager struct {
	configPath string
	mu         sync.RWMutex
	keyring    KeyringStore
	// notify, if set, surfaces non-fatal warnings to the user (e.g. a failed
	// Keychain cleanup that does not block the primary operation).
	// level is "warning" or "error".
	notify func(level, message string)
}

func (cm *ConfigManager) warn(format string, args ...any) {
	if cm.notify != nil {
		cm.notify("warning", fmt.Sprintf(format, args...))
	}
}

func NewConfigManager() (*ConfigManager, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	configDir := filepath.Join(home, ".snowy")
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return nil, err
	}
	configPath := filepath.Join(configDir, "config.json")

	cm := &ConfigManager{configPath: configPath, keyring: systemKeyring{}}

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
		datasources[i] = Datasource{
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
	}

	return Config{Projects: raw.Projects, Datasources: datasources, Theme: raw.Theme}, nil
}

// SaveConfig writes the full config and syncs the Keychain.
//
// Ordering: file is written first. If the file write fails, no Keychain change
// is made (consistent state). If the file write succeeds but a Keychain write
// fails, the connection exists in the file but its password is missing — the
// user sees a clear error and can recover by re-saving from the editor.
//
// Keychain cleanup of removed datasources is non-fatal: an orphaned Keychain
// entry is harmless. Cleanup failures are surfaced via the notify callback.
func (cm *ConfigManager) SaveConfig(config Config) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	// Snapshot the previous file so we can diff for removed datasources later.
	var existing configFile
	if data, err := os.ReadFile(cm.configPath); err == nil {
		_ = json.Unmarshal(data, &existing)
	}
	incoming := make(map[string]bool, len(config.Datasources))
	for _, ds := range config.Datasources {
		incoming[ds.ID] = true
	}

	// Build on-disk records (passwords stripped).
	records := make([]datasourceRecord, len(config.Datasources))
	for i, ds := range config.Datasources {
		records[i] = datasourceRecord{
			ID: ds.ID, Name: ds.Name, Host: ds.Host, Port: ds.Port,
			Database: ds.Database, Username: ds.Username, ProjectID: ds.ProjectID,
			Env: ds.Env, SSLMode: ds.SSLMode,
		}
	}

	// 1. Write the file. If this fails the Keychain remains untouched.
	out := configFile{Projects: config.Projects, Datasources: records, Theme: config.Theme}
	data, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return fmt.Errorf("encode config: %w", err)
	}
	if err := os.WriteFile(cm.configPath, data, 0600); err != nil {
		return fmt.Errorf("write config file: %w", err)
	}

	// 2. Store any non-empty passwords in the Keychain (fatal — these are the
	// credentials needed to connect).
	for _, ds := range config.Datasources {
		if ds.Password == "" {
			continue
		}
		if err := cm.keyring.Set(keychainService, ds.ID, ds.Password); err != nil {
			return fmt.Errorf("connection %q saved but password could not be stored in macOS Keychain: %w", ds.Name, err)
		}
	}

	// 3. Clean up Keychain entries for removed datasources (non-fatal).
	for _, rec := range existing.Datasources {
		if !incoming[rec.ID] {
			if err := cm.keyring.Delete(keychainService, rec.ID); err != nil {
				cm.warn("Could not remove Keychain entry for deleted connection %q: %v", rec.Name, err)
			}
		}
	}
	return nil
}

func (cm *ConfigManager) GetConfigPath() string {
	return cm.configPath
}

// UpdateDatasource replaces the datasource with matching ID in config.
// File write happens first; the Keychain write follows. If the Keychain write
// fails after the file write succeeds, the user sees a clear error and can
// recover by re-saving from the editor.
func (cm *ConfigManager) UpdateDatasource(ds Datasource) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	data, err := os.ReadFile(cm.configPath)
	if err != nil {
		return fmt.Errorf("read config file: %w", err)
	}
	var raw configFile
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("parse config file: %w", err)
	}

	found := false
	for i, rec := range raw.Datasources {
		if rec.ID == ds.ID {
			raw.Datasources[i] = datasourceRecord{
				ID: ds.ID, Name: ds.Name, Host: ds.Host, Port: ds.Port,
				Database: ds.Database, Username: ds.Username, ProjectID: ds.ProjectID,
				Env: ds.Env, SSLMode: ds.SSLMode,
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
		return fmt.Errorf("encode config: %w", err)
	}
	if err := os.WriteFile(cm.configPath, out, 0600); err != nil {
		return fmt.Errorf("write config file: %w", err)
	}

	if ds.Password != "" {
		if err := cm.keyring.Set(keychainService, ds.ID, ds.Password); err != nil {
			return fmt.Errorf("connection saved but password could not be stored in macOS Keychain: %w", err)
		}
	}
	return nil
}

// GetDatasourcePassword retrieves the password for dsID from the Keychain.
func (cm *ConfigManager) GetDatasourcePassword(dsID string) (string, error) {
	return cm.keyring.Get(keychainService, dsID)
}
