package main

import (
	"os"
	"testing"
	"time"
)

// override home dir for tests via env var
func TestRecordAndGetHistory(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)

	dsId := "test-ds-001"

	// Empty history returns empty slice, no error
	entries, err := GetQueryHistory(dsId, 10)
	if err != nil {
		t.Fatalf("GetQueryHistory on empty: %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("expected 0 entries, got %d", len(entries))
	}

	// Record three entries
	if err := RecordHistory(dsId, "SELECT 1", 1, 10); err != nil {
		t.Fatalf("RecordHistory 1: %v", err)
	}
	time.Sleep(1 * time.Millisecond) // ensure distinct timestamps
	if err := RecordHistory(dsId, "SELECT 2", 2, 20); err != nil {
		t.Fatalf("RecordHistory 2: %v", err)
	}
	time.Sleep(1 * time.Millisecond)
	if err := RecordHistory(dsId, "SELECT 3", 3, 30); err != nil {
		t.Fatalf("RecordHistory 3: %v", err)
	}

	// Retrieve all — should be newest first
	entries, err = GetQueryHistory(dsId, 100)
	if err != nil {
		t.Fatalf("GetQueryHistory: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}
	if entries[0].SQL != "SELECT 3" {
		t.Errorf("expected newest entry first, got %q", entries[0].SQL)
	}
	if entries[2].SQL != "SELECT 1" {
		t.Errorf("expected oldest entry last, got %q", entries[2].SQL)
	}

	// Check fields
	e := entries[0]
	if e.RowCount != 3 {
		t.Errorf("rowCount: expected 3, got %d", e.RowCount)
	}
	if e.DurationMs != 30 {
		t.Errorf("durationMs: expected 30, got %d", e.DurationMs)
	}
	if e.ID == "" {
		t.Error("ID should not be empty")
	}
	if e.ExecutedAt == "" {
		t.Error("ExecutedAt should not be empty")
	}

	// Limit
	entries, err = GetQueryHistory(dsId, 2)
	if err != nil {
		t.Fatalf("GetQueryHistory with limit: %v", err)
	}
	if len(entries) != 2 {
		t.Errorf("expected 2 entries with limit=2, got %d", len(entries))
	}
}

func TestRecordHistory_InvalidPath(t *testing.T) {
	// Point HOME at a file (not directory) to trigger MkdirAll failure
	tmp := t.TempDir()
	blocker := tmp + "/.snowy"
	if err := os.WriteFile(blocker, []byte("block"), 0644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("HOME", tmp)
	err := RecordHistory("ds", "SELECT 1", 1, 5)
	if err == nil {
		t.Error("expected error when history dir is a file")
	}
}
