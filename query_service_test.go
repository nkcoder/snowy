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
	_ = os.Setenv("HOME", tmp)
	return tmp, func() { _ = os.Setenv("HOME", orig) }
}

func TestSaveAndLoadQuery(t *testing.T) {
	tmp, cleanup := setupQueriesDir(t)
	defer cleanup()

	dsID := "ds-1"
	sql := "SELECT 1;"

	if err := SaveQuery(dsID, "my_query", sql); err != nil {
		t.Fatalf("SaveQuery: %v", err)
	}

	// File should exist with .sql extension
	expectedPath := filepath.Join(tmp, ".snowy", "queries", dsID, "my_query.sql")
	if _, err := os.Stat(expectedPath); err != nil {
		t.Fatalf("expected file not found: %v", err)
	}

	got, err := LoadSavedQuery(dsID, "my_query.sql")
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

	dsID := "ds-list"
	for _, name := range []string{"alpha", "beta", "gamma"} {
		if err := SaveQuery(dsID, name, "SELECT 1;"); err != nil {
			t.Fatal(err)
		}
	}

	queries, err := ListSavedQueries(dsID)
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

	dsID := "ds-del"
	if err := SaveQuery(dsID, "to_delete", "SELECT 3;"); err != nil {
		t.Fatal(err)
	}

	if err := DeleteSavedQuery(dsID, "to_delete.sql"); err != nil {
		t.Fatalf("DeleteSavedQuery: %v", err)
	}

	path := filepath.Join(tmp, ".snowy", "queries", dsID, "to_delete.sql")
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Error("file should be deleted")
	}
}

func TestRenameQuery(t *testing.T) {
	tmp, cleanup := setupQueriesDir(t)
	defer cleanup()

	dsID := "ds-ren"
	if err := SaveQuery(dsID, "old_name", "SELECT 4;"); err != nil {
		t.Fatal(err)
	}

	if err := RenameQuery(dsID, "old_name.sql", "new_name"); err != nil {
		t.Fatalf("RenameQuery: %v", err)
	}

	newPath := filepath.Join(tmp, ".snowy", "queries", dsID, "new_name.sql")
	if _, err := os.Stat(newPath); err != nil {
		t.Errorf("renamed file not found: %v", err)
	}
	oldPath := filepath.Join(tmp, ".snowy", "queries", dsID, "old_name.sql")
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Error("old file should be gone")
	}
}

func TestLoadSavedQuery_FileNotFound(t *testing.T) {
	_, cleanup := setupQueriesDir(t)
	defer cleanup()

	_, err := LoadSavedQuery("ds-1", "nonexistent.sql")
	if err == nil {
		t.Error("expected error loading nonexistent query file")
	}
}

func TestDeleteSavedQuery_FileNotFound(t *testing.T) {
	_, cleanup := setupQueriesDir(t)
	defer cleanup()

	err := DeleteSavedQuery("ds-1", "nonexistent.sql")
	if err == nil {
		t.Error("expected error deleting nonexistent query file")
	}
}

func TestRenameQuery_SourceNotFound(t *testing.T) {
	_, cleanup := setupQueriesDir(t)
	defer cleanup()

	err := RenameQuery("ds-1", "ghost.sql", "new.sql")
	if err == nil {
		t.Error("expected error renaming nonexistent query file")
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

// TestQueryFilename_RejectsDotNames covers the separator-free traversal names
// ("." and "..") that pass a plain slash check but still resolve outside the
// intended file. Every op that takes a filename must reject them.
func TestQueryFilename_RejectsDotNames(t *testing.T) {
	_, cleanup := setupQueriesDir(t)
	defer cleanup()

	for _, name := range []string{"", ".", ".."} {
		if err := SaveQuery("ds-1", name, "SELECT 1;"); err == nil {
			t.Errorf("SaveQuery(%q) should be rejected", name)
		}
		if _, err := LoadSavedQuery("ds-1", name); err == nil {
			t.Errorf("LoadSavedQuery(%q) should be rejected", name)
		}
		if err := DeleteSavedQuery("ds-1", name); err == nil {
			t.Errorf("DeleteSavedQuery(%q) should be rejected", name)
		}
		if err := RenameQuery("ds-1", name, "ok"); err == nil {
			t.Errorf("RenameQuery(old=%q) should be rejected", name)
		}
		if err := RenameQuery("ds-1", "ok.sql", name); err == nil {
			t.Errorf("RenameQuery(new=%q) should be rejected", name)
		}
	}
}
