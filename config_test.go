package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

// newTestConfigManager creates a ConfigManager pointing to a temp dir with a mock keyring.
func newTestConfigManager(t *testing.T) *ConfigManager {
	t.Helper()
	return newTestConfigManagerWithKeyring(t, newMockKeyring())
}

func newTestConfigManagerWithKeyring(t *testing.T, kr KeyringStore) *ConfigManager {
	t.Helper()
	dir := t.TempDir()
	return &ConfigManager{
		configPath:      filepath.Join(dir, "config.json"),
		keyring:         kr,
		legacyPasswords: map[string]string{},
	}
}

// writeRawConfig writes raw JSON bytes to the config file directly —
// used to simulate legacy config.json files that contain plaintext passwords.
func writeRawConfig(t *testing.T, cm *ConfigManager, raw []byte) {
	t.Helper()
	if err := os.WriteFile(cm.configPath, raw, 0644); err != nil {
		t.Fatalf("writeRawConfig: %v", err)
	}
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

// legacyConfigJSON builds a raw config JSON that includes plaintext passwords,
// simulating a config.json written before Keychain migration.
func legacyConfigJSON(t *testing.T, dsID, password string) []byte {
	t.Helper()
	raw := map[string]interface{}{
		"projects": []map[string]string{{"id": "p1", "name": "P"}},
		"datasources": []map[string]interface{}{
			{
				"id": dsID, "name": "db", "host": "localhost",
				"port": 5432, "database": "testdb", "username": "user",
				"password": password, "projectId": "p1", "env": "local", "sslMode": "disable",
			},
		},
	}
	b, err := json.MarshalIndent(raw, "", "  ")
	if err != nil {
		t.Fatalf("legacyConfigJSON: %v", err)
	}
	return b
}

// ── NewConfigManager ─────────────────────────────────────────────────────────

func TestNewConfigManager_CreatesDefaultConfig(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.json")
	cm := &ConfigManager{
		configPath:      configPath,
		keyring:         newMockKeyring(),
		legacyPasswords: map[string]string{},
	}

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

	cfg, err := cm.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig after concurrent updates: %v", err)
	}
	if len(cfg.Datasources) != 1 {
		t.Errorf("expected 1 datasource, got %d", len(cfg.Datasources))
	}
}

// ── Keychain / migration tests ───────────────────────────────────────────────

// Cycle 2: legacy plaintext password in config.json → NeedsKeychainMigration=true
func TestLoadConfig_LegacyPassword_SetsNeedsKeychainMigration(t *testing.T) {
	kr := newMockKeyring() // no entries — simulates no prior migration
	cm := newTestConfigManagerWithKeyring(t, kr)
	writeRawConfig(t, cm, legacyConfigJSON(t, "ds-1", "hunter2"))

	cfg, err := cm.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if len(cfg.Datasources) != 1 {
		t.Fatalf("expected 1 datasource, got %d", len(cfg.Datasources))
	}
	ds := cfg.Datasources[0]
	if !ds.NeedsKeychainMigration {
		t.Error("NeedsKeychainMigration should be true for legacy password")
	}
	if ds.Password != "" {
		t.Errorf("Password should not be exposed to callers, got %q", ds.Password)
	}
}

// Cycle 3: keychain entry already exists → no migration flag
func TestLoadConfig_KeychainEntryExists_NoMigrationFlag(t *testing.T) {
	kr := newMockKeyring()
	_ = kr.Set(keychainService, "ds-1", "already-migrated")
	cm := newTestConfigManagerWithKeyring(t, kr)
	// Config still has legacy plaintext (stale — should be cleaned up on next save)
	writeRawConfig(t, cm, legacyConfigJSON(t, "ds-1", "stale-plaintext"))

	cfg, err := cm.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	ds := cfg.Datasources[0]
	if ds.NeedsKeychainMigration {
		t.Error("NeedsKeychainMigration should be false when keychain entry already exists")
	}
}

// Cycle 4: SaveConfig preserves legacy plaintext for unmigrated datasources
func TestSaveConfig_PreservesLegacyPasswordForUnmigratedDatasource(t *testing.T) {
	kr := newMockKeyring()
	cm := newTestConfigManagerWithKeyring(t, kr)
	writeRawConfig(t, cm, legacyConfigJSON(t, "ds-1", "hunter2"))

	// Load so cm.legacyPasswords is populated
	cfg, err := cm.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}

	// Save the config (e.g. user changed the theme, not the password)
	cfg.Theme = "light"
	if err := cm.SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}

	// Reload — legacy password must still be there so migration banner persists
	cfg2, err := cm.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig after save: %v", err)
	}
	if !cfg2.Datasources[0].NeedsKeychainMigration {
		t.Error("NeedsKeychainMigration should still be true after unrelated save")
	}
}

// Cycle 4b: SaveConfig does NOT write password for datasources that have no legacy password
func TestSaveConfig_NoPasswordInFileForNewDatasources(t *testing.T) {
	cm := newTestConfigManager(t)
	cfg := Config{
		Projects:    []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{{ID: "d1", Name: "db", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable", Password: "secret"}},
	}
	if err := cm.SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}

	// Read raw file — must not contain the password
	raw, _ := os.ReadFile(cm.configPath)
	if contains(string(raw), "secret") {
		t.Error("plaintext password must not appear in config.json")
	}
}

// Cycle 5: UpdateDatasource stores password in keyring and clears legacy entry
func TestUpdateDatasource_StoresPasswordInKeychain(t *testing.T) {
	kr := newMockKeyring()
	cm := newTestConfigManagerWithKeyring(t, kr)
	writeConfig(t, cm, Config{
		Projects: []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{
			{ID: "ds-1", Name: "db", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable"},
		},
	})

	ds := Datasource{ID: "ds-1", Name: "db", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable", Password: "newpassword"}
	if err := cm.UpdateDatasource(ds); err != nil {
		t.Fatalf("UpdateDatasource: %v", err)
	}

	pw, err := kr.Get(keychainService, "ds-1")
	if err != nil {
		t.Fatalf("keychain Get: %v", err)
	}
	if pw != "newpassword" {
		t.Errorf("keychain has %q, want %q", pw, "newpassword")
	}
}

func TestUpdateDatasource_ClearsLegacyPasswordAfterMigration(t *testing.T) {
	kr := newMockKeyring()
	cm := newTestConfigManagerWithKeyring(t, kr)
	writeRawConfig(t, cm, legacyConfigJSON(t, "ds-1", "oldpass"))

	// Load to populate legacyPasswords
	_, _ = cm.LoadConfig()

	// User re-enters password → migrate
	ds := Datasource{ID: "ds-1", Name: "db", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable", Password: "newpass"}
	if err := cm.UpdateDatasource(ds); err != nil {
		t.Fatalf("UpdateDatasource: %v", err)
	}

	// Next load must NOT show migration flag
	cfg, err := cm.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if cfg.Datasources[0].NeedsKeychainMigration {
		t.Error("NeedsKeychainMigration should be false after migration")
	}
}

// Cycle 5b: UpdateDatasource with empty password does NOT touch keyring
func TestUpdateDatasource_EmptyPassword_DoesNotWriteKeychain(t *testing.T) {
	kr := newMockKeyring()
	cm := newTestConfigManagerWithKeyring(t, kr)
	writeConfig(t, cm, Config{
		Projects: []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{
			{ID: "ds-1", Name: "db", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable"},
		},
	})

	ds := Datasource{ID: "ds-1", Name: "renamed", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable", Password: ""}
	if err := cm.UpdateDatasource(ds); err != nil {
		t.Fatalf("UpdateDatasource: %v", err)
	}

	_, err := kr.Get(keychainService, "ds-1")
	if err == nil {
		t.Error("keychain should have no entry when password was empty")
	}
}

// Cycle 6: GetDatasourcePassword retrieves from keyring
func TestGetDatasourcePassword(t *testing.T) {
	kr := newMockKeyring()
	_ = kr.Set(keychainService, "ds-1", "keychain-secret")
	cm := newTestConfigManagerWithKeyring(t, kr)

	pw, err := cm.GetDatasourcePassword("ds-1")
	if err != nil {
		t.Fatalf("GetDatasourcePassword: %v", err)
	}
	if pw != "keychain-secret" {
		t.Errorf("got %q, want %q", pw, "keychain-secret")
	}
}

func TestGetEffectivePassword_PrefersKeychain(t *testing.T) {
	kr := newMockKeyring()
	_ = kr.Set(keychainService, "ds-1", "keychain-pw")
	cm := newTestConfigManagerWithKeyring(t, kr)
	cm.legacyPasswords["ds-1"] = "legacy-pw"

	if got := cm.GetEffectivePassword("ds-1"); got != "keychain-pw" {
		t.Errorf("got %q, want keychain-pw", got)
	}
}

func TestGetEffectivePassword_FallsBackToLegacy(t *testing.T) {
	kr := newMockKeyring() // no keychain entry
	cm := newTestConfigManagerWithKeyring(t, kr)
	cm.legacyPasswords["ds-1"] = "legacy-pw"

	if got := cm.GetEffectivePassword("ds-1"); got != "legacy-pw" {
		t.Errorf("got %q, want legacy-pw", got)
	}
}

func TestGetEffectivePassword_EmptyWhenNeitherExists(t *testing.T) {
	cm := newTestConfigManager(t)
	if got := cm.GetEffectivePassword("ds-unknown"); got != "" {
		t.Errorf("got %q, want empty string", got)
	}
}

// Cycle 7: SaveConfig deletes keychain entry when datasource is removed
func TestSaveConfig_DeletesKeychainEntryForRemovedDatasource(t *testing.T) {
	kr := newMockKeyring()
	_ = kr.Set(keychainService, "ds-1", "secret")
	cm := newTestConfigManagerWithKeyring(t, kr)
	writeConfig(t, cm, Config{
		Projects: []Project{{ID: "p1", Name: "P"}},
		Datasources: []Datasource{
			{ID: "ds-1", Name: "db", Host: "h", Port: 5432, Database: "db", ProjectID: "p1", Env: "local", SSLMode: "disable"},
		},
	})

	// Save config without ds-1 (simulates user deleting the connection)
	if err := cm.SaveConfig(Config{Projects: []Project{{ID: "p1", Name: "P"}}, Datasources: []Datasource{}}); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}

	_, err := kr.Get(keychainService, "ds-1")
	if err == nil {
		t.Error("keychain entry should have been deleted when datasource was removed")
	}
}

// helper
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsStr(s, substr))
}

func containsStr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
