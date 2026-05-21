package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestLoadCachedMetadata_NoFile_ReturnsEmpty(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	s := &DbService{}
	meta, err := s.LoadCachedMetadata("ds-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if meta.Schemas == nil {
		t.Error("Schemas should be empty slice, not nil")
	}
	if len(meta.Schemas) != 0 {
		t.Errorf("expected 0 schemas, got %d", len(meta.Schemas))
	}
}

func TestLoadCachedMetadata_ValidFile_Deserializes(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)

	// Write a valid cache file
	meta := DatabaseMetadata{
		Schemas: []SchemaMetadata{
			{Name: "public", Tables: []TableMetadata{{Name: "users"}}},
		},
	}
	data, _ := json.Marshal(meta)
	cacheDir := filepath.Join(tmp, ".snowy", "cache")
	_ = os.MkdirAll(cacheDir, 0755)
	_ = os.WriteFile(filepath.Join(cacheDir, "ds-1.json"), data, 0644)

	s := &DbService{}
	got, err := s.LoadCachedMetadata("ds-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got.Schemas) != 1 || got.Schemas[0].Name != "public" {
		t.Errorf("unexpected schemas: %+v", got.Schemas)
	}
	if len(got.Schemas[0].Tables) != 1 || got.Schemas[0].Tables[0].Name != "users" {
		t.Errorf("unexpected tables: %+v", got.Schemas[0].Tables)
	}
}

func TestLoadCachedMetadata_InvalidJSON_ReturnsEmpty(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)

	cacheDir := filepath.Join(tmp, ".snowy", "cache")
	_ = os.MkdirAll(cacheDir, 0755)
	_ = os.WriteFile(filepath.Join(cacheDir, "ds-1.json"), []byte("not-json{{{"), 0644)

	s := &DbService{}
	got, err := s.LoadCachedMetadata("ds-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got.Schemas) != 0 {
		t.Errorf("expected empty schemas on bad JSON, got %d", len(got.Schemas))
	}
}

func TestSaveMetadataCache_RoundTrip(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	s := &DbService{}

	meta := DatabaseMetadata{
		Schemas: []SchemaMetadata{
			{Name: "app", Tables: []TableMetadata{{Name: "orders"}}},
		},
	}
	if err := s.SaveMetadataCache("ds-2", meta); err != nil {
		t.Fatalf("SaveMetadataCache: %v", err)
	}

	got, err := s.LoadCachedMetadata("ds-2")
	if err != nil {
		t.Fatalf("LoadCachedMetadata: %v", err)
	}
	if len(got.Schemas) != 1 || got.Schemas[0].Name != "app" {
		t.Errorf("unexpected schemas after round-trip: %+v", got.Schemas)
	}
}

func TestLoadCachedMetadata_NilSchemasBecomesEmpty(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)

	// Write metadata with null schemas (json null → Go nil)
	raw := `{"schemas": null}`
	cacheDir := filepath.Join(tmp, ".snowy", "cache")
	_ = os.MkdirAll(cacheDir, 0755)
	_ = os.WriteFile(filepath.Join(cacheDir, "ds-3.json"), []byte(raw), 0644)

	s := &DbService{}
	got, _ := s.LoadCachedMetadata("ds-3")
	if got.Schemas == nil {
		t.Error("nil schemas should be normalised to empty slice")
	}
}
