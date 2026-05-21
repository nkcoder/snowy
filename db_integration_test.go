package main

import (
	"os"
	"strings"
	"testing"
)

// Additional integration tests covering ListSchemas, ListTables, ListColumns,
// ExecuteQuery, GetCompletions (DB fallback), and RefreshMetadata.
// All tests skip when TEST_DB_URL is not set.

func TestListSchemas_Integration(t *testing.T) {
	app, dsID := newTestApp(t)

	schemas, err := app.ListSchemas(dsID)
	if err != nil {
		t.Fatalf("ListSchemas: %v", err)
	}
	// The demo DB has at least the 'public' schema.
	found := false
	for _, s := range schemas {
		if s.Name == "public" {
			found = true
		}
	}
	if !found {
		t.Error("expected to find 'public' schema")
	}
}

func TestListTables_Integration(t *testing.T) {
	app, dsID := newTestApp(t)

	tables, err := app.ListTables(dsID, "public")
	if err != nil {
		t.Fatalf("ListTables: %v", err)
	}
	// The demo DB has users, accounts, transactions.
	names := map[string]bool{}
	for _, tbl := range tables {
		names[tbl.Name] = true
	}
	for _, expected := range []string{"users", "accounts", "transactions"} {
		if !names[expected] {
			t.Errorf("expected table %q in public schema", expected)
		}
	}
}

func TestListColumns_Integration(t *testing.T) {
	app, dsID := newTestApp(t)

	cols, err := app.ListColumns(dsID, "public", "users")
	if err != nil {
		t.Fatalf("ListColumns: %v", err)
	}
	if len(cols) == 0 {
		t.Error("expected at least one column in users table")
	}
	// user_id should be a PK column
	for _, c := range cols {
		if c.Name == "user_id" && c.KeyType != "pk" {
			t.Errorf("user_id should have keyType=pk, got %q", c.KeyType)
		}
	}
}

func TestExecuteQuery_Integration(t *testing.T) {
	app, dsID := newTestApp(t)

	result, err := app.ExecuteQuery(dsID, "SELECT 1 AS n, 'hello' AS s")
	if err != nil {
		t.Fatalf("ExecuteQuery: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if len(result.Columns) != 2 {
		t.Errorf("expected 2 columns, got %d", len(result.Columns))
	}
	if result.Columns[0] != "n" || result.Columns[1] != "s" {
		t.Errorf("unexpected columns: %v", result.Columns)
	}
	if len(result.Rows) != 1 {
		t.Errorf("expected 1 row, got %d", len(result.Rows))
	}
}

func TestExecuteQuery_Error_Integration(t *testing.T) {
	app, dsID := newTestApp(t)

	_, err := app.ExecuteQuery(dsID, "SELECT * FROM nonexistent_table_xyz")
	if err == nil {
		t.Error("expected error for query against nonexistent table")
	}
}

func TestRefreshMetadata_Integration(t *testing.T) {
	app, dsID := newTestApp(t)

	meta, err := app.RefreshMetadata(dsID)
	if err != nil {
		t.Fatalf("RefreshMetadata: %v", err)
	}
	if len(meta.Schemas) == 0 {
		t.Error("expected at least one schema")
	}
	// Verify public schema has tables
	for _, s := range meta.Schemas {
		if s.Name == "public" {
			if len(s.Tables) == 0 {
				t.Error("public schema should have tables")
			}
			return
		}
	}
	t.Error("expected to find 'public' schema in metadata")
}

func TestGetCompletions_DB_Integration(t *testing.T) {
	app, dsID := newTestApp(t)

	// No cache exists yet — GetCompletions falls back to DB via FetchDatabaseMetadata
	result, err := app.GetCompletions(dsID)
	if err != nil {
		t.Fatalf("GetCompletions: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil CompletionSet")
	}
	if len(result.Entries) == 0 {
		t.Error("expected at least one completion entry from DB")
	}
	// Should have schema, table, and column entries
	kinds := map[string]int{}
	for _, e := range result.Entries {
		kinds[e.Kind]++
	}
	if kinds["schema"] == 0 {
		t.Error("expected at least one schema completion entry")
	}
	if kinds["table"] == 0 {
		t.Error("expected at least one table completion entry")
	}
}

// Error-path tests: pass an unknown dsID so acquire() fails immediately.
// This covers the "datasource not found" branch in each DB method.

func TestListSchemas_UnknownDSID(t *testing.T) {
	app, _ := newTestApp(t)
	_, err := app.ListSchemas("no-such-ds")
	if err == nil {
		t.Error("expected error for unknown dsID")
	}
}

func TestListTables_UnknownDSID(t *testing.T) {
	app, _ := newTestApp(t)
	_, err := app.ListTables("no-such-ds", "public")
	if err == nil {
		t.Error("expected error for unknown dsID")
	}
}

func TestListColumns_UnknownDSID(t *testing.T) {
	app, _ := newTestApp(t)
	_, err := app.ListColumns("no-such-ds", "public", "users")
	if err == nil {
		t.Error("expected error for unknown dsID")
	}
}

func TestListTableKeys_UnknownDSID(t *testing.T) {
	app, _ := newTestApp(t)
	_, err := app.ListTableKeys("no-such-ds", "public", "users")
	if err == nil {
		t.Error("expected error for unknown dsID")
	}
}

func TestListTableForeignKeys_UnknownDSID(t *testing.T) {
	app, _ := newTestApp(t)
	_, err := app.ListTableForeignKeys("no-such-ds", "public", "accounts")
	if err == nil {
		t.Error("expected error for unknown dsID")
	}
}

func TestListTableIndexes_UnknownDSID(t *testing.T) {
	app, _ := newTestApp(t)
	_, err := app.ListTableIndexes("no-such-ds", "public", "users")
	if err == nil {
		t.Error("expected error for unknown dsID")
	}
}

func TestListTableChecks_UnknownDSID(t *testing.T) {
	app, _ := newTestApp(t)
	_, err := app.ListTableChecks("no-such-ds", "public", "accounts")
	if err == nil {
		t.Error("expected error for unknown dsID")
	}
}

func TestExecuteQuery_UnknownDSID(t *testing.T) {
	app, _ := newTestApp(t)
	_, err := app.ExecuteQuery("no-such-ds", "SELECT 1")
	if err == nil {
		t.Error("expected error for unknown dsID")
	}
}

func TestGetCompletions_UnknownDSID(t *testing.T) {
	app, _ := newTestApp(t)
	_, err := app.GetCompletions("no-such-ds")
	if err == nil {
		t.Error("expected error for unknown dsID")
	}
}

func TestRefreshMetadata_UnknownDSID(t *testing.T) {
	app, _ := newTestApp(t)
	_, err := app.RefreshMetadata("no-such-ds")
	if err == nil {
		t.Error("expected error for unknown dsID")
	}
}

func TestGetPool_KeyringError(t *testing.T) {
	// Arrange: save config with a password, then delete the keyring entry
	// so getPool's keyring.Get returns an error.
	dbURL := os.Getenv("TEST_DB_URL")
	if dbURL == "" {
		t.Skip("TEST_DB_URL not set — skipping DB integration test")
	}
	t.Setenv("HOME", t.TempDir())

	kr := newMockKeyring()
	cm := newTestConfigManagerWithKeyring(t, kr)
	host, port, user, _, dbname := parseDSN(t, dbURL)
	dsID := "ks-test-ds"
	if err := cm.SaveConfig(Config{
		Datasources: []Datasource{{
			ID:       dsID,
			Name:     "ks-test",
			Host:     host,
			Port:     port,
			Database: dbname,
			Username: user,
			Password: "somepassword", // written to mock keyring
			SSLMode:  "disable",
		}},
	}); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
	// Delete the keyring entry — getPool's keyring.Get will now fail
	_ = kr.Delete(keychainService, dsID)

	app := &App{configManager: cm}
	app.dbService = NewDbService(app)
	defer app.dbService.closePool(dsID)

	_, err := app.ListSchemas(dsID)
	if err == nil {
		t.Error("expected error when keyring entry is missing")
	}
}

func TestTestDatasource_Integration(t *testing.T) {
	dbURL := os.Getenv("TEST_DB_URL")
	if dbURL == "" {
		t.Skip("TEST_DB_URL not set — skipping DB integration test")
	}
	host, port, user, pass, dbname := parseDSN(t, dbURL)

	app := &App{}
	result := app.TestDatasource(host, port, dbname, user, pass, "disable")
	if !result.Success {
		t.Errorf("expected successful connection, got: %s", result.Message)
	}
	if !strings.Contains(result.Message, "successful") {
		t.Errorf("unexpected message: %q", result.Message)
	}
}
