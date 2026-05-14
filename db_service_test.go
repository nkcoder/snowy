package main

import (
	"os"
	"testing"
)

// Integration tests require a running Postgres instance.
// Set TEST_DB_URL to enable, e.g.:
//   TEST_DB_URL=postgres://myuser:mypassword@localhost:5432/mydatabase go test ./...
//
// The demo DB from docker/docker-compose-postgresql.yml satisfies this.

func testDsId(t *testing.T) string {
	t.Helper()
	dsURL := os.Getenv("TEST_DB_URL")
	if dsURL == "" {
		t.Skip("TEST_DB_URL not set — skipping DB integration test")
	}
	// Inject a fake datasource directly into config so DbService.getConnection can find it.
	// We abuse the configManager by writing a temporary config.
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)

	cm, err := NewConfigManager()
	if err != nil {
		t.Fatalf("NewConfigManager: %v", err)
	}
	dsId := "test-ds"
	if err := cm.SaveConfig(Config{
		Datasources: []Datasource{{
			ID:       dsId,
			Name:     "test",
			Host:     "localhost",
			Port:     5432,
			Database: "mydatabase",
			Username: "myuser",
			Password: "mypassword",
			SSLMode:  "disable",
		}},
	}); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}

	app := &App{configManager: cm}
	app.dbService = NewDbService(app)
	t.Cleanup(func() {})
	// Store app on context so sub-tests can use it.
	t.Setenv("_TEST_APP_READY", "1")
	return dsId
}

func newTestApp(t *testing.T) (*App, string) {
	t.Helper()
	if os.Getenv("TEST_DB_URL") == "" {
		t.Skip("TEST_DB_URL not set — skipping DB integration test")
	}
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)

	cm, err := NewConfigManager()
	if err != nil {
		t.Fatalf("NewConfigManager: %v", err)
	}
	dsId := "test-ds"
	if err := cm.SaveConfig(Config{
		Datasources: []Datasource{{
			ID:       dsId,
			Name:     "test",
			Host:     "localhost",
			Port:     5432,
			Database: "mydatabase",
			Username: "myuser",
			Password: "mypassword",
			SSLMode:  "disable",
		}},
	}); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
	app := &App{configManager: cm}
	app.dbService = NewDbService(app)
	return app, dsId
}

func TestListTableKeys_Integration(t *testing.T) {
	app, dsId := newTestApp(t)

	keys, err := app.ListTableKeys(dsId, "public", "users")
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
	app, dsId := newTestApp(t)

	// accounts table has a FK to users
	fks, err := app.ListTableForeignKeys(dsId, "public", "accounts")
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
	app, dsId := newTestApp(t)

	indexes, err := app.ListTableIndexes(dsId, "public", "users")
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
	app, dsId := newTestApp(t)

	checks, err := app.ListTableChecks(dsId, "public", "accounts")
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

func TestListTableKeys_EmptyTable(t *testing.T) {
	app, dsId := newTestApp(t)

	// information_schema is excluded from normal schemas but querying a nonexistent table
	// should return empty slice, not an error.
	keys, err := app.ListTableKeys(dsId, "public", "nonexistent_table_xyz")
	if err != nil {
		t.Fatalf("ListTableKeys on nonexistent table: %v", err)
	}
	if len(keys) != 0 {
		t.Errorf("expected 0 keys for nonexistent table, got %d", len(keys))
	}
}
