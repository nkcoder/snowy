# Structure

## Root Directory

```
/Users/jasmine/Projects/snowy/
├── main.go                        # Wails bootstrap; embeds frontend/dist; registers App bindings
├── app.go                         # App struct; all Go methods exposed to the frontend (145 lines)
├── config.go                      # ConfigManager; reads/writes ~/.snowy/config.json; Project + Datasource structs (130 lines)
├── db_service.go                  # DbService; pgx connection per call; schema/table/column introspection + query execution (287 lines)
├── history_service.go             # HistoryService; appends/reads ~/.snowy/history/<dsId>.jsonl (111 lines)
├── query_service.go               # QueryService; saves/loads/lists/deletes SQL files at ~/.snowy/queries/<dsId>/ (104 lines)
├── config_test.go                 # Unit tests for ConfigManager
├── history_service_test.go        # Unit tests for HistoryService
├── query_service_test.go          # Unit tests for QueryService
├── go.mod                         # Go module (snowy); requires wails/v2 v2.12.0 + pgx/v5 v5.9.2
├── go.sum                         # Go dependency checksums
├── wails.json                     # Wails project config (name, output filename, frontend build commands, author)
├── playwright.config.ts           # Playwright config; testDir=./e2e, baseURL=http://localhost:5173
├── package.json                   # Root npm scripts (Playwright runner)
├── package-lock.json              # Root npm lockfile
├── CLAUDE.md                      # Project instructions for Claude Code
├── README.md                      # Project readme
├── docker/
│   ├── docker-compose-postgresql.yml  # Local demo PostgreSQL instance for dev/testing
│   └── ddl.sql                        # Schema DDL for demo database
├── e2e/
│   ├── mock-bridge.ts                 # Shared Playwright helper; stubs Wails JS bridge for browser-mode tests
│   ├── sprint5-autocomplete.spec.ts   # E2E tests for DB-aware autocomplete (Sprint 5)
│   └── sprint6-results-history.spec.ts # E2E tests for results panel + query history (Sprint 6)
├── spec/
│   ├── roadmap.md                     # Sprint-by-sprint delivery plan
│   ├── mission.md                     # Project mission statement
│   ├── tech_stack.md                  # Technology decisions
│   ├── design.md                      # Design notes
│   └── designs/
│       ├── Snowy.html                 # Full-screen HTML design prototype
│       ├── design-canvas.jsx          # Design canvas component
│       ├── uploads/                   # Pasted reference screenshots (PNG)
│       └── components/                # Individual component design prototypes (JSX)
│           ├── tokens.jsx             # Design tokens (colours, fonts, spacing)
│           ├── connection-manager.jsx
│           ├── dashboard.jsx
│           ├── data-grid.jsx
│           ├── icons.jsx
│           ├── new-console-overlays.jsx
│           ├── query-history.jsx
│           ├── sample-data.jsx
│           ├── sidebar.jsx
│           ├── sql-editor.jsx
│           ├── window-chrome.jsx
│           └── workspace.jsx
├── build/
│   ├── appicon.png                    # Application icon
│   ├── bin/
│   │   └── snowy.app                  # Compiled macOS application bundle (output of wails build)
│   ├── darwin/
│   │   ├── Info.plist                 # macOS production app metadata
│   │   └── Info.dev.plist             # macOS dev-mode app metadata
│   └── windows/
│       ├── icon.ico
│       ├── info.json
│       ├── installer/
│       └── wails.exe.manifest
└── test-results/                      # Playwright trace/artifact output (root-level, gitignored)
```

---

## Backend (Go)

All backend logic lives in the root package `snowy`. The Wails framework bridges Go methods to the frontend via generated JS bindings.

```
main.go              Wails app.Run entry point; creates App, binds it, embeds frontend/dist via go:embed
app.go               Orchestrator: holds *ConfigManager, *DbService, *HistoryService, *QueryService;
                     all exported methods here are callable from the frontend
config.go            ConfigManager: sync.RWMutex-protected reads/writes to ~/.snowy/config.json;
                     defines Project{} and Datasource{} structs; passwords stored plaintext
db_service.go        DbService: opens a fresh pgx.Conn per call (no pooling); methods:
                       - ListSchemas, ListTables, ListColumns (schema introspection)
                       - ExecuteQuery → QueryResult{Columns, Rows, RowCount, Duration}
                       - GetCompletions → CompletionSet (schemas/tables/columns for autocomplete)
                       - TestConnection
history_service.go   HistoryService: append-only JSONL log per datasource at
                     ~/.snowy/history/<dsId>.jsonl; methods: RecordHistory, GetQueryHistory
query_service.go     QueryService: manages saved .sql files at ~/.snowy/queries/<dsId>/;
                     methods: SaveQuery, ListSavedQueries, LoadSavedQuery, DeleteSavedQuery

config_test.go             Go unit tests — ConfigManager CRUD
history_service_test.go    Go unit tests — HistoryService record/retrieve
query_service_test.go      Go unit tests — QueryService save/list/load/delete
```

Key constraints:
- Every DB call opens and closes its own `pgx.Conn` — no connection pool.
- Config is protected by `sync.RWMutex`; passwords are plaintext in `~/.snowy/config.json`.
- Backend logging uses `log/slog` (Go 1.21+ stdlib).

---

## Frontend (React + TypeScript + Tailwind)

```
frontend/
├── index.html                     # Vite HTML entry point
├── vite.config.ts                 # Vite config; @vitejs/plugin-react
├── vitest.config.ts               # Vitest config for unit tests
├── tsconfig.json                  # TypeScript compiler config
├── tsconfig.node.json             # TypeScript config for Vite/Node tooling
├── tailwind.config.js             # Tailwind CSS config
├── postcss.config.js              # PostCSS config (autoprefixer + Tailwind)
├── package.json                   # npm scripts: dev, build, test, test:watch, test:coverage
├── components.json                # shadcn/ui component registry config
├── package.json.md5               # Wails-generated hash to detect dependency changes
│
├── src/
│   ├── main.tsx                   # React root; mounts <App /> into #root
│   ├── App.tsx                    # Top-level component (490 lines); manages all app-wide state;
│   │                              # renders one of three views: project-selector | datasources | workspace
│   ├── types.ts                   # Shared TypeScript interfaces (Project, Datasource, Tab, etc.)
│   ├── App.css                    # Global app styles
│   ├── style.css                  # Base/reset styles
│   ├── vite-env.d.ts              # Vite ambient type declarations
│   │
│   ├── components/
│   │   ├── ConnectionManager.tsx  # Two-column connection CRUD UI; project + datasource management (798 lines)
│   │   ├── Sidebar.tsx            # DataGrip-style tree explorer; lazy-loads schemas→tables→columns;
│   │   │                          # saved queries folder; double-click table auto-generates SELECT (585 lines)
│   │   ├── QueryEditor.tsx        # CodeMirror 6 SQL editor; Cmd+Enter runs, Cmd+S saves;
│   │   │                          # DB-aware autocomplete via custom completion source (292 lines)
│   │   ├── ResultsPanel.tsx       # Tab strip for result sets; pinnable tabs; row count + exec time;
│   │   │                          # CSV export via Wails SaveFileDialog (236 lines)
│   │   ├── ResultsTable.tsx       # Tabular display of QueryResult rows/columns (91 lines)
│   │   ├── TabBar.tsx             # Editor tab strip; dirty-state dot; open/close/switch tabs (134 lines)
│   │   ├── HistoryDrawer.tsx      # Slide-in drawer; lists query history; click to reload SQL (180 lines)
│   │   ├── ConnectionManager.test.tsx  # Vitest + Testing Library unit tests for ConnectionManager
│   │   ├── QueryEditor.test.tsx        # Vitest + Testing Library unit tests for QueryEditor
│   │   ├── Sidebar.test.tsx            # Vitest + Testing Library unit tests for Sidebar
│   │   ├── TabBar.test.tsx             # Vitest + Testing Library unit tests for TabBar
│   │   └── ui/                    # Primitive UI components (placeholder for shadcn/ui additions)
│   │
│   ├── lib/
│   │   ├── tokens.ts              # Design token constants (colours, fonts) mirroring spec/designs tokens.jsx
│   │   └── utils.ts               # Shared utility helpers (cn() class merger, etc.)
│   │
│   └── test/
│       ├── setup.ts               # Vitest global setup; @testing-library/jest-dom matchers
│       ├── smoke.test.ts          # Basic smoke tests
│       └── mocks/
│           └── wailsjs.ts         # Manual mock of wailsjs Go bindings for unit tests
│
└── src/assets/
    ├── logo-universal.png         # App logo
    ├── fonts/
    │   ├── nunito-v16-latin-regular.woff2
    │   └── OFL.txt
    └── images/                    # Additional image assets
```

### Key frontend dependencies

| Package | Purpose |
|---|---|
| React 19 + react-dom | UI framework |
| CodeMirror 6 (`@codemirror/*`) | SQL editor with syntax highlighting + autocomplete |
| Tailwind CSS 4 | Utility-first styling |
| lucide-react | Icon library |
| clsx + tailwind-merge | Conditional class name utilities |
| Vitest + @testing-library/react | Unit test runner + DOM assertions |

---

## Generated / Build Artifacts

```
frontend/wailsjs/                  # Auto-generated by wails dev / wails build — do not edit by hand
├── go/
│   └── main/
│       ├── App.js                 # JS wrappers for all exported App methods (callable from frontend)
│       └── App.d.ts              # TypeScript declarations for App.js
└── runtime/
    ├── runtime.js                 # Wails runtime helpers (dialogs, events, window management)
    └── runtime.d.ts              # TypeScript declarations for runtime.js

frontend/dist/                     # Production frontend build output (embedded into Go binary by wails build)
├── index.html
└── assets/                        # Hashed JS/CSS bundles produced by Vite

build/bin/
└── snowy.app                      # macOS application bundle (output of wails build)

build/darwin/                      # macOS-specific build resources used by Wails toolchain
├── Info.plist
└── Info.dev.plist

build/windows/                     # Windows-specific build resources
├── icon.ico
├── info.json
├── installer/
└── wails.exe.manifest

frontend/test-results/             # Playwright test trace files and failure artifacts (gitignored)
test-results/                      # Root-level Playwright artifact output (gitignored)
```
