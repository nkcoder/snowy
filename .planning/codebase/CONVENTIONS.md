# Conventions

This document describes the coding conventions used across the Snowy codebase (Go backend + React/TypeScript frontend).

---

## Go Backend

### Package structure

All Go source files live in the root `package main`. There is no internal sub-package layout. Each logical concern gets its own file:

| File | Responsibility |
|------|---------------|
| `main.go` | Wails bootstrap and embed directive |
| `app.go` | `App` struct — thin delegation layer exposed to the frontend via Wails bindings |
| `config.go` | `ConfigManager`, `Config`, `Project`, `Datasource` structs |
| `db_service.go` | `DbService` — all PostgreSQL calls; also defines `SchemaItem`, `TableItem`, `ColumnItem`, `QueryResult`, `CompletionSet`, `CompletionEntry` |
| `query_service.go` | File-system helpers for saved queries (`SaveQuery`, `ListSavedQueries`, `LoadSavedQuery`, `DeleteSavedQuery`, `RenameQuery`) |
| `history_service.go` | JSONL-based query history (`RecordHistory`, `GetQueryHistory`, `HistoryEntry`) |

### Naming

- Exported types use `PascalCase`; fields use `PascalCase` with JSON tags in `camelCase` (e.g. `ProjectID string \`json:"projectId"\``).
- Unexported helpers use `camelCase` (e.g. `queriesDir`, `historyFile`, `getConnection`).
- Test helpers that create fixtures are prefixed with `new` or `make` (e.g. `newTestConfigManager`, `writeConfig`, `setupQueriesDir`).
- Test functions follow the pattern `Test<Type>_<Scenario>` (e.g. `TestUpdateDatasource_NotFound`).

### Error handling

- Functions return `error` as the last return value; callers check immediately.
- Errors are wrapped with context using `fmt.Errorf("list schemas: %w", err)` where the wrapping adds useful location info.
- `app.go` panics on startup if `ConfigManager` cannot be initialised (fail fast; a nil manager would panic anyway on first use).

### Concurrency

- `ConfigManager` protects its config file with `sync.RWMutex`: read lock for `LoadConfig`, write lock for `SaveConfig` and `UpdateDatasource`.
- `DbService` caches completions in a `sync.Map` (key: `dsId`, value: `*CompletionSet`). Cache is per-process; invalidated on restart.
- Each database call creates and closes its own `pgx.Conn` — there is no connection pool. All connections use a 10-second `context.WithTimeout`.

### Database access

- Connection strings are built as `postgres://<user>:<pass>@<host>:<port>/<db>?sslmode=<mode>`.
- `SSLMode` defaults to `"disable"` if the field is empty.
- Queries always use `information_schema` views (not `pg_catalog` directly) and exclude system schemas (`information_schema`, `pg_catalog`, `pg_toast`).
- Parameterised queries use `$1`, `$2` positional placeholders (pgx convention).
- `rows.Close()` and `cancel()` are always deferred immediately after being obtained.

### File paths

- Config file: `~/.snowy/config.json`
- Saved queries: `~/.snowy/queries/<dsId>/<filename>.sql`
- Query history: `~/.snowy/history/<dsId>.jsonl`
- Directories are created with `os.MkdirAll(dir, 0755)`; files are written with mode `0644`.
- Filenames are validated against path-separator characters (`/` and `\`) before use.

### Wails binding contract

Any `App` method callable from the frontend must be exported and present in the `Bind` slice in `main.go`. Wails auto-generates `frontend/wailsjs/go/main/App.js` — **never edit that file by hand**.

---

## Frontend (React + TypeScript)

### Directory layout

```
frontend/src/
  App.tsx               — app-wide state; renders project-selector | datasources | workspace
  types.ts              — shared domain interfaces (Project, Datasource) mirroring Go structs
  lib/
    tokens.ts           — design token constants (T, PROJECT_COLORS, ENV_COLORS)
  components/
    *.tsx               — one component per file
    *.test.tsx          — co-located unit tests
    ui/                 — generic primitives (buttons, inputs, etc.)
  test/
    setup.ts            — global test setup (@testing-library/jest-dom)
    mocks/
      wailsjs.ts        — vi.fn() stubs for all Go bindings (used via vitest alias)
```

### Component conventions

- Components are named exports (`export function Foo`), not default exports.
- Props interfaces are declared inline at the top of each component file; shared domain types live in `types.ts`.
- `data-testid` attributes are added to every interactive element and every key container that tests need to locate:
  - Buttons: `btn-<action>-<id>` (e.g. `btn-connect-d1`, `btn-delete-project-p1`)
  - Inputs: `field-<name>` (e.g. `field-host`, `field-password`)
  - Rows / items: `<type>-row-<id>` or `<type>-item-<id>` (e.g. `ds-row-d1`, `project-item-p1`)
  - Folder nodes: `folder-<name>` (e.g. `folder-queries`, `folder-schemas`)
  - Result areas: descriptive IDs like `result-tab-strip`, `cm-editor`, `tab-bar`

### State management

Local React state only (`useState`, `useEffect`). No global store (Zustand is deferred until complexity warrants it). App-wide state lives in `App.tsx` and is passed down as props.

### Styling

- Tailwind CSS utility classes exclusively — no component-level CSS modules.
- Design tokens from `lib/tokens.ts` are used for colours; never hardcode hex/oklch values inline.
- Dark theme constants: `bg: #1a1917`, `chrome: #252320`, `panel: #1f1d1b`, `sidebar: #1d1b19`, `accent: oklch(0.62 0.17 240)`, `text: #ecebe8`, `dim: #6e6a62`.
- Font stacks: UI font is SF Pro / system-ui; code font is SF Mono / JetBrains Mono.

### Wails bridge imports

Go bindings are always imported from `../../wailsjs/go/main/App` (relative to the component file location). The import is aliased as `* as GoApp` in tests and sometimes in components.

### TypeScript

- Strict mode is on. Avoid `any` except where interfacing with untyped Wails data.
- Domain types (interfaces) mirror Go structs exactly, including field names and JSON casing (Go uses `json:"camelCase"`; TypeScript interface fields are `camelCase` without decoration).
- `as const` is used on token objects to get literal types.

---

## Design reference

All UI follows the DataGrip-inspired warm graphite dark theme defined in `spec/designs/project/`. Full screen designs are in `spec/designs/project/Snowy.html`. Token definitions are in `spec/designs/project/components/tokens.jsx`.
