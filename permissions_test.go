package main

import (
	"os"
	"path/filepath"
	"testing"
)

// assertPerm fails unless path exists with exactly the expected permission bits.
func assertPerm(t *testing.T, path string, want os.FileMode) {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat %s: %v", path, err)
	}
	if got := info.Mode().Perm(); got != want {
		t.Errorf("%s: permissions = %#o, want %#o", path, got, want)
	}
}

// User-data under ~/.snowy contains host/port/database/username (M5): the
// directory tree must be 0700 and every file 0600.

func TestConfigFilePermissions(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	if _, err := NewConfigManager(); err != nil {
		t.Fatalf("NewConfigManager: %v", err)
	}

	assertPerm(t, filepath.Join(home, ".snowy"), 0700)
	assertPerm(t, filepath.Join(home, ".snowy", "config.json"), 0600)
}

func TestMetadataCachePermissions(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	s := &DbService{}
	if err := s.SaveMetadataCache("ds1", DatabaseMetadata{}); err != nil {
		t.Fatalf("SaveMetadataCache: %v", err)
	}

	assertPerm(t, filepath.Join(home, ".snowy", "cache"), 0700)
	assertPerm(t, filepath.Join(home, ".snowy", "cache", "ds1.json"), 0600)
}

func TestHistoryFilePermissions(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	if err := RecordHistory("ds1", "SELECT 1", 1, 5); err != nil {
		t.Fatalf("RecordHistory: %v", err)
	}

	assertPerm(t, filepath.Join(home, ".snowy", "history"), 0700)
	assertPerm(t, filepath.Join(home, ".snowy", "history", "ds1.jsonl"), 0600)
}

func TestSavedQueryPermissions(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	if err := SaveQuery("ds1", "q1", "SELECT 1"); err != nil {
		t.Fatalf("SaveQuery: %v", err)
	}

	assertPerm(t, filepath.Join(home, ".snowy", "queries", "ds1"), 0700)
	assertPerm(t, filepath.Join(home, ".snowy", "queries", "ds1", "q1.sql"), 0600)
}
