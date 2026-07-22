package main

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
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

func TestAcquireRetryOnDeadPool(t *testing.T) {
	app, dsID := newTestApp(t)

	// Prime the pool.
	pool, err := app.dbService.getPool(dsID)
	if err != nil {
		t.Fatalf("getPool: %v", err)
	}

	// Simulate pool death (e.g. NAT/firewall teardown) by closing the pool
	// without removing it from the cache — leaving a stale entry behind.
	pool.Close()

	// acquire() must detect the failure, discard the stale pool, and retry
	// successfully with a freshly created pool.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	conn, err := app.dbService.acquire(ctx, dsID)
	if err != nil {
		t.Fatalf("acquire after pool death: %v", err)
	}
	conn.Release()

	// Verify the retry path actually replaced the pool (not the original closed one).
	newPool, err := app.dbService.getPool(dsID)
	if err != nil {
		t.Fatalf("getPool after retry: %v", err)
	}
	if newPool == pool {
		t.Error("expected acquire() to replace the stale pool, but pool pointer is unchanged")
	}
}

func TestQueryTimeoutError(t *testing.T) {
	// A context deadline is rewritten to a message naming the timeout budget.
	got := queryTimeoutError(context.DeadlineExceeded)
	if got == nil || !strings.Contains(got.Error(), "30s") || !strings.Contains(got.Error(), "exceeded") {
		t.Errorf("deadline: got %v, want message mentioning '30s' and 'exceeded'", got)
	}

	// A wrapped deadline is still detected.
	wrapped := fmt.Errorf("acquire: %w", context.DeadlineExceeded)
	if !strings.Contains(queryTimeoutError(wrapped).Error(), "30s") {
		t.Errorf("wrapped deadline not rewritten: %v", queryTimeoutError(wrapped))
	}

	// Unrelated errors pass through unchanged (same instance).
	orig := errors.New("syntax error")
	if queryTimeoutError(orig) != orig {
		t.Errorf("unrelated error should pass through unchanged, got %v", queryTimeoutError(orig))
	}
}

func TestExecuteQuery_UUIDFormatting_Integration(t *testing.T) {
	app, dsID := newTestApp(t)

	const want = "12345678-1234-1234-1234-1234567890ab"
	r, err := app.ExecuteQuery(dsID, "SELECT '"+want+"'::uuid AS id")
	if err != nil {
		t.Fatalf("ExecuteQuery: %v", err)
	}
	if r.RowCount != 1 {
		t.Fatalf("expected 1 row, got %d", r.RowCount)
	}
	got, ok := r.Rows[0][0].(string)
	if !ok {
		t.Fatalf("uuid not formatted as string: %T", r.Rows[0][0])
	}
	if got != want {
		t.Errorf("uuid = %q, want %q", got, want)
	}
}

func TestExecuteQuery_ComplexTypeFormatting_Integration(t *testing.T) {
	app, dsID := newTestApp(t)

	cases := []struct {
		name string
		sql  string
		want string
	}{
		{"time", "'12:34:56'::time", "12:34:56.000000"},
		{"jsonb", `'{"a":1,"b":[2,3]}'::jsonb`, `{"a":1,"b":[2,3]}`},
		{"json", `'{"a":1}'::json`, `{"a":1}`},
		{"interval", "'1 day 3 hours'::interval", "1 day 03:00:00"},
		{"bit", "B'101'::bit(3)", "101"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r, err := app.ExecuteQuery(dsID, "SELECT "+tc.sql+" AS v")
			if err != nil {
				t.Fatalf("ExecuteQuery: %v", err)
			}
			got, ok := r.Rows[0][0].(string)
			if !ok {
				t.Fatalf("%s not stringified: %T (%v)", tc.name, r.Rows[0][0], r.Rows[0][0])
			}
			if got != tc.want {
				t.Errorf("%s = %q, want %q", tc.name, got, tc.want)
			}
		})
	}
}

func TestExecuteQuery_RowsAffected_Integration(t *testing.T) {
	app, dsID := newTestApp(t)

	tbl := "snowy_rows_affected_test"
	// Clean up regardless of where the test stops.
	t.Cleanup(func() { _, _ = app.ExecuteQuery(dsID, "DROP TABLE IF EXISTS "+tbl) })

	mustExec := func(sql string) *QueryResult {
		t.Helper()
		r, err := app.ExecuteQuery(dsID, sql)
		if err != nil {
			t.Fatalf("ExecuteQuery(%q): %v", sql, err)
		}
		return r
	}

	create := mustExec("CREATE TABLE " + tbl + " (id int primary key, n int)")
	if create.Command != "CREATE" {
		t.Errorf("CREATE: command = %q, want CREATE", create.Command)
	}

	ins := mustExec("INSERT INTO " + tbl + " (id, n) VALUES (1, 10), (2, 20), (3, 30)")
	if ins.Command != "INSERT" || ins.RowsAffected != 3 {
		t.Errorf("INSERT: command=%q rowsAffected=%d, want INSERT/3", ins.Command, ins.RowsAffected)
	}

	upd := mustExec("UPDATE " + tbl + " SET n = n + 1 WHERE id <= 2")
	if upd.Command != "UPDATE" || upd.RowsAffected != 2 {
		t.Errorf("UPDATE: command=%q rowsAffected=%d, want UPDATE/2", upd.Command, upd.RowsAffected)
	}

	del := mustExec("DELETE FROM " + tbl + " WHERE id = 3")
	if del.Command != "DELETE" || del.RowsAffected != 1 {
		t.Errorf("DELETE: command=%q rowsAffected=%d, want DELETE/1", del.Command, del.RowsAffected)
	}

	sel := mustExec("SELECT id, n FROM " + tbl + " ORDER BY id")
	if len(sel.Columns) != 2 || sel.RowCount != 2 {
		t.Errorf("SELECT: columns=%d rowCount=%d, want 2/2", len(sel.Columns), sel.RowCount)
	}

	drop := mustExec("DROP TABLE " + tbl)
	if drop.Command != "DROP" {
		t.Errorf("DROP: command = %q, want DROP", drop.Command)
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

// TestPostgresConnString_DefaultsToRequire locks in the secure default: a
// datasource with no SSL mode set connects with sslmode=require (encrypted),
// not the old plaintext "disable".
func TestPostgresConnString_DefaultsToRequire(t *testing.T) {
	u, err := url.Parse(postgresConnString("localhost", 5432, "db", "user", ""))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if got := u.Query().Get("sslmode"); got != "require" {
		t.Errorf("empty sslMode should default to require, got %q", got)
	}
}

// TestPostgresConnString_ResistsInjection proves user-supplied fields cannot
// smuggle extra libpq keywords (e.g. downgrading sslmode) via spaces/"=".
func TestPostgresConnString_ResistsInjection(t *testing.T) {
	// A username crafted to inject "sslmode=disable" must be preserved verbatim
	// and must not downgrade the connection's TLS.
	cfg, err := pgxpool.ParseConfig(
		postgresConnString("localhost", 5432, "db", "evil sslmode=disable", "require"))
	if err != nil {
		t.Fatalf("ParseConfig: %v", err)
	}
	if cfg.ConnConfig.User != "evil sslmode=disable" {
		t.Errorf("username not preserved verbatim: %q", cfg.ConnConfig.User)
	}
	if cfg.ConnConfig.Database != "db" {
		t.Errorf("database not preserved: %q", cfg.ConnConfig.Database)
	}
	if cfg.ConnConfig.TLSConfig == nil {
		t.Error("sslmode=require must yield a TLS config; injection downgraded it")
	}
}
