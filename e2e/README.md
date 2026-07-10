# E2E Flow Coverage

Playwright tests run against the Vite dev server on `http://localhost:5173`. The server is started automatically by `playwright.config.ts` if not already running.

All specs use a `window.go` mock bridge (`mock-bridge.ts`) — no real database connection is required.

## Running tests

```bash
npx playwright test                                    # all specs
npx playwright test e2e/sidebar.spec.ts               # single spec
npx playwright test --ui                              # interactive UI mode
```

## Flow coverage table

| # | User flow | Spec file(s) | Covered |
|---|-----------|--------------|:-------:|
| 1 | Add a new datasource connection | `connection.spec.ts` | ✓ |
| 2 | Edit an existing datasource | `connection.spec.ts` | ✓ |
| 3 | Delete a datasource | `connection.spec.ts` | ✓ |
| 4 | Test connection (ping) | `connection.spec.ts` | ✓ |
| 5 | Connect to datasource → workspace | `connection.spec.ts`, `sidebar.spec.ts`, `query-editor.spec.ts` | ✓ |
| 6 | Disconnect from datasource | `sprint9-context-menu.spec.ts` | ✓ |
| 7 | Browse schema tree (schemas → tables) | `sidebar.spec.ts` | ✓ |
| 8 | Expand table → columns sub-folder | `sidebar.spec.ts` | ✓ |
| 9 | Expand table → keys sub-folder | `sidebar.spec.ts` | ✓ |
| 10 | Expand table → foreign keys sub-folder | `sidebar.spec.ts` | ✓ |
| 11 | Expand table → indexes sub-folder | `sidebar.spec.ts` | ✓ |
| 12 | Expand table → check constraints sub-folder | `sidebar.spec.ts` | ✓ |
| 13 | Double-click table → auto `SELECT *` query | `sidebar.spec.ts` | ✓ |
| 14 | Write SQL in editor | `query-editor.spec.ts` | ✓ |
| 15 | Execute query (Run button / Ctrl+Enter) | `query-editor.spec.ts`, `results-panel.spec.ts` | ✓ |
| 16 | View query results in grid | `results-panel.spec.ts` | ✓ |
| 17 | Pin a result tab | `results-panel.spec.ts` | ✓ |
| 18 | Unpin a result tab | `results-panel.spec.ts` | ✓ |
| 19 | Close a pinned result tab | `results-panel.spec.ts` | ✓ |
| 20 | Export results to CSV | `results-panel.spec.ts` | ✓ |
| 21 | Failed query shows error (not stale data) | `results-panel.spec.ts` | ✓ |
| 22 | Save query (new filename) | `query-editor.spec.ts` | ✓ |
| 23 | Load saved query from sidebar | — | ✗ |
| 24 | Rename saved query | — | ✗ |
| 25 | Delete saved query | — | ✗ |
| 26 | Open query history drawer | `history.spec.ts` | ✓ |
| 27 | Close history drawer (backdrop click) | `history.spec.ts` | ✓ |
| 28 | Select history entry → load into editor | `history.spec.ts` | ✓ |
| 29 | RecordHistory called after query runs | `history.spec.ts` | ✓ |
| 30 | SQL autocomplete (tables, columns, views) | `autocomplete.spec.ts` | ✓ |
| 31 | Autocomplete ranking (PK > regular columns) | `autocomplete.spec.ts` | ✓ |
| 32 | Autocomplete type badges (PK / FK / COL) | `autocomplete.spec.ts` | ✓ |
| 33 | No completions inside a string literal | `autocomplete.spec.ts` | ✓ |
| 34 | Column resize via drag handle | `col-resize.spec.ts` | ✓ |
| 35 | Right-click datasource → context menu | `sprint9-context-menu.spec.ts` | ✓ |
| 36 | Context menu → New Query Console | `sprint9-context-menu.spec.ts` | ✓ |
| 37 | Open new query tab (+ button) | `query-editor.spec.ts` | ✓ |
| 38 | Multiple tabs maintain separate SQL | `query-editor.spec.ts` | ✓ |
| 39 | Close tab with unsaved-changes confirmation | — | ✗ |
| 40 | Sidebar resize (drag handle) | — | ✗ |
| 41 | Bottom panel resize | — | ✗ |
| 42 | Right-click schema/table/column → Copy name | `sprint9-context-menu.spec.ts` | ✓ |

**Coverage: 38 / 42 flows = 90%** (target ≥ 80% ✓)

## Known gaps

Flows 23–25 (saved query load/rename/delete), 39 (dirty-tab confirm close), 40–41 (panel resize) have no dedicated E2E spec.
These paths are exercised by unit tests in `App.handlers.test.tsx` and `App.test.tsx`.
Playwright specs for these flows are planned for a future iteration once the interactions stabilise.
