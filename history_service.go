package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

// maxHistoryEntries caps how many query records are retained per datasource.
// The file is trimmed to this many newest entries on every write so the plaintext
// SQL history never grows without bound.
const maxHistoryEntries = 100

// HistoryEntry records a single query execution.
type HistoryEntry struct {
	ID         string `json:"id"`
	SQL        string `json:"sql"`
	RowCount   int    `json:"rowCount"`
	DurationMs int64  `json:"durationMs"`
	ExecutedAt string `json:"executedAt"` // RFC3339
}

// historyDir returns ~/.snowy/history/, creating it if needed.
func historyDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".snowy", "history")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return dir, nil
}

func historyFile(dsID string) (string, error) {
	if err := validateDsID(dsID); err != nil {
		return "", err
	}
	dir, err := historyDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, dsID+".jsonl"), nil
}

// RecordHistory appends one entry to ~/.snowy/history/<dsID>.jsonl.
func RecordHistory(dsID, sql string, rowCount int, durationMs int64) error {
	path, err := historyFile(dsID)
	if err != nil {
		return err
	}
	entry := HistoryEntry{
		ID:         fmt.Sprintf("%d", time.Now().UnixNano()),
		SQL:        sql,
		RowCount:   rowCount,
		DurationMs: durationMs,
		ExecutedAt: time.Now().UTC().Format(time.RFC3339),
	}
	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	if _, err := fmt.Fprintf(f, "%s\n", data); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return trimHistory(path, maxHistoryEntries)
}

// trimHistory rewrites path to keep only its newest max lines. It is a no-op when
// the file already has max or fewer lines. Because RecordHistory calls it after
// every append, the file stays at ~max lines, so reading it whole stays cheap.
// The rewrite goes through a temp file + rename so a crash never truncates history.
func trimHistory(path string, max int) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	lines := bytes.Split(bytes.TrimRight(data, "\n"), []byte("\n"))
	if len(lines) <= max {
		return nil
	}
	kept := bytes.Join(lines[len(lines)-max:], []byte("\n"))
	kept = append(kept, '\n')
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, kept, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// ClearHistory removes all recorded history for a datasource. A missing file is
// treated as already-cleared (no error).
func ClearHistory(dsID string) error {
	path, err := historyFile(dsID)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// GetQueryHistory returns the last limit history entries, newest first.
func GetQueryHistory(dsID string, limit int) ([]HistoryEntry, error) {
	path, err := historyFile(dsID)
	if err != nil {
		return nil, err
	}

	f, err := os.Open(path)
	if os.IsNotExist(err) {
		return []HistoryEntry{}, nil
	}
	if err != nil {
		return nil, err
	}
	defer f.Close()

	// For a positive limit, read only the file's tail rather than the whole file:
	// history grows unbounded (append-only) but callers only ever want the last N.
	if limit > 0 {
		return tailEntries(f, limit)
	}

	// limit <= 0: return every entry, newest first.
	data, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}
	lines := bytes.Split(data, []byte("\n"))
	entries := make([]HistoryEntry, 0, len(lines))
	for i := len(lines) - 1; i >= 0; i-- {
		if entry, ok := parseEntry(lines[i]); ok {
			entries = append(entries, entry)
		}
	}
	return entries, nil
}

// tailEntries returns up to limit history entries, newest first. It reads the
// file backward in fixed chunks and stops once it has limit successfully-parsed
// entries or reaches the start of the file, so a large history file is never
// loaded whole. Malformed lines are skipped and do not count toward the limit,
// so a corrupt trailing line (e.g. from an interrupted write) does not shrink
// the result below limit while valid older entries remain.
func tailEntries(f *os.File, limit int) ([]HistoryEntry, error) {
	stat, err := f.Stat()
	if err != nil {
		return nil, err
	}

	const chunk = 64 * 1024
	entries := make([]HistoryEntry, 0, limit)
	var pending []byte // leading partial line carried back to the previous chunk
	offset := stat.Size()

	for offset > 0 && len(entries) < limit {
		readSize := int64(chunk)
		if offset < readSize {
			readSize = offset
		}
		offset -= readSize
		block := make([]byte, readSize)
		if _, err := f.ReadAt(block, offset); err != nil {
			return nil, err
		}
		buf := append(block, pending...)

		// Everything after the first newline is complete; the head up to it may be
		// the tail of a line continuing into the previous chunk — unless we are now
		// at the start of the file, where the head is complete too.
		complete := buf
		if offset > 0 {
			nl := bytes.IndexByte(buf, '\n')
			if nl < 0 {
				pending = buf // no newline yet: whole buf is one partial line
				continue
			}
			pending = buf[:nl]
			complete = buf[nl+1:]
		}

		// Parse the complete lines newest-first until we reach the limit.
		lines := bytes.Split(complete, []byte("\n"))
		for i := len(lines) - 1; i >= 0 && len(entries) < limit; i-- {
			if entry, ok := parseEntry(lines[i]); ok {
				entries = append(entries, entry)
			}
		}
	}
	return entries, nil
}

// parseEntry unmarshals one JSONL line into a HistoryEntry, reporting ok=false
// for empty or malformed lines so callers can skip them.
func parseEntry(line []byte) (HistoryEntry, bool) {
	if len(line) == 0 {
		return HistoryEntry{}, false
	}
	var entry HistoryEntry
	if err := json.Unmarshal(line, &entry); err != nil {
		return HistoryEntry{}, false
	}
	return entry, true
}
