package main

import "github.com/zalando/go-keyring"

// KeyringStore abstracts macOS Keychain access for testability.
type KeyringStore interface {
	Set(service, account, password string) error
	Get(service, account string) (string, error)
	Delete(service, account string) error
}

// keychainService namespaces our entries in the macOS Keychain. Reverse-DNS
// style avoids collisions with any other tool that happens to use "snowy".
const keychainService = "app.snowy.connections"

// systemKeyring delegates to the real macOS Keychain via go-keyring.
type systemKeyring struct{}

func (systemKeyring) Set(service, account, password string) error {
	return keyring.Set(service, account, password)
}

func (systemKeyring) Get(service, account string) (string, error) {
	return keyring.Get(service, account)
}

func (systemKeyring) Delete(service, account string) error {
	return keyring.Delete(service, account)
}
