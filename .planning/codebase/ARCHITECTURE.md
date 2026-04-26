<!-- refreshed: 2026-04-26 -->
# Architecture

**Analysis Date:** 2026-04-26

## Overview

Snowy is a Wails v2 desktop application: a native binary that embeds a React/TypeScript SPA and a Go backend in one process. The Go backend exposes methods to the frontend via Wails' IPC bridge; the frontend calls them through auto-generated JS wrappers. There is no HTTP server, no REST layer, and no separate process — the bridge is synchronous async calls over a WebView IPC channel.

## Component Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend (WebView)                     │
│                                                                  │
│  App.tsx ─ holds all app-wide state (view, tabs, datasources)    │
│     │                                                            │
│     ├── ConnectionManager.tsx  (connections / project list)      │
│     └── Workspace layout                                         │
│          ├── Sidebar.tsx       (schema tree, saved queries)      │
│          ├── TabBar.tsx        (editor tabs)                     │
│          ├── QueryEditor.tsx   (CodeMirror 6 editor)             │
│          └── ResultsPanel.tsx  (result tabs, CSV export)         │
│               └── ResultsTable.tsx  (grid renderer)              │
│          └── HistoryDrawer.tsx (slide-in history panel)          │
│                                                                  │
│  Import via: frontend/wailsjs/go/main/App.js  (auto-generated)  │
└──────────────────────┬──────────────────────────────────────────┘
                       │  window['go']['main']['App'][method]()
                       │  (Wails WebView IPC bridge)
┌──────────────────────▼──────────────────────────────────────────┐
│                     Go Backend (same process)                    │
│                                                                  │
│  main.go       — Wails bootstrap; embeds frontend/dist           │
│  app.go        — App struct; all bound methods; thin facade      │
│     │                                                            │
│     ├── ConfigManager  (config.go)                               │
│     │    └── ~/.snowy/config.json  (projects + datasources)      │
│     │                                                            │
│     ├── DbService  (db_service.go)                               │
│     │    └── pgx.Conn per call → PostgreSQL                      │
│     │    └── sync.Map completion cache (per dsId)                │
│     │                                                            │
│     ├── query_service.go  (package-level funcs, no struct)       │
│     │    └── ~/.snowy/queries/<dsId>/*.sql                       │
│     │                                                            │
│     └── history_service.go  (package-level funcs, no struct)     │
│          └── ~/.snowy/history/<dsId>.jsonl                       │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `App` (Go) | Single Wails-bound struct; routes every frontend call to the right service | `app.go` |
| `ConfigManager` | Read/write `~/.snowy/config.json` under `sync.RWMutex` | `config.go` |
| `DbService` | Open a fresh `pgx.Conn` per query; schema introspection; completion cache | `db_service.go` |
| `query_service` | CRUD for `.sql` files under `~/.snowy/queries/<dsId>/` | `query_service.go` |
| `history_service` | Append-only JSONL history under `~/.snowy/history/<dsId>.jsonl` | `history_service.go` |
| `App.tsx` | Root React component; owns all app state; renders `connections` or `workspace` view | `frontend/src/App.tsx` |
| `ConnectionManager` | Two-column project/datasource manager; test-connection flow | `frontend/src/components/ConnectionManager.tsx` |
| `Sidebar` | Lazy-load schema tree (schemas → tables/views → columns); saved-query list | `frontend/src/components/Sidebar.tsx` |
| `TabBar` | Editor tab strip with dirty-dot indicator; open/close/select | `frontend/src/components/TabBar.tsx` |
| `QueryEditor` | CodeMirror 6 editor; DB-aware autocomplete; `Cmd+Enter` run; `Cmd+S` save | `frontend/src/components/QueryEditor.tsx` |
| `ResultsPanel` | Result tab strip (live + pinned); CSV export; history trigger | `frontend/src/components/ResultsPanel.tsx` |
| `ResultsTable` | Tabular grid of `QueryResult` rows | `frontend/src/components/ResultsTable.tsx` |
| `HistoryDrawer` | Slide-in right panel listing `HistoryEntry` records | `frontend/src/components/HistoryDrawer.tsx` |

## Data Flow

### Primary Query Execution Path

1. User types SQL in `QueryEditor` (`frontend/src/components/QueryEditor.tsx`) — `onChange` fires `updateActiveTab({ sql, dirty: true })` in `App.tsx`
2. User presses `Cmd+Enter` or clicks Execute → `onRun(sql)` → `App.tsx:handleRunQuery`
3. `handleRunQuery` calls `GoApp.ExecuteQuery(activeDatasourceId, sql)` — resolves via `window['go']['main']['App']['ExecuteQuery']` IPC bridge (`frontend/wailsjs/go/main/App.js`)
4. Wails routes to `App.ExecuteQuery` (`app.go:70`) → `DbService.ExecuteQuery` (`db_service.go:249`)
5. `DbService` opens fresh `pgx.Conn`, runs query, scans `rows.Values()`, closes connection, returns `*QueryResult`
6. Result JSON crosses IPC bridge back to `handleRunQuery`; live result tab is updated: `setResultTabs(...)` (`App.tsx:327`)
7. Non-blocking `RecordHistory` call appends to `~/.snowy/history/<dsId>.jsonl` (`history_service.go:43`)
8. `ResultsPanel` + `ResultsTable` re-render with new data

### Schema Tree Lazy-Load Path

1. Sidebar mounts with `datasourceId` → `loadSchemas()` calls `GoApp.ListSchemas(dsId)` (`Sidebar.tsx:195`)
2. User expands a schema → `toggleSchema()` calls `GoApp.ListTables(dsId, schemaName)` (`Sidebar.tsx:220`)
3. User expands a table → `toggleTable()` calls `GoApp.ListColumns(dsId, schema, table)` (`Sidebar.tsx:247`)
4. Each call: `App` → `DbService.getConnection(dsId)` → fresh `pgx.Conn` → `information_schema` query → close conn → return

### Connection Manager → Workspace Transition

1. User clicks "Connect" in `ConnectionManager` → `onConnect(dsId)` → `App.tsx:handleConnect`
2. `handleConnect` sets `activeDatasourceId`, resets tab/result state, switches `view` to `'workspace'`
3. Simultaneously fetches `ListSavedQueries` and `GetCompletions` for the new datasource
4. `GetCompletions` result is passed as `completions` prop into `QueryEditor`, which reconfigures the CodeMirror SQL extension via `sqlCompartment.reconfigure()`

### Config Persistence Path

1. `ConnectionManager` calls `onSaveAll(projects, datasources)` → `App.tsx:handleSaveAll` → `GoApp.SaveConfig(config)`
2. `ConfigManager.SaveConfig` acquires write lock, marshals to JSON, writes `~/.snowy/config.json` (`config.go:83`)
3. Single-datasource edits use `UpdateDatasource(ds)` → `ConfigManager.UpdateDatasource` for in-place replacement

## State Management

All application state lives in `App.tsx` as local React `useState` hooks. There is no external store (no Zustand, Redux, or Context). State is passed downward as props and mutated via callbacks.

**Key state atoms in `App.tsx`:**

| State | Type | Purpose |
|-------|------|---------|
| `view` | `'connections' \| 'workspace'` | Which top-level screen is rendered |
| `projects` / `datasources` | arrays | Config data, mirrors `~/.snowy/config.json` |
| `activeDatasourceId` | `string \| null` | Currently connected datasource |
| `tabs` | `Tab[]` | Open editor tabs; each holds `{ id, label, filename, sql, dirty }` |
| `activeTabId` | `string \| null` | Active editor tab |
| `resultTabs` | `ResultTab[]` | Live + pinned result sets |
| `activeResultTabId` | `string` | Which result tab is displayed |
| `completions` | `CompletionEntry[]` | DB-aware autocomplete entries for active DS |
| `savedQueries` | `{ filename }[]` | Sidebar saved-query list for active DS |
| `historyEntries` / `historyOpen` | array / bool | Query history drawer content + visibility |

`Sidebar` manages its own internal tree state (`SchemaNode[]`) independently — it receives `datasourceId` and re-fetches when it changes.

`QueryEditor` manages a `useRef<EditorView>` internally, syncing external `sql` prop changes via `isProgrammatic` guard to avoid feedback loops.

## Key Design Decisions

**1. Fresh connection per call (no pool)**
Every `DbService` method calls `getConnection(dsId)` which dials a new `pgx.Conn` and closes it via `defer`. This means each backend call — including introspection and query execution — pays TCP handshake overhead. Intentional trade-off for Sprint 1–6 simplicity; connection pooling is not in scope yet.

**2. Single Wails-bound struct**
`App` is the only struct registered in `main.go`'s `Bind` slice. All backend capabilities are exposed as methods on it. Sub-services (`ConfigManager`, `DbService`) are never directly bound — `App` acts as a facade.

**3. Package-level service functions**
`query_service.go` and `history_service.go` expose functions (not struct methods). `App` calls them directly: `SaveQuery(...)`, `RecordHistory(...)`. These have no state beyond the filesystem.

**4. Completion cache in-process**
`DbService.completionCache` is a `sync.Map` keyed by `dsId`. It is populated on first `GetCompletions` call per datasource and never invalidated during the process lifetime. Cache resets on app restart.

**5. Plaintext password storage**
`Datasource.Password` is stored as plaintext in `~/.snowy/config.json`. Keychain integration is planned post-Sprint 6 (see `config.go:18`).

## Anti-Patterns

### Wails bridge called directly by leaf components

**What happens:** `Sidebar.tsx` imports and calls `GoApp.ListSchemas`, `GoApp.ListTables`, `GoApp.ListColumns` directly rather than receiving data via props from `App.tsx`.
**Why it's wrong:** It bypasses `App.tsx` state management, makes the component harder to test (requires mocking the bridge), and means schema state is siloed inside `Sidebar` rather than being available to other components.
**Do this instead:** Lift schema fetching into `App.tsx`, pass data as props, follow the pattern used for `savedQueries` and `completions`.

### Duplicate type definitions

**What happens:** `Project` and `Datasource` types are defined both in `frontend/src/types.ts` and re-declared locally in `frontend/src/App.tsx` (lines 68–84).
**Why it's wrong:** Divergence risk; `ConnectionManager` imports from `types.ts` while `App.tsx` uses its local copy.
**Do this instead:** Remove the local declarations in `App.tsx` and import from `frontend/src/types.ts` throughout.

## Error Handling

**Backend:** Methods return `(value, error)`. Errors propagate to the frontend as rejected Promises. No structured error types — all errors are `fmt.Errorf` strings.

**Frontend:** `handleRunQuery` and similar handlers use `try/catch`. Errors surface as `alert()` calls (`App.tsx:339`). `Sidebar` logs errors to `console.error` without user feedback. `WorkspaceErrorBoundary` (`App.tsx:5`) catches rendering exceptions in the workspace and shows a retry screen.

## Cross-Cutting Concerns

**Logging:** `console.error` / `console.warn` on the frontend. No structured logging on the backend (no `slog` usage yet despite roadmap intention).
**Validation:** Filename path-traversal guard in `query_service.go` (`strings.ContainsAny(filename, "/\\")`). No input validation on SQL or connection params beyond pgx's own handling.
**Authentication:** None — the app is a local desktop tool; PostgreSQL credentials are passed through directly.

---

*Architecture analysis: 2026-04-26*
