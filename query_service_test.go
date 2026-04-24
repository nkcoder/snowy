package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// setupQueriesDir overrides the user home for testing by creating a temp dir
// and setting the HOME env var so queriesDir() resolves under it.
func setupQueriesDir(t *testing.T) (string, func()) {
	t.Helper()
	tmp := t.TempDir()
	orig := os.Getenv("HOME")
	os.Setenv("HOME", tmp)
	return tmp, func() { os.Setenv("HOME", orig) }
}

func TestSaveAndLoadQuery(t *testing.T) {
	tmp, cleanup := setupQueriesDir(t)
	defer cleanup()

	dsId := "ds-1"
	sql := "SELECT 1;"

	if err := SaveQuery(dsId, "my_query", sql); err != nil {
		t.Fatalf("SaveQuery: %v", err)
	}

	// File should exist with .sql extension
	expectedPath := filepath.Join(tmp, ".snowy", "queries", dsId, "my_query.sql")
	if _, err := os.Stat(expectedPath); err != nil {
		t.Fatalf("expected file not found: %v", err)
	}

	got, err := LoadSavedQuery(dsId, "my_query.sql")
	if err != nil {
		t.Fatalf("LoadSavedQuery: %v", err)
	}
	if got != sql {
		t.Errorf("got %q, want %q", got, sql)
	}
}

func TestSaveQuery_AddsSqlExtension(t *testing.T) {
	_, cleanup := setupQueriesDir(t)
	defer cleanup()

	if err := SaveQuery("ds-1", "no_ext", "SELECT 2;"); err != nil {
		t.Fatal(err)
	}
	// Loading without extension should fail; with .sql should work
	_, err := LoadSavedQuery("ds-1", "no_ext.sql")
	if err != nil {
		t.Errorf("expected .sql to be appended automatically; load failed: %v", err)
	}
}

func TestListSavedQueries(t *testing.T) {
	_, cleanup := setupQueriesDir(t)
	defer cleanup()

	dsId := "ds-list"
	for _, name := range []string{"alpha", "beta", "gamma"} {
		if err := SaveQuery(dsId, name, "SELECT 1;"); err != nil {
			t.Fatal(err)
		}
	}

	queries, err := ListSavedQueries(dsId)
	if err != nil {
		t.Fatalf("ListSavedQueries: %v", err)
	}
	if len(queries) != 3 {
		t.Errorf("expected 3 queries, got %d", len(queries))
	}
	for _, q := range queries {
		if !strings.HasSuffix(q.Filename, ".sql") {
			t.Errorf("filename %q missing .sql suffix", q.Filename)
		}
	}
}

func TestListSavedQueries_EmptyDir(t *testing.T) {
	_, cleanup := setupQueriesDir(t)
	defer cleanup()

	queries, err := ListSavedQueries("ds-empty")
	if err != nil {
		t.Fatalf("ListSavedQueries: %v", err)
	}
	if len(queries) != 0 {
		t.Errorf("expected empty list, got %d", len(queries))
	}
}

func TestDeleteSavedQuery(t *testing.T) {
	tmp, cleanup := setupQueriesDir(t)
	defer cleanup()

	dsId := "ds-del"
	if err := SaveQuery(dsId, "to_delete", "SELECT 3;"); err != nil {
		t.Fatal(err)
	}

	if err := DeleteSavedQuery(dsId, "to_delete.sql"); err != nil {
		t.Fatalf("DeleteSavedQuery: %v", err)
	}

	path := filepath.Join(tmp, ".snowy", "queries", dsId, "to_delete.sql")
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Error("file should be deleted")
	}
}

func TestRenameQuery(t *testing.T) {
	tmp, cleanup := setupQueriesDir(t)
	defer cleanup()

	dsId := "ds-ren"
	if err := SaveQuery(dsId, "old_name", "SELECT 4;"); err != nil {
		t.Fatal(err)
	}

	if err := RenameQuery(dsId, "old_name.sql", "new_name"); err != nil {
		t.Fatalf("RenameQuery: %v", err)
	}

	newPath := filepath.Join(tmp, ".snowy", "queries", dsId, "new_name.sql")
	if _, err := os.Stat(newPath); err != nil {
		t.Errorf("renamed file not found: %v", err)
	}
	oldPath := filepath.Join(tmp, ".snowy", "queries", dsId, "old_name.sql")
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Error("old file should be gone")
	}
}

func TestSaveQuery_RejectsPathTraversal(t *testing.T) {
	_, cleanup := setupQueriesDir(t)
	defer cleanup()

	err := SaveQuery("ds-1", "../evil", "DROP TABLE users;")
	if err == nil {
		t.Error("expected error for path traversal filename")
	}
}
