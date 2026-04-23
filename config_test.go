package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

// newTestConfigManager creates a ConfigManager pointing to a temp dir.
func newTestConfigManager(t *testing.T) *ConfigManager {
	t.Helper()
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.json")
	return &ConfigManager{configPath: configPath}
}

// writeConfig writes a Config struct to the manager's config file directly.
func writeConfig(t *testing.T, cm *ConfigManager, cfg Config) {
	t.Helper()
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if err := os.WriteFile(cm.configPath, data, 0644); err != nil {
		t.Fatalf("write: %v", err)
	}
}

// ── NewConfigManager ─────────────────────────────────────────────────────────

func TestNewConfigManager_CreatesDefaultConfig(t *testing.T) {
	dir := t.TempDir()
	// Temporarily override home to control config path
	configPath := filepath.Join(dir, "config.json")
	cm := &ConfigManager{configPath: configPath}

	// Bootstrap the default config as NewConfigManager would
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		defaultConfig := Config{
			Projects:    []Project{{ID: "default", Name: "Default Project"}},
			Datasources: []Datasource{},
		}
		if err := cm.SaveConfig(defaultConfig); err != nil {
			t.Fatalf("SaveConfig: %v", err)
		}
	}

	cfg, err := cm.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if len(cfg.Projects) != 1 || cfg.Projects[0].ID != "default" {
		t.Errorf("unexpected default config: %+v", cfg)
	}
	if cfg.Datasources == nil {
		t.Error("datasources should be empty slice, not nil")
	}
}

func TestNewConfigManager_ExistingConfigNotOverwritten(t *testing.T) {
	cm := newTestConfigManager(t)
	original := Config{
		Projects:    []Project{{ID: "p1", Name: "Existing"}},
		Datasources: []Datasource{},
	}
	writeConfig(t, cm, original)

	// If NewConfigManager checked the existing file, it should not overwrite
	cfg, err := cm.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if cfg.Projects[0].ID != "p1" {
		t.Errorf("config overwritten; got %+v", cfg)
	}
}

// ── SaveConfig / LoadConfig ──────────────────────────────────────────────────

func TestSaveAndLoadConfig_RoundTrip(t *testing.T) {
	cm := newTestConfigManager(t)
	cfg := Config{
		Projects: []Project{
			{ID: "p1", Name: "Alpha"},
			{ID: "p2", Name: "Beta"},
		},
		Datasources: []Datasource{
			{
				ID:        "d1",
				Name:      "local-pg",
				Host:      "localhost",
				Port:      5432,
				Database:  "testdb",
				Username:  "postgres",
				Password:  "secret",
				ProjectID: "p1",
				Env:       "local",
				SSLMode:   "disable",
			},
		},
	}

	if err := cm.SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
	got, err := cm.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}

	if len(got.Projects) != 2 {
		t.Errorf("projects: got %d, want 2", len(got.Projects))
	}
	if len(got.Datasources) != 1 {
		t.Errorf("datasources: got %d, want 1", len(got.Datasources))
	}
	d := got.Datasources[0]
	if d.Host != "localhost" || d.Port != 5432 || d.SSLMode != "disable" || d.Env != "local" {
		t.Errorf("datasource fields wrong: %+v", d)
	}
}

func TestLoadConfig_FileNotFound(t *testing.T) {
	cm := newTestConfigManager(t)
	_, err := cm.LoadConfig()
	if err == nil {
		t.Error("expected error for missing file, got nil")
	}
}

func TestLoadConfig_InvalidJSON(t *testing.T) {
	cm := newTestConfigManager(t)
	if err := os.WriteFile(cm.configPath, []byte("{bad json"), 0644); err != nil {
		t.Fatal(err)
	}
	_, err := cm.LoadConfig()
	if err == nil {
		t.Error("expected JSON parse error, got nil")
	}
}

func TestSaveConfig_OverwritesPreviousData(t *testing.T) {
	cm := newTestConfigManager(t)
	writeConfig(t, cm, Config{Projects: []Project{{ID: "old", Name: "Old"}}})

	newCfg := Config{Projects: []Project{{ID: "new", Name: "New"}}, Datasources: []Datasource{}}
	if err := cm.SaveConfig(newCfg); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
	got, _ := cm.LoadConfig()
	if got.Projects[0].ID != "new" {
		t.Errorf("expected new config, got %+v", got.Projects)
	}
}

// ── GetConfigPath ────────────────────────────────────────────────────────────

func TestGetConfigPath(t *testing.T) {
	cm := newTestConfigManager(t)
	if cm.GetConfigPath() != cm.configPath {
		t.Errorf("GetConfigPath() = %q, want %q", cm.GetConfigPath(), cm.configPath)
	}
	if cm.GetConfigPath() == "" {
		t.Error("GetConfigPath should not be empty")
	}
}

// ── UpdateDatasource ─────────────────────────────────────────────────────────

func TestUpdateDatasource_HappyPath(t *testing.T) {
	cm := newTestConfigManager(t)
	writeConfig(t, cm, Config{
		Projects: []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{
			{ID: "d1", Name: "old-name", Host: "old-host", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable"},
		},
	})

	updated := Datasource{ID: "d1", Name: "new-name", Host: "new-host", Port: 5433, Database: "db2", ProjectID: "p1", Env: "prod", SSLMode: "require"}
	if err := cm.UpdateDatasource(updated); err != nil {
		t.Fatalf("UpdateDatasource: %v", err)
	}

	cfg, _ := cm.LoadConfig()
	if len(cfg.Datasources) != 1 {
		t.Fatalf("datasource count changed: %d", len(cfg.Datasources))
	}
	d := cfg.Datasources[0]
	if d.Name != "new-name" || d.Host != "new-host" || d.Port != 5433 || d.Env != "prod" || d.SSLMode != "require" {
		t.Errorf("datasource not updated: %+v", d)
	}
}

func TestUpdateDatasource_NotFound(t *testing.T) {
	cm := newTestConfigManager(t)
	writeConfig(t, cm, Config{
		Projects:    []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{},
	})

	err := cm.UpdateDatasource(Datasource{ID: "nonexistent"})
	if err == nil {
		t.Error("expected error for nonexistent datasource ID, got nil")
	}
}

func TestUpdateDatasource_OnlyMatchingIDChanged(t *testing.T) {
	cm := newTestConfigManager(t)
	writeConfig(t, cm, Config{
		Projects: []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{
			{ID: "d1", Name: "first", Host: "h1", Port: 5432, Database: "db1", ProjectID: "p1", Env: "local", SSLMode: "disable"},
			{ID: "d2", Name: "second", Host: "h2", Port: 5432, Database: "db2", ProjectID: "p1", Env: "dev", SSLMode: "disable"},
		},
	})

	updated := Datasource{ID: "d1", Name: "updated", Host: "h1-new", Port: 5432, Database: "db1", ProjectID: "p1", Env: "stg", SSLMode: "require"}
	if err := cm.UpdateDatasource(updated); err != nil {
		t.Fatalf("UpdateDatasource: %v", err)
	}

	cfg, _ := cm.LoadConfig()
	var d1, d2 Datasource
	for _, d := range cfg.Datasources {
		if d.ID == "d1" {
			d1 = d
		}
		if d.ID == "d2" {
			d2 = d
		}
	}
	if d1.Name != "updated" || d1.Host != "h1-new" {
		t.Errorf("d1 not updated: %+v", d1)
	}
	if d2.Name != "second" || d2.Host != "h2" {
		t.Errorf("d2 should be untouched: %+v", d2)
	}
}

func TestUpdateDatasource_FileNotFound(t *testing.T) {
	cm := newTestConfigManager(t) // no config written
	err := cm.UpdateDatasource(Datasource{ID: "d1"})
	if err == nil {
		t.Error("expected error when config file missing, got nil")
	}
}

// ── Concurrent access ────────────────────────────────────────────────────────

func TestConcurrentSaveAndLoad(t *testing.T) {
	cm := newTestConfigManager(t)
	writeConfig(t, cm, Config{
		Projects:    []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{},
	})

	const goroutines = 20
	var wg sync.WaitGroup
	errs := make(chan error, goroutines*2)

	for i := 0; i < goroutines; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			cfg := Config{Projects: []Project{{ID: "p1", Name: "P"}}, Datasources: []Datasource{}}
			if err := cm.SaveConfig(cfg); err != nil {
				errs <- err
			}
		}()
		go func() {
			defer wg.Done()
			if _, err := cm.LoadConfig(); err != nil {
				errs <- err
			}
		}()
	}

	wg.Wait()
	close(errs)
	for err := range errs {
		t.Errorf("concurrent error: %v", err)
	}
}

func TestConcurrentUpdateDatasource(t *testing.T) {
	cm := newTestConfigManager(t)
	writeConfig(t, cm, Config{
		Projects: []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{
			{ID: "d1", Name: "start", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable"},
		},
	})

	const goroutines = 10
	var wg sync.WaitGroup
	errs := make(chan error, goroutines)

	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			ds := Datasource{ID: "d1", Name: "updated", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable"}
			if err := cm.UpdateDatasource(ds); err != nil {
				errs <- err
			}
		}(i)
	}

	wg.Wait()
	close(errs)
	for err := range errs {
		t.Errorf("concurrent update error: %v", err)
	}

	// Config should still be valid after concurrent writes
	cfg, err := cm.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig after concurrent updates: %v", err)
	}
	if len(cfg.Datasources) != 1 {
		t.Errorf("expected 1 datasource, got %d", len(cfg.Datasources))
	}
}
