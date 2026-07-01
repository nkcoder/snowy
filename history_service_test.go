package main

import (
	"fmt"
	"os"
	"strings"
	"testing"
	"time"
)

// override home dir for tests via env var
func TestRecordAndGetHistory(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)

	dsID := "test-ds-001"

	// Empty history returns empty slice, no error
	entries, err := GetQueryHistory(dsID, 10)
	if err != nil {
		t.Fatalf("GetQueryHistory on empty: %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("expected 0 entries, got %d", len(entries))
	}

	// Record three entries
	if err := RecordHistory(dsID, "SELECT 1", 1, 10); err != nil {
		t.Fatalf("RecordHistory 1: %v", err)
	}
	time.Sleep(1 * time.Millisecond) // ensure distinct timestamps
	if err := RecordHistory(dsID, "SELECT 2", 2, 20); err != nil {
		t.Fatalf("RecordHistory 2: %v", err)
	}
	time.Sleep(1 * time.Millisecond)
	if err := RecordHistory(dsID, "SELECT 3", 3, 30); err != nil {
		t.Fatalf("RecordHistory 3: %v", err)
	}

	// Retrieve all — should be newest first
	entries, err = GetQueryHistory(dsID, 100)
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
	entries, err = GetQueryHistory(dsID, 2)
	if err != nil {
		t.Fatalf("GetQueryHistory with limit: %v", err)
	}
	if len(entries) != 2 {
		t.Errorf("expected 2 entries with limit=2, got %d", len(entries))
	}
}

// TestGetQueryHistory_TailOrder locks in the tail-read behaviour: a positive
// limit returns the newest N entries newest-first, and a non-positive limit
// returns everything newest-first.
func TestGetQueryHistory_TailOrder(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)
	dsID := "tail-ds"

	for i := 1; i <= 5; i++ {
		if err := RecordHistory(dsID, fmt.Sprintf("SELECT %d", i), i, int64(i)); err != nil {
			t.Fatalf("RecordHistory %d: %v", i, err)
		}
		time.Sleep(time.Millisecond) // distinct timestamps
	}

	got, err := GetQueryHistory(dsID, 2)
	if err != nil {
		t.Fatalf("GetQueryHistory limit=2: %v", err)
	}
	if len(got) != 2 || got[0].SQL != "SELECT 5" || got[1].SQL != "SELECT 4" {
		t.Errorf("limit=2: got %q/%q (len %d), want SELECT 5 / SELECT 4", first(got), second(got), len(got))
	}

	got, err = GetQueryHistory(dsID, 100)
	if err != nil {
		t.Fatalf("GetQueryHistory limit=100: %v", err)
	}
	if len(got) != 5 || got[0].SQL != "SELECT 5" || got[4].SQL != "SELECT 1" {
		t.Errorf("limit=100: got len %d first %q last %q, want 5 / SELECT 5 / SELECT 1", len(got), first(got), got[len(got)-1].SQL)
	}

	got, err = GetQueryHistory(dsID, 0)
	if err != nil {
		t.Fatalf("GetQueryHistory limit=0: %v", err)
	}
	if len(got) != 5 || got[0].SQL != "SELECT 5" {
		t.Errorf("limit=0: got len %d first %q, want all newest-first", len(got), first(got))
	}
}

// TestGetQueryHistory_CrossesChunkBoundary exercises the backward reader when a
// single entry exceeds one 64 KiB read chunk, so tailing must stitch chunks.
func TestGetQueryHistory_CrossesChunkBoundary(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)
	dsID := "big-ds"

	big := strings.Repeat("x", 100*1024) // larger than the 64 KiB chunk
	if err := RecordHistory(dsID, "SELECT '"+big+"'", 1, 1); err != nil {
		t.Fatal(err)
	}
	time.Sleep(time.Millisecond)
	if err := RecordHistory(dsID, "SELECT 'small'", 1, 1); err != nil {
		t.Fatal(err)
	}

	got, err := GetQueryHistory(dsID, 2)
	if err != nil {
		t.Fatalf("GetQueryHistory: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(got))
	}
	if got[0].SQL != "SELECT 'small'" {
		t.Errorf("newest-first broken across chunk boundary: first = %q", first(got))
	}
	if !strings.HasPrefix(got[1].SQL, "SELECT 'xxx") {
		t.Errorf("second entry should be the oversized one")
	}
}

// TestGetQueryHistory_SkipsMalformedTail ensures a corrupt trailing line (e.g.
// from an interrupted write) is skipped without counting toward limit, so valid
// older entries still fill the request.
func TestGetQueryHistory_SkipsMalformedTail(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)
	dsID := "malformed-ds"

	for i := 1; i <= 3; i++ {
		if err := RecordHistory(dsID, fmt.Sprintf("SELECT %d", i), i, int64(i)); err != nil {
			t.Fatalf("RecordHistory %d: %v", i, err)
		}
		time.Sleep(time.Millisecond)
	}

	// Append a corrupt trailing line, as an interrupted append would leave behind.
	path, err := historyFile(dsID)
	if err != nil {
		t.Fatal(err)
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.WriteString("{not valid json\n"); err != nil {
		t.Fatal(err)
	}
	f.Close()

	// Requesting 2 must skip the malformed newest line and still return the 2
	// newest valid entries.
	got, err := GetQueryHistory(dsID, 2)
	if err != nil {
		t.Fatalf("GetQueryHistory: %v", err)
	}
	if len(got) != 2 || got[0].SQL != "SELECT 3" || got[1].SQL != "SELECT 2" {
		t.Errorf("got %d entries (%q, %q), want 2: SELECT 3 / SELECT 2", len(got), first(got), second(got))
	}
}

func first(e []HistoryEntry) string {
	if len(e) == 0 {
		return ""
	}
	return e[0].SQL
}

func second(e []HistoryEntry) string {
	if len(e) < 2 {
		return ""
	}
	return e[1].SQL
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
