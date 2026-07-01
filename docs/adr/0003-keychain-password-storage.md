# ADR-0003: Store passwords in the macOS Keychain, not on disk

- **Status:** Accepted
- **Date:** 2026-07-01

## Context
Connecting to PostgreSQL requires a password. The simplest implementation writes it into `~/.snowy/config.json` alongside host/port/user. That puts plaintext credentials in a world-readable file that ends up in backups, sync folders, and screen-shares — an unacceptable default for a tool people point at production databases.

## Decision
Store **only non-secret connection fields** in `config.json` and keep the **password in the macOS Keychain**, keyed by datasource ID under the service `app.snowy.connections`. Keychain access is behind a `KeyringStore` interface (`keychain.go`) so tests inject a mock; production uses `go-keyring`. The on-disk shape (`datasourceRecord`) has no password field at all; the in-memory `Datasource.Password` is transient — sent by the frontend only when saving.

Write ordering is deliberate (`config.go`): the file is written first, then the Keychain. If the file write fails, the Keychain is untouched. If the Keychain write fails afterward, the connection exists but its password is missing, and the user gets a clear, actionable error and can re-save. Keychain cleanup for deleted datasources is best-effort (an orphan entry is harmless) and surfaced via a non-fatal notification.

## Consequences
- **Easier:** no plaintext secrets on disk; OS-level protection and access control; config files are safe to inspect, diff, and sync.
- **Harder:** a hard dependency on the platform keychain (macOS-first; other platforms need their own backend); tests must mock the keyring; one more failure mode to message well.
- **Accepted:** correctness of the file-then-Keychain ordering is essential and is covered by tests. Supersedes the original plaintext-in-config approach (which `CLAUDE.md` still described until this change).
