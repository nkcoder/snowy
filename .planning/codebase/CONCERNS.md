# Concerns

Technical debt, risks, known limitations, and areas needing attention.

---

## Critical Issues

### 1. Non-atomic Config File Writes — Risk of Corruption on Crash
Both `SaveConfig` and `UpdateDatasource` in `config.go` write directly to `~/.snowy/config.json` via `os.WriteFile`. If the process is killed mid-write, the file is left partially written and unreadable. The correct approach is write-to-temp-file then `os.Rename` (atomic on same filesystem). `history_service.go` also does not call `f.Sync()` before close, so buffered data may not reach disk on crash.

### 2. `dsId` Is Never Validated — Path Traversal via Datasource ID
`dsId` flows directly into `filepath.Join` in `queriesDir` (`query_service.go:16`) and `historyFile` (`history_service.go:39`) without sanitisation. A datasource ID containing `../../` segments (user-settable via the connection form) would write files outside the intended directory. Filenames for `SaveQuery`/`RenameQuery` are checked for `/\` but `dsId` is not guarded at all.

### 3. `rows.Err()` Never Checked After Row Iteration Loops
All four `for rows.Next()` loops in `db_service.go` call `defer rows.Close()` but never call `rows.Err()` after the loop. pgx's `rows.Err()` can surface network or server errors during row iteration; ignoring it means partial results are returned as success.

### 4. `app.go` Panics on Config Manager Init Failure
`NewApp` in `app.go:24` calls `panic(...)` if `NewConfigManager` fails. On a desktop app this crashes silently with no user-visible error dialog. A graceful startup error surface (Wails dialog) would be more appropriate.

### 5. Missing `data-testid="result-tab-strip"` — Broken E2E Assertion
`e2e/sprint6-results-history.spec.ts:110` locates `[data-testid="result-tab-strip"]` but `ResultsPanel.tsx` never sets that attribute. The test silently passes because it only checks `if (await resultTabStrip.isVisible())` — the assertion never fires. Broken test masquerading as passing.

---

## Security Concerns

### 1. Passwords Stored Plaintext in `~/.snowy/config.json`
`config.go:18` stores passwords unencrypted with `0644` permissions. Any process running as the same user can read all database credentials. macOS Keychain integration is noted as post-Sprint-6 but the risk exists in production usage now.

### 2. Password Exposed in `fmt.Sprintf` Connection String
`db_service.go:81` and `app.go:133` construct `postgres://user:password@host/db` via `fmt.Sprintf`. Passwords containing URL-special characters (`@`, `/`, `#`, `?`, `%`, `+`) will silently corrupt the connection string. pgx accepts `pgx.ParseConfig` with `Password` set as a field, avoiding URL-encoding issues entirely.

### 3. History File Contains Full SQL of Every Query
`~/.snowy/history/<dsId>.jsonl` persists every SQL statement including those that embed sensitive data (e.g. `INSERT INTO users VALUES ('Alice', 'secret')`). No retention limit, no automatic purge, no clear-history operation.

### 4. Config Directory and File Permissions Too Permissive
`os.MkdirAll(configDir, 0755)` and `os.WriteFile(..., 0644)` mean both directory and config file (containing plaintext passwords) are readable by all users on a shared system. Should be `0700` and `0600` respectively.

### 5. No Input Validation on `dsId` in File Paths
As noted in Critical Issues, `dsId` accepted from the frontend without validation can escape designated directories.

---

## Performance Concerns

### 1. Fresh TCP Connection Per Every DB Operation — No Connection Pooling
Every call to `ListSchemas`, `ListTables`, `ListColumns`, `ExecuteQuery`, and `GetCompletions` opens a new `pgx.Conn`, performs TLS/auth handshake, then closes it. Adds ~50–200 ms latency per sidebar expand and query execution. A `pgxpool` would amortise this cost significantly.

### 2. Entire Query Result Set Loaded into Memory
`ExecuteQuery` in `db_service.go:271` buffers all rows into `[][]interface{}` before returning. A `SELECT * FROM large_table` with millions of rows will exhaust memory and block the UI. No server-side `LIMIT` enforcement exists.

### 3. `ResultsTable` Renders All Rows Without Virtualisation
`ResultsTable.tsx:73` renders every row as a DOM `<tr>`. Large result sets (50 000+ rows) produce tens of thousands of DOM nodes, causing the WebView to freeze. No windowed/virtualised list (`react-window`, `@tanstack/virtual`) is used.

### 4. `GetQueryHistory` Reads Entire File on Every Call
`history_service.go:69` reads and parses every line of the `.jsonl` file, reverses the slice, then truncates to `limit`. As history grows (no cap), this becomes progressively slower.

### 5. Completion Cache Never Invalidated Within a Session
`completionCache sync.Map` in `db_service.go:51` is only evicted on process restart. Schema changes made during a session (CREATE TABLE, DROP INDEX) will show stale autocomplete data until restart.

---

## Technical Debt

### 1. `App.tsx` Is a 490-Line God Component
Manages all app state (projects, datasources, tabs, result tabs, history, completions) plus all event handlers in one component. State should be extracted into custom hooks (`useEditorTabs`, `useResultTabs`, `useQueryHistory`).

### 2. Multiple `(GoApp as any)` Casts Indicate Stale Wails Bindings
`App.tsx:153,239,335` cast `GoApp` to `any` to call `UpdateDatasource`, `GetQueryHistory`, and `RecordHistory`. The auto-generated `wailsjs/go/main/App.js` bindings are out of date or TypeScript types are missing. These casts defeat type safety and hide signature mismatches until runtime.

### 3. Design Tokens Duplicated Between `tokens.ts` and `App.tsx`
`App.tsx:89–99` redeclares `chrome`, `border`, `accent`, `textSec`, etc. as local constants, duplicating `frontend/src/lib/tokens.ts`. Token updates require changes in two places.

### 4. History IDs Are Nanosecond Timestamps — Collision-Prone
`history_service.go:49` generates `ID` as `fmt.Sprintf("%d", time.Now().UnixNano())`. Two `RecordHistory` calls within the same nanosecond produce duplicate IDs. Should use UUID (dependency already transitively available).

### 5. No Structured Logging
Roadmap mandates `log/slog` but zero logging calls exist in production code. Errors are only surfaced to the frontend as return values; no audit trail of DB operations, connection attempts, or file I/O errors.

### 6. Commented-Out `replace` Directive in `go.mod`
`go.mod:43` contains a commented-out local `replace` directive — development leftover that should be cleaned up.

### 7. Five Non-Functional Sidebar Toolbar Buttons
`Sidebar.tsx` has `ToolBtn` elements for "Data source properties", "Stop", "Jump to table", "Show DDL", "Diagram", "Preview" with no `onClick` handlers — clickable controls that do nothing.

### 8. `ResultsTable` Filter/Sort Buttons Are Dead UI
`ResultsTable.tsx:39–42` renders `Filter`, `ListFilter`, and `Download` icon buttons with no `onClick` handlers. The Download button in `ResultsPanel.tsx` is functional; the one in `ResultsTable` is not.

### 9. SSH / TLS / Schemas / Advanced Tabs Entirely Stubbed
`ConnectionManager.tsx:374–377` renders "Not yet implemented" for all tabs other than General. Shown with lowered opacity but remain interactive, creating confusing UX for SSL/TLS configuration.

---

## Missing Error Handling

### 1. `handleRunQuery` Surfaces Errors via `alert()`
`App.tsx:339` calls `alert('Query failed: ' + err)`, a blocking native dialog. Should be inline error state in the results panel, consistent with the design system.

### 2. `window.confirm` and `window.prompt` for Critical Flows
`window.confirm` used for tab-close dirty-check (line 173); `window.prompt` used for naming saved queries (line 301). Unstyled, disrupt UX, untestable by Playwright without `page.on('dialog', ...)`. A styled `ConfirmDialog` already exists in `ConnectionManager.tsx` and should be generalised.

### 3. `handleSaveAll` and `handleUpdateDs` Don't Catch Errors
`App.tsx:146–155` calls `GoApp.SaveConfig` and `GoApp.UpdateDatasource` without `.catch()` or `try/catch`. A failed config write silently leaves UI and disk state out of sync.

### 4. `loadConfig` Catch Block Only Logs to Console
`App.tsx:141` catches config load errors with `console.error` but leaves the app in blank state with no user-visible indication. On startup failure (corrupted JSON), user sees an empty white screen.

### 5. No Query Cancellation Path
`db_service.go:80` creates `context.WithTimeout(context.Background(), 10s)` internally. No way for the frontend to cancel an in-progress query. The "Stop" button in the sidebar does nothing. Long-running queries block for up to 10 seconds with no user escape.

### 6. `GetQueryHistory` Silently Skips Corrupt JSONL Lines
`history_service.go:94` discards malformed JSON entries with `continue` and no logging. A mid-write disk failure that corrupts a line causes silent history loss.

---

## Roadmap Gaps

### 1. No Integration Tests for `db_service.go`
The most critical backend file has zero tests. `config_test.go`, `query_service_test.go`, and `history_service_test.go` exist but there are no integration tests for `ListSchemas`, `ListTables`, `ListColumns`, `ExecuteQuery`, or `GetCompletions` against the demo PostgreSQL instance in `docker/docker-compose-postgresql.yml`.

### 2. History File Grows Unbounded
`~/.snowy/history/<dsId>.jsonl` is append-only with no size cap, entry count limit, or age-based pruning. No history management UI (clear all, delete entry) is implemented.

### 3. CSV Export Uses Browser `<a download>` Trick, Not `runtime.SaveFileDialog`
`ResultsPanel.tsx:44–51` uses a browser anchor download hack. Sprint 6 roadmap specified `runtime.SaveFileDialog` (Wails native file picker). Current implementation downloads to browser's default directory with no user choice.

### 4. No Schema Refresh After DDL Execution
Running `CREATE TABLE` or `DROP INDEX` via the editor does not invalidate the sidebar schema cache or completion cache. User must manually click refresh.

### 5. No Per-Query Execution Timeout
The 10-second timeout in `getConnection` applies to connection phase only. Once connected, `conn.Query` runs until server closes or WebView context expires. Long-running `SELECT` blocks indefinitely.

### 6. `⌘K` / `⌘F` Sidebar Search Shortcut Not Wired
Sidebar search bar displays `⌘F` hint but no global keyboard shortcut focuses it. Sprint 2 spec mentioned `⌘K`; neither shortcut is implemented.

### 7. Wails `BackgroundColour` Doesn't Match Design Tokens
`main.go:22` sets `BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1}` (blue-grey), but design token `bg` is `#1a1917` (warm graphite). Causes a visible colour flash during startup before WebView renders.

### 8. No Multi-Connection Workspace
Only one datasource active at a time. Switching requires returning to connection manager, losing all open tabs. Not currently scheduled in roadmap.
