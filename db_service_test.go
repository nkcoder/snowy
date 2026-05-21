package main

import (
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"
)

// Integration tests require a running Postgres instance.
// Set TEST_DB_URL to enable, e.g.:
//   TEST_DB_URL=postgres://myuser:mypassword@localhost:5432/mydatabase go test ./...
//
// The demo DB from docker/docker-compose-postgresql.yml satisfies this.

// parseDSN extracts connection parameters from a Postgres URL like
// postgres://user:pass@host:port/dbname?sslmode=disable
func parseDSN(t *testing.T, rawURL string) (host string, port int, user, pass, dbname string) {
	t.Helper()
	u, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("parse TEST_DB_URL %q: %v", rawURL, err)
	}
	host = u.Hostname()
	port = 5432
	if p := u.Port(); p != "" {
		if n, err := strconv.Atoi(p); err == nil {
			port = n
		}
	}
	user = u.User.Username()
	pass, _ = u.User.Password()
	dbname = strings.TrimPrefix(u.Path, "/")
	return
}

func newTestApp(t *testing.T) (*App, string) {
	t.Helper()
	dbURL := os.Getenv("TEST_DB_URL")
	if dbURL == "" {
		t.Skip("TEST_DB_URL not set — skipping DB integration test")
	}
	t.Setenv("HOME", t.TempDir())

	host, port, user, pass, dbname := parseDSN(t, dbURL)

	// Use mockKeyring to avoid real macOS Keychain / Linux secretservice dialogs.
	cm := newTestConfigManagerWithKeyring(t, newMockKeyring())
	dsID := "test-ds"
	if err := cm.SaveConfig(Config{
		Datasources: []Datasource{{
			ID:       dsID,
			Name:     "test",
			Host:     host,
			Port:     port,
			Database: dbname,
			Username: user,
			Password: pass,
			SSLMode:  "disable",
		}},
	}); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
	app := &App{configManager: cm}
	app.dbService = NewDbService(app)
	t.Cleanup(func() { app.dbService.closePool(dsID) })
	return app, dsID
}

func TestListTableKeys_Integration(t *testing.T) {
	app, dsID := newTestApp(t)

	keys, err := app.ListTableKeys(dsID, "public", "users")
	if err != nil {
		t.Fatalf("ListTableKeys: %v", err)
	}
	// users table must have a PK
	if len(keys) == 0 {
		t.Error("expected at least one primary key on users table")
	}
	for _, k := range keys {
		if k.Name == "" {
			t.Error("key name should not be empty")
		}
		if k.Columns == "" {
			t.Error("key columns should not be empty")
		}
	}
}

func TestListTableForeignKeys_Integration(t *testing.T) {
	app, dsID := newTestApp(t)

	// accounts table has a FK to users
	fks, err := app.ListTableForeignKeys(dsID, "public", "accounts")
	if err != nil {
		t.Fatalf("ListTableForeignKeys: %v", err)
	}
	if len(fks) == 0 {
		t.Error("expected at least one foreign key on accounts table")
	}
	for _, fk := range fks {
		if fk.Name == "" {
			t.Error("FK name should not be empty")
		}
		if fk.RefTable == "" {
			t.Error("FK refTable should not be empty")
		}
	}
}

func TestListTableIndexes_Integration(t *testing.T) {
	app, dsID := newTestApp(t)

	indexes, err := app.ListTableIndexes(dsID, "public", "users")
	if err != nil {
		t.Fatalf("ListTableIndexes: %v", err)
	}
	// Primary key index is excluded; non-PK indexes may or may not exist
	for _, idx := range indexes {
		if idx.Name == "" {
			t.Error("index name should not be empty")
		}
	}
}

func TestListTableChecks_Integration(t *testing.T) {
	app, dsID := newTestApp(t)

	checks, err := app.ListTableChecks(dsID, "public", "accounts")
	if err != nil {
		t.Fatalf("ListTableChecks: %v", err)
	}
	// May be 0 if no check constraints defined; just ensure no error
	for _, c := range checks {
		if c.Name == "" {
			t.Error("check constraint name should not be empty")
		}
	}
}

// TestCacheCompletionsFromMetadata verifies that cacheCompletionsFromMetadata
// builds the correct CompletionSet entries and that GetCompletions returns
// them from cache (no DB call).
func TestCacheCompletionsFromMetadata(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)
	cm, err := NewConfigManager()
	if err != nil {
		t.Fatalf("NewConfigManager: %v", err)
	}
	app := &App{configManager: cm}
	svc := NewDbService(app)

	meta := DatabaseMetadata{
		Schemas: []SchemaMetadata{
			{
				Name: "public",
				Tables: []TableMetadata{
					{
						Name: "users",
						Type: "BASE TABLE",
						Columns: []ColumnItem{
							{Name: "id", DataType: "integer", KeyType: "pk"},
							{Name: "email", DataType: "text", KeyType: ""},
						},
					},
					{
						Name: "v_active",
						Type: "VIEW",
						Columns: []ColumnItem{
							{Name: "user_id", DataType: "integer", KeyType: ""},
						},
					},
				},
			},
		},
	}

	const dsID = "completion-test-ds"
	svc.cacheCompletionsFromMetadata(dsID, meta)

	raw, ok := svc.completionCache.Load(dsID)
	if !ok {
		t.Fatal("completionCache should have an entry after cacheCompletionsFromMetadata")
	}
	cs := raw.(*CompletionSet)

	// 1 schema + 1 table + 1 view + 3 columns = 6 entries
	if len(cs.Entries) != 6 {
		t.Errorf("expected 6 entries, got %d: %+v", len(cs.Entries), cs.Entries)
	}

	kinds := map[string]int{}
	for _, e := range cs.Entries {
		kinds[e.Kind]++
	}
	if kinds["schema"] != 1 {
		t.Errorf("schema count: want 1, got %d", kinds["schema"])
	}
	if kinds["table"] != 1 {
		t.Errorf("table count: want 1, got %d", kinds["table"])
	}
	if kinds["view"] != 1 {
		t.Errorf("view count: want 1, got %d", kinds["view"])
	}
	if kinds["column"] != 3 {
		t.Errorf("column count: want 3, got %d", kinds["column"])
	}

	// GetCompletions must return the cached result without opening a DB connection.
	result, err := svc.GetCompletions(dsID)
	if err != nil {
		t.Fatalf("GetCompletions after cacheCompletionsFromMetadata: %v", err)
	}
	if len(result.Entries) != 6 {
		t.Errorf("GetCompletions: expected 6 entries, got %d", len(result.Entries))
	}
}

// TestCacheCompletionsFromMetadata_Overwrite verifies that a second call
// replaces the previous cache entry (stale data is not retained).
func TestCacheCompletionsFromMetadata_Overwrite(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)
	cm, err := NewConfigManager()
	if err != nil {
		t.Fatalf("NewConfigManager: %v", err)
	}
	app := &App{configManager: cm}
	svc := NewDbService(app)

	const dsID = "overwrite-test-ds"

	first := DatabaseMetadata{
		Schemas: []SchemaMetadata{{Name: "public", Tables: []TableMetadata{{Name: "old_table", Type: "BASE TABLE"}}}},
	}
	svc.cacheCompletionsFromMetadata(dsID, first)

	second := DatabaseMetadata{
		Schemas: []SchemaMetadata{{Name: "public", Tables: []TableMetadata{
			{Name: "new_table", Type: "BASE TABLE"},
			{Name: "another_table", Type: "BASE TABLE"},
		}}},
	}
	svc.cacheCompletionsFromMetadata(dsID, second)

	result, err := svc.GetCompletions(dsID)
	if err != nil {
		t.Fatalf("GetCompletions: %v", err)
	}
	// 1 schema + 2 tables = 3 entries (stale old_table must be gone)
	if len(result.Entries) != 3 {
		t.Errorf("expected 3 entries after overwrite, got %d", len(result.Entries))
	}
	for _, e := range result.Entries {
		if e.Name == "old_table" {
			t.Error("stale 'old_table' entry still present after cache overwrite")
		}
	}
}

func TestListTableKeys_EmptyTable(t *testing.T) {
	app, dsID := newTestApp(t)

	// information_schema is excluded from normal schemas but querying a nonexistent table
	// should return empty slice, not an error.
	keys, err := app.ListTableKeys(dsID, "public", "nonexistent_table_xyz")
	if err != nil {
		t.Fatalf("ListTableKeys on nonexistent table: %v", err)
	}
	if len(keys) != 0 {
		t.Errorf("expected 0 keys for nonexistent table, got %d", len(keys))
	}
}
