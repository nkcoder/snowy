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
	Password  string `json:"password"` // Plain text for now; keychain integration planned
	ProjectID string `json:"projectId"`
	Env       string `json:"env"`     // local | dev | stg | prod
	SSLMode   string `json:"sslMode"` // disable | require | verify-ca | verify-full
}

type Project struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Config struct {
	Projects    []Project    `json:"projects"`
	Datasources []Datasource `json:"datasources"`
}

type ConfigManager struct {
	configPath string
	mu         sync.RWMutex
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

	cm := &ConfigManager{configPath: configPath}

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

	var config Config
	data, err := os.ReadFile(cm.configPath)
	if err != nil {
		return config, err
	}

	if err := json.Unmarshal(data, &config); err != nil {
		return config, err
	}

	return config, nil
}

func (cm *ConfigManager) SaveConfig(config Config) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(cm.configPath, data, 0644)
}

func (cm *ConfigManager) GetConfigPath() string {
	return cm.configPath
}

// UpdateDatasource replaces the datasource with matching ID in config.
func (cm *ConfigManager) UpdateDatasource(ds Datasource) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	var config Config
	data, err := os.ReadFile(cm.configPath)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, &config); err != nil {
		return err
	}

	found := false
	for i, d := range config.Datasources {
		if d.ID == ds.ID {
			config.Datasources[i] = ds
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("datasource %s not found", ds.ID)
	}

	out, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(cm.configPath, out, 0644)
}
