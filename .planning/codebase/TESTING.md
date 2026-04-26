# Testing

Snowy has three layers of tests: Go unit tests, frontend component tests (Vitest + React Testing Library), and end-to-end browser tests (Playwright).

---

## Go unit tests

### Running

```bash
# From the repo root
go test ./...

# Verbose output
go test -v ./...

# Single file / function
go test -run TestUpdateDatasource ./...
```

### What is covered

| File | Covers |
|------|--------|
| `config_test.go` | `ConfigManager`: create default config, load/save round-trip, invalid JSON, concurrent reads and writes, `UpdateDatasource` happy path and error cases |
| `query_service_test.go` | `SaveQuery`, `LoadSavedQuery`, `ListSavedQueries`, `DeleteSavedQuery`, `RenameQuery`; `.sql` extension auto-append; path-traversal rejection |
| `history_service_test.go` | `RecordHistory` / `GetQueryHistory`: ordering (newest first), limit, field values, error when history dir is blocked |

### Test helper patterns

- **Isolated temp dirs**: every test that touches the filesystem uses `t.TempDir()`. The helper `newTestConfigManager(t)` wires a `ConfigManager` to a temp path.
- **Home override**: tests that call `queriesDir()` or `historyDir()` (which resolve `os.UserHomeDir()`) override the `HOME` environment variable using either `os.Setenv` with a manual restore closure or `t.Setenv` (preferred — automatically restored on cleanup).
- **Direct struct construction**: tests create `ConfigManager{configPath: <tempPath>}` directly rather than calling `NewConfigManager()`, bypassing the real home directory entirely.
- **Fixture helper `writeConfig`**: serialises a `Config` struct directly to the manager's config file, bypassing the mutex (safe because tests run sequentially unless explicitly testing concurrency).
- **Concurrency tests**: use `sync.WaitGroup` and a buffered `chan error` to detect race conditions. Run with `-race` flag for full data-race detection: `go test -race ./...`.

---

## Frontend unit tests (Vitest)

### Running

```bash
cd frontend

npm test               # run once
npm run test:watch     # watch mode
npm run test:coverage  # with v8 coverage report
```

### Configuration

`frontend/vitest.config.ts`:
- Environment: `jsdom`
- Globals: `true` (no need to import `describe`/`it`/`expect`)
- Setup file: `src/test/setup.ts` (imports `@testing-library/jest-dom` matchers)
- Include pattern: `src/**/*.{test,spec}.{ts,tsx}`
- Alias: `frontend/wailsjs/go/main/App` is remapped to `src/test/mocks/wailsjs.ts` for all tests — components never hit the real Wails bridge

### Mocking the Go bridge

The Wails bridge (`wailsjs/go/main/App`) is an auto-generated module that does not exist in jsdom. All tests rely on a single vitest alias defined in `vitest.config.ts` that redirects every import to `src/test/mocks/wailsjs.ts`, which exports `vi.fn()` stubs with sensible defaults:

```ts
// src/test/mocks/wailsjs.ts
export const ListSchemas = vi.fn().mockResolvedValue([]);
export const ExecuteQuery = vi.fn().mockResolvedValue({ Columns: [], Rows: [] });
// ...all other Go methods
```

Individual test files override specific stubs using `vi.mocked(GoApp.ListSchemas).mockResolvedValue([...])` inside `beforeEach` blocks.

Some tests also add a local `vi.mock('../../wailsjs/go/main/App', ...)` call at the module level. Because the vitest alias is path-based (resolves to the same file), these two approaches are compatible — the local mock wins for that test file.

### Mocking CodeMirror

`QueryEditor.test.tsx` mocks the entire `@codemirror/*` package stack because jsdom does not implement `contenteditable` or `ResizeObserver`. The mocks expose a fake `EditorView` class with a `dom` property and a `state.doc.toString()` stub, allowing toolbar behaviour to be tested without a real editor instance.

### Component test patterns

Every component test file follows this structure:

1. **Module-level `vi.mock`** for the Go bridge (if the component imports it directly).
2. **Fixture factory functions** — e.g. `makeDs(overrides)`, `makeTab(overrides)` — that return fully typed objects with sensible defaults, accepting `Partial<T>` overrides.
3. **`renderXxx(overrides)` wrapper** that calls `render(<Component .../>)` and returns the spy functions so tests can assert on them.
4. **`beforeEach(() => vi.clearAllMocks())`** at the top of each `describe` block.
5. Assertions use `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveValue`, `toBeDisabled`, etc.) and `waitFor` for async state updates.
6. User interactions go through `@testing-library/user-event` (`userEvent.click`, `userEvent.type`, `userEvent.selectOptions`) rather than `fireEvent` for realistic event simulation; `fireEvent` is used only for simpler synchronous cases.

### Covered components

| Test file | Component | Key scenarios |
|-----------|-----------|---------------|
| `ConnectionManager.test.tsx` | `ConnectionManager`, `ConnectionForm`, `FieldInput`, `SelectInput` | CRUD flows, validation, test-connection result, password reveal, project switching, confirm dialogs |
| `Sidebar.test.tsx` | `Sidebar` | Schema/table/column lazy loading, expand/collapse, search filter, saved queries list, rename inline edit, refresh button |
| `QueryEditor.test.tsx` | `QueryEditor` | Toolbar render, run/save/clear button callbacks, loading state disables run, CodeMirror container presence |
| `TabBar.test.tsx` | `TabBar` | Tab render, select, close, new-tab button, dirty indicator |
| `smoke.test.ts` | `lib/tokens` | Token export sanity check |

---

## End-to-end tests (Playwright)

### Running

```bash
# From the repo root (Playwright is installed at root level)
npx playwright test

# Headed (watch the browser)
npx playwright test --headed

# Single spec
npx playwright test e2e/sprint6-results-history.spec.ts
```

### Configuration

`playwright.config.ts` (repo root):
- `testDir`: `./e2e`
- `baseURL`: `http://localhost:5173`
- `webServer`: runs `cd frontend && npm run dev` and waits for the Vite dev server
- `reuseExistingServer: true` — if the dev server is already running, tests reuse it
- `workers: 1`, `fullyParallel: false` — tests run serially to avoid port conflicts
- Browser: Chromium only

### Mock bridge

The Wails runtime (`window.go`) is not present in the browser during e2e tests (the app runs as a plain Vite dev server without the Go binary). `e2e/mock-bridge.ts` provides:

- `mockConfig` — one demo project and one datasource matching the local Docker PostgreSQL instance
- `mockCompletions` — tables and columns matching the demo database schema
- `mockQueryResult` — two-row users result with `durationMs: 42`
- `mockHistoryEntries` — two pre-recorded history entries
- `buildMockBridgeScript(config, completions, queryResult, historyEntries)` — serialises all mocks into an inline JS string that sets `window.go.main.App.*` before the page loads

Each test file calls `page.addInitScript(buildMockBridgeScript(...))` in a `beforeEach` hook.

The bridge mock tracks calls on specific methods (e.g. `RecordHistory` writes to `window.__recordedHistory`) so tests can assert that the frontend called the backend correctly.

### Navigation helper pattern

Each e2e spec defines a `connectToWorkspace(page)` helper that:
1. Navigates to `/`
2. Waits for and clicks the demo project item
3. Waits for and clicks the `btn-connect-ds-1` button
4. Waits for the `cm-editor` container to appear

This avoids duplicating the connection flow in every test.

### Covered sprints

| Spec file | Sprint | Key scenarios |
|-----------|--------|---------------|
| `sprint5-autocomplete.spec.ts` | Sprint 5 | Editor loads, `GetCompletions` called on connect, autocomplete popover, `Cmd+Enter` runs query, multi-tab SQL isolation, save query appears in sidebar |
| `sprint6-results-history.spec.ts` | Sprint 6 | Result tab shows row count + duration, tab label increments, pin creates extra tab, history drawer opens/closes, clicking history entry loads SQL into editor, CSV export button state |

### Demo database

The local PostgreSQL instance used for manual verification (not required for automated tests, which use the mock bridge):

```
Host:     localhost
Port:     5432
Database: mydatabase
User:     myuser
Password: mypassword
```

Start with:

```bash
cd docker && docker compose -f docker-compose-postgresql.yml up -d
```

---

## Coverage

Frontend coverage is generated with v8:

```bash
cd frontend && npm run test:coverage
# HTML report: frontend/coverage/index.html
```

Coverage excludes `src/test/**`, `src/main.tsx`, and `src/vite-env.d.ts`.

Go coverage:

```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```
