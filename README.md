# Snowy

[![Website](https://img.shields.io/badge/website-nkcoder.github.io%2Fsnowy-blue)](https://nkcoder.github.io/snowy/)
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)](https://github.com/nkcoder/snowy/releases)
[![Go](https://img.shields.io/badge/go-1.25%2B-00ADD8?logo=go&logoColor=white)](https://go.dev/)

A native macOS PostgreSQL GUI client — fast, keyboard-friendly, DataGrip-inspired.

Built with [Wails v2](https://wails.io/) (Go + React/TypeScript) so it ships as a single binary with no Electron overhead.

## Features

- **Connection manager** — add, edit, duplicate and delete PostgreSQL connections; per-connection environment tags (local / dev / staging / prod); test connection before saving
- **Schema explorer** — lazy-loading sidebar tree: datasources → schemas → tables → columns · keys · foreign keys · indexes · checks
- **Query editor** — CodeMirror SQL editor with syntax highlighting and DB-aware autocomplete (schemas, tables, columns, functions, keywords)
- **Results panel** — tabular grid with pinnable result tabs, row/duration counters, CSV export
- **Query history** — per-datasource execution log, click to restore any previous query
- **Saved queries** — save `.sql` files per datasource; rename and delete from the sidebar
- **Multiple consoles** — open as many query tabs as needed, each with its own dirty-state tracking

## Requirements

- macOS (primary target)
- [Go 1.25+](https://go.dev/)
- [Node.js 18+](https://nodejs.org/)
- [Wails v2](https://wails.io/docs/gettingstarted/installation) — `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- PostgreSQL (local or remote) — a Docker demo DB is included

## Getting started

```bash
# Clone
git clone https://github.com/nkcoder/snowy.git && cd snowy

# Install frontend dependencies
cd frontend && npm install && cd ..

# Start in dev mode (hot-reload)
wails dev
```

The app opens automatically. Point it at any PostgreSQL instance using the connection manager.

### Demo database

A pre-seeded PostgreSQL instance with sample tables (users, accounts, transactions, audit_logs) is included for development:

```bash
docker compose -f docker/docker-compose-postgresql.yml up -d
# postgres://myuser:mypassword@localhost:5432/mydatabase
```

## Building

```bash
wails build
# Output: build/bin/snowy.app
```

## Testing

```bash
# Frontend unit tests (vitest)
cd frontend && npm run test

# Backend unit tests
go test .

# Backend integration tests (requires demo DB running)
TEST_DB_URL=postgres://myuser:mypassword@localhost:5432/mydatabase go test .

# E2E tests (Playwright — starts Vite dev server automatically)
npx playwright test
```

## Project structure

```
snowy/
├── main.go               # Wails bootstrap
├── app.go                # All Go→frontend bindings
├── config.go             # Connection config (~/.snowy/config.json)
├── db_service.go         # PostgreSQL introspection + query execution
├── query_service.go      # Saved queries (~/.snowy/queries/)
├── history_service.go    # Query history (~/.snowy/history/)
├── frontend/
│   └── src/
│       ├── App.tsx                    # Root component + app state
│       ├── components/
│       │   ├── Sidebar.tsx            # Schema explorer tree
│       │   ├── QueryEditor.tsx        # CodeMirror editor
│       │   ├── ConnectionManager.tsx  # Datasource CRUD
│       │   ├── ResultsPanel.tsx       # Results grid + tabs
│       │   └── HistoryDrawer.tsx      # Query history panel
│       └── lib/tokens.ts              # Design token system
├── e2e/                  # Playwright specs
├── spec/design/          # UI design references
└── docker/               # Demo PostgreSQL setup
```

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | [Wails v2](https://wails.io/) |
| Backend | Go 1.25, [pgx v5](https://github.com/jackc/pgx) |
| Frontend | React 18, TypeScript, Tailwind CSS |
| Editor | [CodeMirror 6](https://codemirror.net/) |
| Unit tests | vitest + Testing Library (frontend), Go test (backend) |
| E2E tests | [Playwright](https://playwright.dev/) |
