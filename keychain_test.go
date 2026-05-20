package main

import (
	"errors"
	"sync"
	"testing"
)

// mockKeyring is an in-memory KeyringStore for tests.
type mockKeyring struct {
	mu      sync.Mutex
	entries map[string]string // "service/account" → password
}

func newMockKeyring() *mockKeyring { return &mockKeyring{entries: map[string]string{}} }

func (m *mockKeyring) key(service, account string) string { return service + "/" + account }

func (m *mockKeyring) Set(service, account, password string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.entries[m.key(service, account)] = password
	return nil
}

func (m *mockKeyring) Get(service, account string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	pw, ok := m.entries[m.key(service, account)]
	if !ok {
		return "", errors.New("secret not found in keyring")
	}
	return pw, nil
}

func (m *mockKeyring) Delete(service, account string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.entries, m.key(service, account))
	return nil
}

// ── Cycle 1: mock keyring round-trips a password ──────────────────────────────

func TestMockKeyring_RoundTrip(t *testing.T) {
	kr := newMockKeyring()

	if err := kr.Set("snowy", "ds-1", "secret"); err != nil {
		t.Fatalf("Set: %v", err)
	}
	got, err := kr.Get("snowy", "ds-1")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != "secret" {
		t.Errorf("got %q, want %q", got, "secret")
	}
}

func TestMockKeyring_DeleteRemovesEntry(t *testing.T) {
	kr := newMockKeyring()
	_ = kr.Set("snowy", "ds-1", "secret")
	_ = kr.Delete("snowy", "ds-1")

	_, err := kr.Get("snowy", "ds-1")
	if err == nil {
		t.Error("expected error after delete, got nil")
	}
}
