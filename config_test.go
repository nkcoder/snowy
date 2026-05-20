package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func newTestConfigManager(t *testing.T) *ConfigManager {
	t.Helper()
	return newTestConfigManagerWithKeyring(t, newMockKeyring())
}

func newTestConfigManagerWithKeyring(t *testing.T, kr KeyringStore) *ConfigManager {
	t.Helper()
	dir := t.TempDir()
	return &ConfigManager{
		configPath: filepath.Join(dir, "config.json"),
		keyring:    kr,
	}
}

// writeConfig writes a Config struct directly to the config file.
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

// ── NewConfigManager ──────────────────────────────────────────────────────────

func TestNewConfigManager_CreatesDefaultConfig(t *testing.T) {
	dir := t.TempDir()
	cm := &ConfigManager{
		configPath: filepath.Join(dir, "config.json"),
		keyring:    newMockKeyring(),
	}

	if _, err := os.Stat(cm.configPath); os.IsNotExist(err) {
		if err := cm.SaveConfig(Config{
			Projects:    []Project{{ID: "default", Name: "Default Project"}},
			Datasources: []Datasource{},
		}); err != nil {
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
	writeConfig(t, cm, Config{
		Projects:    []Project{{ID: "p1", Name: "Existing"}},
		Datasources: []Datasource{},
	})

	cfg, err := cm.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if cfg.Projects[0].ID != "p1" {
		t.Errorf("config overwritten; got %+v", cfg)
	}
}

// ── SaveConfig / LoadConfig ───────────────────────────────────────────────────

func TestSaveAndLoadConfig_RoundTrip(t *testing.T) {
	cm := newTestConfigManager(t)
	cfg := Config{
		Projects:    []Project{{ID: "p1", Name: "Alpha"}, {ID: "p2", Name: "Beta"}},
		Datasources: []Datasource{{ID: "d1", Name: "local-pg", Host: "localhost", Port: 5432, Database: "testdb", Username: "postgres", ProjectID: "p1", Env: "local", SSLMode: "disable"}},
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
		t.Fatalf("datasources: got %d, want 1", len(got.Datasources))
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
	_ = os.WriteFile(cm.configPath, []byte("{bad json"), 0644)
	if _, err := cm.LoadConfig(); err == nil {
		t.Error("expected JSON parse error, got nil")
	}
}

func TestSaveConfig_PasswordNeverWrittenToDisk(t *testing.T) {
	cm := newTestConfigManager(t)
	cfg := Config{
		Projects:    []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{{ID: "d1", Name: "db", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable", Password: "secret"}},
	}
	if err := cm.SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
	raw, _ := os.ReadFile(cm.configPath)
	if strings.Contains(string(raw), "secret") {
		t.Error("plaintext password must not appear in config.json")
	}
}

func TestSaveConfig_OverwritesPreviousData(t *testing.T) {
	cm := newTestConfigManager(t)
	writeConfig(t, cm, Config{Projects: []Project{{ID: "old", Name: "Old"}}})
	if err := cm.SaveConfig(Config{Projects: []Project{{ID: "new", Name: "New"}}, Datasources: []Datasource{}}); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
	got, _ := cm.LoadConfig()
	if got.Projects[0].ID != "new" {
		t.Errorf("expected new config, got %+v", got.Projects)
	}
}

// ── GetConfigPath ─────────────────────────────────────────────────────────────

func TestGetConfigPath(t *testing.T) {
	cm := newTestConfigManager(t)
	if cm.GetConfigPath() != cm.configPath || cm.GetConfigPath() == "" {
		t.Errorf("GetConfigPath() = %q", cm.GetConfigPath())
	}
}

// ── UpdateDatasource ──────────────────────────────────────────────────────────

func TestUpdateDatasource_HappyPath(t *testing.T) {
	cm := newTestConfigManager(t)
	writeConfig(t, cm, Config{
		Projects:    []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{{ID: "d1", Name: "old-name", Host: "old-host", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable"}},
	})

	if err := cm.UpdateDatasource(Datasource{ID: "d1", Name: "new-name", Host: "new-host", Port: 5433, Database: "db2", ProjectID: "p1", Env: "prod", SSLMode: "require"}); err != nil {
		t.Fatalf("UpdateDatasource: %v", err)
	}
	cfg, _ := cm.LoadConfig()
	d := cfg.Datasources[0]
	if d.Name != "new-name" || d.Host != "new-host" || d.Port != 5433 || d.Env != "prod" || d.SSLMode != "require" {
		t.Errorf("datasource not updated: %+v", d)
	}
}

func TestUpdateDatasource_StoresPasswordInKeychain(t *testing.T) {
	kr := newMockKeyring()
	cm := newTestConfigManagerWithKeyring(t, kr)
	writeConfig(t, cm, Config{
		Projects:    []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{{ID: "ds-1", Name: "db", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable"}},
	})

	if err := cm.UpdateDatasource(Datasource{ID: "ds-1", Name: "db", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable", Password: "newpassword"}); err != nil {
		t.Fatalf("UpdateDatasource: %v", err)
	}
	pw, err := kr.Get(keychainService, "ds-1")
	if err != nil || pw != "newpassword" {
		t.Errorf("keychain: got %q, err %v", pw, err)
	}
}

func TestUpdateDatasource_EmptyPassword_DoesNotWriteKeychain(t *testing.T) {
	kr := newMockKeyring()
	cm := newTestConfigManagerWithKeyring(t, kr)
	writeConfig(t, cm, Config{
		Projects:    []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{{ID: "ds-1", Name: "db", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable"}},
	})

	_ = cm.UpdateDatasource(Datasource{ID: "ds-1", Name: "renamed", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable"})
	if _, err := kr.Get(keychainService, "ds-1"); err == nil {
		t.Error("keychain should have no entry when password was empty")
	}
}

func TestUpdateDatasource_NotFound(t *testing.T) {
	cm := newTestConfigManager(t)
	writeConfig(t, cm, Config{Projects: []Project{{ID: "p1", Name: "P"}}, Datasources: []Datasource{}})
	if err := cm.UpdateDatasource(Datasource{ID: "nonexistent"}); err == nil {
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

	_ = cm.UpdateDatasource(Datasource{ID: "d1", Name: "updated", Host: "h1-new", Port: 5432, Database: "db1", ProjectID: "p1", Env: "stg", SSLMode: "require"})

	cfg, _ := cm.LoadConfig()
	var d1, d2 Datasource
	for _, d := range cfg.Datasources {
		if d.ID == "d1" {
			d1 = d
		} else {
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
	cm := newTestConfigManager(t)
	if err := cm.UpdateDatasource(Datasource{ID: "d1"}); err == nil {
		t.Error("expected error when config file missing, got nil")
	}
}

// ── GetDatasourcePassword ─────────────────────────────────────────────────────

func TestGetDatasourcePassword(t *testing.T) {
	kr := newMockKeyring()
	_ = kr.Set(keychainService, "ds-1", "keychain-secret")
	cm := newTestConfigManagerWithKeyring(t, kr)

	pw, err := cm.GetDatasourcePassword("ds-1")
	if err != nil || pw != "keychain-secret" {
		t.Errorf("got %q, err %v", pw, err)
	}
}

func TestGetDatasourcePassword_MissingEntry(t *testing.T) {
	cm := newTestConfigManager(t)
	pw, err := cm.GetDatasourcePassword("unknown")
	if err == nil {
		t.Error("expected error for missing entry")
	}
	if pw != "" {
		t.Errorf("expected empty password, got %q", pw)
	}
}

// ── SaveConfig removes keychain entry for deleted datasources ─────────────────

func TestSaveConfig_DeletesKeychainEntryForRemovedDatasource(t *testing.T) {
	kr := newMockKeyring()
	_ = kr.Set(keychainService, "ds-1", "secret")
	cm := newTestConfigManagerWithKeyring(t, kr)
	writeConfig(t, cm, Config{
		Projects:    []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{{ID: "ds-1", Name: "db", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable"}},
	})

	_ = cm.SaveConfig(Config{Projects: []Project{{ID: "p1", Name: "P"}}, Datasources: []Datasource{}})

	if _, err := kr.Get(keychainService, "ds-1"); err == nil {
		t.Error("keychain entry should have been deleted with the datasource")
	}
}

// ── Concurrent access ─────────────────────────────────────────────────────────

func TestConcurrentSaveAndLoad(t *testing.T) {
	cm := newTestConfigManager(t)
	writeConfig(t, cm, Config{Projects: []Project{{ID: "p1", Name: "P"}}, Datasources: []Datasource{}})

	var wg sync.WaitGroup
	errs := make(chan error, 40)
	for i := 0; i < 20; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			if err := cm.SaveConfig(Config{Projects: []Project{{ID: "p1", Name: "P"}}, Datasources: []Datasource{}}); err != nil {
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
		Projects:    []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{{ID: "d1", Name: "start", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable"}},
	})

	var wg sync.WaitGroup
	errs := make(chan error, 10)
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := cm.UpdateDatasource(Datasource{ID: "d1", Name: "updated", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable"}); err != nil {
				errs <- err
			}
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Errorf("concurrent update error: %v", err)
	}
	cfg, err := cm.LoadConfig()
	if err != nil || len(cfg.Datasources) != 1 {
		t.Errorf("unexpected state after concurrent updates: err=%v, ds=%d", err, len(cfg.Datasources))
	}
}

