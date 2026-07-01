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
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

func historyFile(dsID string) (string, error) {
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
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = fmt.Fprintf(f, "%s\n", data)
	return err
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
	lines, err := readLines(f, limit)
	if err != nil {
		return nil, err
	}

	entries := make([]HistoryEntry, 0, len(lines))
	// lines arrive in file order (oldest first); iterate in reverse for newest-first.
	for i := len(lines) - 1; i >= 0; i-- {
		var entry HistoryEntry
		if err := json.Unmarshal(lines[i], &entry); err != nil {
			continue // skip malformed lines
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

// readLines returns the trailing non-empty lines of f in file order (oldest
// first). When limit > 0 it reads backward in chunks and stops once it has
// collected limit lines, so a large history file is never loaded whole; a
// limit <= 0 reads every line.
func readLines(f *os.File, limit int) ([][]byte, error) {
	if limit <= 0 {
		data, err := io.ReadAll(f)
		if err != nil {
			return nil, err
		}
		return nonEmptyLines(data), nil
	}

	stat, err := f.Stat()
	if err != nil {
		return nil, err
	}

	const chunk = 64 * 1024
	var (
		buf    []byte
		lines  [][]byte
		offset = stat.Size()
	)
	// Read chunks from the end until we have more than `limit` complete lines
	// (so the topmost line, possibly split across the chunk boundary, is whole)
	// or we reach the start of the file.
	for offset > 0 && len(lines) <= limit {
		readSize := int64(chunk)
		if offset < readSize {
			readSize = offset
		}
		offset -= readSize
		block := make([]byte, readSize)
		if _, err := f.ReadAt(block, offset); err != nil {
			return nil, err
		}
		buf = append(block, buf...)
		lines = nonEmptyLines(buf)
	}
	if len(lines) > limit {
		lines = lines[len(lines)-limit:]
	}
	return lines, nil
}

// nonEmptyLines splits data on newlines, dropping empty lines.
func nonEmptyLines(data []byte) [][]byte {
	out := make([][]byte, 0)
	for _, line := range bytes.Split(data, []byte("\n")) {
		if len(line) > 0 {
			out = append(out, line)
		}
	}
	return out
}
