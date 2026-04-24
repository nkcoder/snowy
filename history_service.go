package main

import (
	"bufio"
	"encoding/json"
	"fmt"
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
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return dir, nil
}

func historyFile(dsId string) (string, error) {
	dir, err := historyDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, dsId+".jsonl"), nil
}

// RecordHistory appends one entry to ~/.snowy/history/<dsId>.jsonl.
func RecordHistory(dsId, sql string, rowCount int, durationMs int64) error {
	path, err := historyFile(dsId)
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
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = fmt.Fprintf(f, "%s\n", data)
	return err
}

// GetQueryHistory returns the last limit history entries, newest first.
func GetQueryHistory(dsId string, limit int) ([]HistoryEntry, error) {
	path, err := historyFile(dsId)
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

	var entries []HistoryEntry
	scanner := bufio.NewScanner(f)
	// Increase default buffer size to handle large SQL entries
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var entry HistoryEntry
		if err := json.Unmarshal(line, &entry); err != nil {
			continue // skip malformed lines
		}
		entries = append(entries, entry)
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}

	// Reverse: newest first
	for i, j := 0, len(entries)-1; i < j; i, j = i+1, j-1 {
		entries[i], entries[j] = entries[j], entries[i]
	}
	if limit > 0 && len(entries) > limit {
		entries = entries[:limit]
	}
	return entries, nil
}
