package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// queriesDir returns ~/.snowy/queries/<dsID>/
func queriesDir(dsID string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".snowy", "queries", dsID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return dir, nil
}

// SavedQuery holds metadata about a saved query file.
type SavedQuery struct {
	Filename string `json:"filename"`
}

// SaveQuery writes sql to ~/.snowy/queries/<dsID>/<filename>.sql.
// filename must not contain path separators.
func SaveQuery(dsID, filename, sql string) error {
	if strings.ContainsAny(filename, "/\\") {
		return fmt.Errorf("invalid filename")
	}
	dir, err := queriesDir(dsID)
	if err != nil {
		return err
	}
	if !strings.HasSuffix(filename, ".sql") {
		filename += ".sql"
	}
	return os.WriteFile(filepath.Join(dir, filename), []byte(sql), 0644)
}

// ListSavedQueries returns all .sql filenames for a datasource.
func ListSavedQueries(dsID string) ([]SavedQuery, error) {
	dir, err := queriesDir(dsID)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	result := make([]SavedQuery, 0)
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			result = append(result, SavedQuery{Filename: e.Name()})
		}
	}
	return result, nil
}

// LoadSavedQuery reads the contents of a saved query file.
func LoadSavedQuery(dsID, filename string) (string, error) {
	if strings.ContainsAny(filename, "/\\") {
		return "", fmt.Errorf("invalid filename")
	}
	dir, err := queriesDir(dsID)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(filepath.Join(dir, filename))
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// DeleteSavedQuery removes a saved query file.
func DeleteSavedQuery(dsID, filename string) error {
	if strings.ContainsAny(filename, "/\\") {
		return fmt.Errorf("invalid filename")
	}
	dir, err := queriesDir(dsID)
	if err != nil {
		return err
	}
	return os.Remove(filepath.Join(dir, filename))
}

// RenameQuery renames a saved query file.
func RenameQuery(dsID, oldName, newName string) error {
	if strings.ContainsAny(oldName, "/\\") || strings.ContainsAny(newName, "/\\") {
		return fmt.Errorf("invalid filename")
	}
	dir, err := queriesDir(dsID)
	if err != nil {
		return err
	}
	if !strings.HasSuffix(newName, ".sql") {
		newName += ".sql"
	}
	return os.Rename(filepath.Join(dir, oldName), filepath.Join(dir, newName))
}
