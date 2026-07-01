# Snowy — Comprehensive Code Review

**Date:** 2026-07-01
**Scope:** Full repository — Go backend (`*.go`) and React/TypeScript frontend (`frontend/src/**`).
**Reviewer goal:** Honest, critical assessment across clean code, security, design, architecture, and best practice. Findings only — each Medium+ item is filed as its own GitHub issue; Low/nitpick items are collected here and tracked by a single batched cleanup issue.

---

## Executive summary

Snowy is a **well-built codebase**. The backend in particular is clean, defensively written, and already well-commented: every DB method consumes `rows.Err()`, all metadata queries are parameterized, secrets live in the macOS Keychain (not on disk), the connection pool has a sensible stale-connection retry, and file writes are ordered to keep config and Keychain consistent. The frontend has a clear component/hook split, a disciplined design-token system, and a genuinely thorough test suite (440 frontend unit tests + Playwright e2e + Go unit/integration tests).

The issues below are mostly about **maintainability at scale** (a few very large component files), **documentation drift** (CLAUDE.md no longer matches the code), and **defense-in-depth hardening** (file permissions, path sanitization). None are critical security holes. The most important single fix is correcting the stale `CLAUDE.md`, because it actively misleads contributors and AI assistants about how secrets and connections work.

| Severity | Count | Theme |
|----------|-------|-------|
| High     | 0     | — |
| Medium   | 6     | Docs drift, large components, hardening |
| Low      | 9     | Nitpicks, minor perf, consistency |

---

## Medium findings (one issue each)

### M1 — `CLAUDE.md` is stale and contradicts the code
**Files:** `CLAUDE.md`
The project guide states "passwords stored plain text" and "opens a fresh `pgx` connection per call (no pooling)." Both are **false** in the current code:
- Passwords are stored in the **macOS Keychain** via `keychain.go` (`KeyringStore`), and `config.json` explicitly strips the password field (`config.go` `datasourceRecord`).
- `db_service.go` uses a real **`pgxpool.Pool`** (MaxConns 5) with a stale-pool retry in `acquire()`.

**Impact:** Any contributor or AI assistant reading CLAUDE.md will reason about the wrong security and connection model. **This is the highest-value fix in the review.** (Corrected as part of the docs PR that accompanies this report, since writing ADRs that contradict CLAUDE.md would be incoherent.)

### M2 — Oversized component files hurt readability and testability
**Files:** `Sidebar.tsx` (1646 lines), `ConnectionManager.tsx` (1464), `QueryEditor.tsx` (1040)
These single-component files mix rendering, local state, event wiring, and domain logic. `ConnectionManager.tsx` holds **15 `useState` hooks and zero `useCallback`**. Large files are harder to navigate, review, and unit-test in isolation, and they raise the chance of unintended coupling.
**Suggested direction:** extract sub-components (e.g. tree-node row, connection form sections) and lift pure helpers (validation, formatting) into testable modules. No behavior change required.

### M3 — `App.tsx` is a god component (20 `useState`)
**File:** `App.tsx`
The root component owns nearly all app state: view routing, config, dialogs, history drawer, metadata cache, panel visibility, and connection warnings. This concentrates re-render scope and makes the data flow hard to follow.
**Suggested direction:** group related state into a reducer (e.g. dialog/route state) or a small context, and/or push the connection/metadata lifecycle into a dedicated hook (`useDatasourceSession`).

### M4 — `dsID` is interpolated into file paths without sanitization
**Files:** `db_metadata.go` (`metadataCachePath`), `history_service.go` (`historyFile`), `query_service.go` (`queriesDir`)
Saved-query *filenames* are guarded with `strings.ContainsAny(filename, "/\\")`, but `dsID` is interpolated straight into `filepath.Join(...)` for cache, history, and queries directories. `dsID` is app-generated today (low exploitability), but the inconsistency is a defense-in-depth gap: a malformed or imported config with `dsID` containing `../` would escape `~/.snowy`.
**Suggested direction:** validate `dsID` (UUID/charset allowlist) once at the trust boundary, or reuse the same `ContainsAny` guard.

### M5 — Local files written world-readable (`0644` / `0755`)
**Files:** `config.go`, `db_metadata.go`, `query_service.go`, `history_service.go`, `app.go` (CSV export)
`config.json`, the metadata cache, and history are written `0644` in a `0755` directory. Passwords are no longer in these files (good), but they still contain **host, port, database, and username** — meaningful on shared/multi-user machines. `~/.snowy` and its contents would be better as `0700`/`0600`.
**Suggested direction:** create `~/.snowy` with `0700` and write user-data files with `0600`.

### M6 — Duplicated PK/FK classification SQL, with a slower variant in the hot path
**File:** `db_service.go`
`ListColumns` classifies PK/FK using **correlated `EXISTS` subqueries per column**, while `FetchDatabaseMetadata` (`db_metadata.go`) does the same classification with a faster **CTE + LEFT JOIN**. Two implementations of one rule drift over time, and the per-table path uses the slower form.
**Suggested direction:** share one classification query, preferring the CTE form.

---

## Low findings & nitpicks (documented here; one batched cleanup issue)

- **L1 — UUID heuristic over-matches.** `db_service.go` `ExecuteQuery` formats *any* `[16]byte` value as a UUID string. A non-UUID 16-byte value would be misrendered. Prefer matching on the pgx UUID type / OID.
- **L2 — History is fully read into memory before truncation.** `GetQueryHistory` parses the entire `.jsonl` file then slices to `limit`. Fine now; won't scale to very large history. Consider tail-reading.
- **L3 — Low comment density in large frontend components** relative to their complexity (`ConnectionManager.tsx` 15 comment lines / 1464). Partially addressed by the accompanying comments pass.
- **L4 — Dead template boilerplate.** `frontend/src/App.css` still contains Wails starter CSS (`#logo`, `.input-box`, `.result`) that appears unused. Pre-existing — flag, don't delete blindly.
- **L5 — Magic numbers not centralized.** Pool sizing (`MaxConns = 5`), timeouts (10s/30s/60s), `maxQueryRows = 1000`, and resize clamps (160–480, 120–600) are scattered. Consider a small config block.
- **L6 — `localStorage` keys are inline string literals** (`'snowy.sidebarWidth'`, `'snowy.bottomPanelHeight'`). Centralize to avoid typo-drift.
- **L7 — `useQueryExecution` "live vs pinned" tab logic is intricate and undocumented.** The single-live-tab invariant (`!t.pinned`) is load-bearing and deserves a comment. (Addressed in the comments pass.)
- **L8 — Bundle size.** Production JS is ~698 kB (219 kB gzip) in a single chunk; Vite warns. Code-splitting CodeMirror would help startup, though it matters less for a desktop app.
- **L9 — `ExecuteQuery` 30s context timeout is silent.** Long-running queries are cancelled with a generic context error; a clearer "query exceeded 30s" message would help users.

---

## What's done well (worth preserving)

- **Secrets handling:** Keychain-backed passwords, password-free `config.json`, clear recovery messaging when a Keychain entry is missing.
- **DB hygiene:** parameterized metadata queries, consistent `rows.Close()` + `rows.Err()`, per-call context timeouts, nil-slice→`[]` discipline for the frontend contract.
- **Resilience:** stale-pool detection and one-shot retry in `acquire()`; metadata cached to disk so an unreachable connection still opens with last-known structure.
- **Frontend structure:** hooks isolate concerns (`useTabManager`, `usePanelResize`, `useQueryExecution`); design tokens (`T.*`) keep theming centralized; strong test coverage including e2e.
- **Error ordering:** `SaveConfig`/`UpdateDatasource` write the file before touching the Keychain and document the failure modes inline.
