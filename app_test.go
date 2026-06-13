package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func newAppForTest(t *testing.T) *App {
	t.Helper()
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)
	cm := newTestConfigManager(t)
	app := &App{configManager: cm}
	app.dbService = NewDbService(app)
	return app
}

// ── NewApp ────────────────────────────────────────────────────────────────────

func TestNewApp_Succeeds(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)
	app := NewApp()
	if app == nil {
		t.Fatal("expected non-nil app")
	}
	if app.configManager == nil {
		t.Error("expected configManager to be set")
	}
	if app.dbService == nil {
		t.Error("expected dbService to be set")
	}
}

// ── startup ───────────────────────────────────────────────────────────────────

func TestApp_Startup_SetsContext(t *testing.T) {
	app := newAppForTest(t)
	ctx := context.Background()
	app.startup(ctx)
	if app.ctx != ctx {
		t.Error("startup should assign the provided context")
	}
	if app.configManager.notify == nil {
		t.Error("startup should set configManager.notify")
	}
}

// ── GetAppVersion ─────────────────────────────────────────────────────────────

func TestApp_GetAppVersion(t *testing.T) {
	app := newAppForTest(t)
	Version = "1.2.3"
	BuildDate = "2025-01-01"
	v := app.GetAppVersion()
	if v["version"] != "1.2.3" {
		t.Errorf("version: got %q, want %q", v["version"], "1.2.3")
	}
	if v["buildDate"] != "2025-01-01" {
		t.Errorf("buildDate: got %q, want %q", v["buildDate"], "2025-01-01")
	}
}

// ── GetConfig / SaveConfig ────────────────────────────────────────────────────

func TestApp_GetConfig_ErrorWhenNoFile(t *testing.T) {
	app := newAppForTest(t)
	_, err := app.GetConfig()
	if err == nil {
		t.Error("expected error when config file does not exist")
	}
}

func TestApp_SaveConfig_RoundTrip(t *testing.T) {
	app := newAppForTest(t)
	ds := Datasource{ID: "ds-1", Name: "Test", Host: "localhost", Port: 5432, Database: "db", Username: "user"}
	cfg := Config{Datasources: []Datasource{ds}}
	if err := app.SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
	got, err := app.GetConfig()
	if err != nil {
		t.Fatalf("GetConfig after save: %v", err)
	}
	if len(got.Datasources) != 1 {
		t.Fatalf("expected 1 datasource, got %d", len(got.Datasources))
	}
	if got.Datasources[0].ID != "ds-1" {
		t.Errorf("ds id: got %q, want %q", got.Datasources[0].ID, "ds-1")
	}
}

// ── UpdateDatasource ──────────────────────────────────────────────────────────

func TestApp_UpdateDatasource_HappyPath(t *testing.T) {
	app := newAppForTest(t)
	ds := Datasource{ID: "ds-1", Name: "Old", Host: "localhost", Port: 5432, Database: "db", Username: "user"}
	if err := app.SaveConfig(Config{Datasources: []Datasource{ds}}); err != nil {
		t.Fatalf("setup: %v", err)
	}
	ds.Name = "New"
	if err := app.UpdateDatasource(ds); err != nil {
		t.Fatalf("UpdateDatasource: %v", err)
	}
	got, _ := app.GetConfig()
	if got.Datasources[0].Name != "New" {
		t.Errorf("name not updated: got %q", got.Datasources[0].Name)
	}
}

func TestApp_UpdateDatasource_NotFoundReturnsError(t *testing.T) {
	app := newAppForTest(t)
	err := app.UpdateDatasource(Datasource{ID: "ghost"})
	if err == nil {
		t.Error("expected error for unknown datasource id")
	}
}

// ── ClosePool ─────────────────────────────────────────────────────────────────

func TestApp_ClosePool_NoopWhenNil(t *testing.T) {
	app := newAppForTest(t)
	// should not panic when no pool exists
	app.ClosePool("non-existent-ds")
}

// ── SaveQuery / ListSavedQueries / LoadSavedQuery / DeleteSavedQuery / RenameQuery ──

func TestApp_QueryFileOps(t *testing.T) {
	app := newAppForTest(t)
	dsID := "ds-1"

	if err := app.SaveQuery(dsID, "q1.sql", "SELECT 1"); err != nil {
		t.Fatalf("SaveQuery: %v", err)
	}

	qs, err := app.ListSavedQueries(dsID)
	if err != nil {
		t.Fatalf("ListSavedQueries: %v", err)
	}
	if len(qs) != 1 || qs[0].Filename != "q1.sql" {
		t.Fatalf("ListSavedQueries: got %+v", qs)
	}

	sql, err := app.LoadSavedQuery(dsID, "q1.sql")
	if err != nil {
		t.Fatalf("LoadSavedQuery: %v", err)
	}
	if sql != "SELECT 1" {
		t.Errorf("LoadSavedQuery: got %q, want %q", sql, "SELECT 1")
	}

	if err := app.RenameQuery(dsID, "q1.sql", "q2.sql"); err != nil {
		t.Fatalf("RenameQuery: %v", err)
	}

	_, err = app.LoadSavedQuery(dsID, "q2.sql")
	if err != nil {
		t.Fatalf("LoadSavedQuery after rename: %v", err)
	}

	if err := app.DeleteSavedQuery(dsID, "q2.sql"); err != nil {
		t.Fatalf("DeleteSavedQuery: %v", err)
	}

	qs2, _ := app.ListSavedQueries(dsID)
	if len(qs2) != 0 {
		t.Errorf("expected 0 queries after delete, got %d", len(qs2))
	}
}

// ── RecordHistory / GetQueryHistory ──────────────────────────────────────────

func TestApp_HistoryRoundTrip(t *testing.T) {
	app := newAppForTest(t)
	dsID := "ds-1"

	if err := app.RecordHistory(dsID, "SELECT 1", 1, 42); err != nil {
		t.Fatalf("RecordHistory: %v", err)
	}

	entries, err := app.GetQueryHistory(dsID, 10)
	if err != nil {
		t.Fatalf("GetQueryHistory: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
	if entries[0].SQL != "SELECT 1" {
		t.Errorf("sql: got %q, want %q", entries[0].SQL, "SELECT 1")
	}
}

// ── GetCachedMetadata ─────────────────────────────────────────────────────────

func TestApp_GetCachedMetadata_EmptyWhenNoCache(t *testing.T) {
	app := newAppForTest(t)
	meta, err := app.GetCachedMetadata("ds-1")
	if err != nil {
		t.Fatalf("GetCachedMetadata: %v", err)
	}
	if meta.Schemas == nil {
		t.Error("Schemas should be non-nil empty slice, not nil")
	}
	if len(meta.Schemas) != 0 {
		t.Errorf("expected 0 schemas, got %d", len(meta.Schemas))
	}
}

// ── TestDatasource ────────────────────────────────────────────────────────────

func TestApp_TestDatasource_FailsOnBadHost(t *testing.T) {
	app := newAppForTest(t)
	result := app.TestDatasource("127.0.0.1", 1, "db", "user", "pass", "disable")
	if result.Success {
		t.Error("expected failure connecting to port 1")
	}
	if result.Message == "" {
		t.Error("expected non-empty error message")
	}
}

func TestApp_TestDatasource_DefaultsSSLMode(t *testing.T) {
	app := newAppForTest(t)
	// empty sslMode should default to "disable" without panicking
	result := app.TestDatasource("127.0.0.1", 1, "db", "user", "pass", "")
	if result.Success {
		t.Error("expected failure")
	}
}

// ── ExportCSV ─────────────────────────────────────────────────────────────────

func TestApp_ExportCSV_CancelDoesNothing(t *testing.T) {
	app := newAppForTest(t)
	app.saveDialog = func(_ context.Context, _ wruntime.SaveDialogOptions) (string, error) {
		return "", nil // user cancelled
	}
	if err := app.ExportCSV("col\nval", "out.csv"); err != nil {
		t.Fatalf("expected no error on cancel, got: %v", err)
	}
}

func TestApp_ExportCSV_WritesFile(t *testing.T) {
	app := newAppForTest(t)
	dir := t.TempDir()
	dest := filepath.Join(dir, "out.csv")
	app.saveDialog = func(_ context.Context, _ wruntime.SaveDialogOptions) (string, error) {
		return dest, nil
	}
	content := "id,name\n1,Alice\n"
	if err := app.ExportCSV(content, "out.csv"); err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	got, err := os.ReadFile(dest)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if string(got) != content {
		t.Errorf("file content: got %q, want %q", string(got), content)
	}
}

// ── PingDatasource ────────────────────────────────────────────────────────────

func TestApp_PingDatasource_NotFound(t *testing.T) {
	app := newAppForTest(t)
	result := app.PingDatasource("ghost-id")
	if result.Success {
		t.Error("expected failure for unknown datasource")
	}
	if result.Message == "" {
		t.Error("expected non-empty error message")
	}
}

func TestApp_PingDatasource_FailsOnBadHost(t *testing.T) {
	app := newAppForTest(t)
	ds := Datasource{ID: "ds-1", Name: "Test", Host: "127.0.0.1", Port: 1, Database: "db", Username: "user", SSLMode: "disable"}
	if err := app.SaveConfig(Config{Datasources: []Datasource{ds}}); err != nil {
		t.Fatalf("setup: %v", err)
	}
	result := app.PingDatasource("ds-1")
	if result.Success {
		t.Error("expected failure connecting to port 1")
	}
	if result.Message == "" {
		t.Error("expected non-empty error message")
	}
}
