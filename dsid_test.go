package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestValidateDsID(t *testing.T) {
	valid := []string{
		"default",
		"1720000000000",      // Date.now() timestamp (real format)
		"550e8400-e29b-41d4", // UUID-style with hyphens
		"ds_1",
		"AbC123",
	}
	for _, id := range valid {
		if err := validateDsID(id); err != nil {
			t.Errorf("validateDsID(%q) = %v, want nil", id, err)
		}
	}

	invalid := []string{
		"",            // empty
		"../evil",     // parent traversal
		"..",          // parent dir
		"a/b",         // forward slash
		`a\b`,         // backslash
		"foo.json",    // dot (would let ".." through if allowed)
		"has space",   // whitespace
		"/etc/passwd", // absolute path
		"a\x00b",      // null byte
	}
	for _, id := range invalid {
		if err := validateDsID(id); err == nil {
			t.Errorf("validateDsID(%q) = nil, want error", id)
		}
	}
}

// Each filesystem boundary must reject a traversal dsID and must not create any
// file outside ~/.snowy.
func TestPathBuilders_RejectTraversalDsID(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	// A sentinel path the traversal would target if the guard were missing.
	escaped := filepath.Join(home, "escaped")
	traversal := "../escaped"

	s := &DbService{}
	if err := s.SaveMetadataCache(traversal, DatabaseMetadata{}); err == nil {
		t.Error("SaveMetadataCache accepted traversal dsID, want error")
	}
	if err := RecordHistory(traversal, "SELECT 1", 1, 5); err == nil {
		t.Error("RecordHistory accepted traversal dsID, want error")
	}
	if err := SaveQuery(traversal, "q1", "SELECT 1"); err == nil {
		t.Error("SaveQuery accepted traversal dsID, want error")
	}

	for _, suffix := range []string{".json", ".jsonl", ""} {
		if _, err := os.Stat(escaped + suffix); !os.IsNotExist(err) {
			t.Errorf("traversal escaped ~/.snowy: %s exists", escaped+suffix)
		}
	}
}
