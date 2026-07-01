# ADR-0006: Plain-file local storage + on-disk metadata cache

- **Status:** Accepted
- **Date:** 2026-07-01

## Context
Snowy needs to persist user data between launches: connection definitions, saved queries, query history, and database structure for autocomplete/browsing. A desktop client for a single user does not justify an embedded database (SQLite) or a server. We also want the app to stay useful when a datasource is temporarily unreachable.

## Decision
Store everything as **plain files under `~/.snowy/`**, one concern per location:
- `config.json` — projects and datasources (no passwords; see [ADR-0003](0003-keychain-password-storage.md)), written atomically with a documented file-then-Keychain order.
- `queries/<dsId>/*.sql` — saved queries (filenames sanitized against path separators).
- `history/<dsId>.jsonl` — append-only execution log, one JSON object per line, read back newest-first.
- `cache/<dsId>.json` — last-fetched `DatabaseMetadata`, refreshed on connect.

The metadata cache is the key resilience choice: on connect we load the cache immediately so the sidebar and autocomplete work from last-known structure, then refresh from the DB in the background; if the live refresh fails, the UI shows a "showing cached metadata" warning instead of an empty tree.

## Consequences
- **Easier:** human-readable, inspectable, git-friendly storage; trivial backup; append-only history is cheap to write; cached metadata makes the app usable offline / against a flaky connection.
- **Harder:** no transactions/migrations across files; reads like history load the whole file before truncating (code-review L2); per-`dsId` paths must be sanitized to stay inside `~/.snowy` (code-review M4); file permissions need tightening (code-review M5).
- **Accepted:** plain files fit a single-user desktop tool; the hardening items above are tracked separately and do not change this decision.
