package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// queriesDir returns ~/.snowy/queries/<dsID>/
func queriesDir(dsID string) (string, error) {
	if err := validateDsID(dsID); err != nil {
		return "", err
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".snowy", "queries", dsID)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return dir, nil
}

// SavedQuery holds metadata about a saved query file.
type SavedQuery struct {
	Filename string `json:"filename"`
}

// validateQueryFilename rejects names that would escape the datasource's queries
// directory: empty, path separators, or the "." / ".." directory references
// (which pass a separator-only check but still resolve outside the intended file).
func validateQueryFilename(name string) error {
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, "/\\") {
		return fmt.Errorf("invalid filename")
	}
	return nil
}

// SaveQuery writes sql to ~/.snowy/queries/<dsID>/<filename>.sql.
// filename must not contain path separators.
func SaveQuery(dsID, filename, sql string) error {
	if err := validateQueryFilename(filename); err != nil {
		return err
	}
	dir, err := queriesDir(dsID)
	if err != nil {
		return err
	}
	if !strings.HasSuffix(filename, ".sql") {
		filename += ".sql"
	}
	return os.WriteFile(filepath.Join(dir, filename), []byte(sql), 0600)
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
	if err := validateQueryFilename(filename); err != nil {
		return "", err
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
	if err := validateQueryFilename(filename); err != nil {
		return err
	}
	dir, err := queriesDir(dsID)
	if err != nil {
		return err
	}
	return os.Remove(filepath.Join(dir, filename))
}

// RenameQuery renames a saved query file.
func RenameQuery(dsID, oldName, newName string) error {
	if err := validateQueryFilename(oldName); err != nil {
		return err
	}
	if err := validateQueryFilename(newName); err != nil {
		return err
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
