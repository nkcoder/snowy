# Snowy

[![Website](https://img.shields.io/badge/website-nkcoder.github.io%2Fsnowy-blue)](https://nkcoder.github.io/snowy/)
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)](https://github.com/nkcoder/snowy/releases)
[![Go](https://img.shields.io/badge/go-1.26%2B-00ADD8?logo=go&logoColor=white)](https://go.dev/)

A native macOS PostgreSQL GUI client — fast, keyboard-friendly, DataGrip-inspired.

Built with [Wails v2](https://wails.io/) (Go + React/TypeScript) so it ships as a single binary with no Electron overhead.

![Hero Screenshot](./docs/images/hero.gif)

## Why another PostgreSQL client?

The tools in this space are genuinely good — this isn't a list of complaints, it's an explanation of a gap. Each of the popular clients is excellent at what it does, but none of them is, at the same time, **beautiful, easy to use, open-source, and focused on the everyday needs of a developer or DevOps engineer**:

- **[DataGrip](https://www.jetbrains.com/datagrip/)** — beautiful, powerful, and the UX reference Snowy admires. But it's commercial: the free tier is non-commercial only, so it can't be used at work without a paid license. Being a full multi-database IDE, it's also heavier than most people need for daily Postgres work.
- **[pgAdmin](https://www.pgadmin.org/)** — the open-source standard, and comprehensive. But it's heavy, its web-app UX feels dated, and most of its surface area (server administration, dashboards, backup tooling) is rarely touched in a developer's day-to-day.
- **[Postico 2](https://eggerapps.at/postico2/)** — a lovely, native macOS app with great taste. But it's commercial software, and the free tier is limited enough that real use needs a paid license.
- **[Navicat for PostgreSQL](https://www.navicat.com/en/products/navicat-for-postgresql)** — feature-rich and polished. But it's proprietary and expensive, priced for teams rather than an individual developer.
- **[TablePlus](https://tableplus.com/)** — fast and gorgeous, arguably the closest in spirit. But it's closed-source and the free tier is deliberately limited (open-tab and connection caps); unlocking it is a paid license.
- **[DBeaver](https://dbeaver.io/)** — free, open-source, and supports every database under the sun. But that universality is the cost: it's a large Java/Eclipse application, and its broad, do-everything UI isn't a focused Postgres experience. The polished extras live in the paid Pro edition.

For the terminal-inclined, **[psql](https://www.postgresql.org/docs/current/app-psql.html)** and **[pgcli](https://www.pgcli.com/)** are excellent and free — but they're CLI tools, not a GUI for browsing structure and eyeballing result sets.

So the gap is real: a client that is **beautiful, easy to use, open-source, and covers the core features a developer or DevOps engineer reaches for every day** — connections, schema browsing, a good SQL editor with autocomplete, readable results, history, and saved queries — without the weight, the license wall, or the everything-and-the-kitchen-sink surface area. That's why Snowy exists.

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
- [Go 1.26+](https://go.dev/)
- [Node.js 24 LTS](https://nodejs.org/) (see `.nvmrc`)
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
| Backend | Go 1.26, [pgx v5](https://github.com/jackc/pgx) |
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| Editor | [CodeMirror 6](https://codemirror.net/) |
| Unit tests | vitest + Testing Library (frontend), Go test (backend) |
| E2E tests | [Playwright](https://playwright.dev/) |

## Security & data handling

Snowy is designed for use in environments with strict data-handling requirements.

- **No outbound network calls.** The app makes no analytics, telemetry, update-check,
  or any other third-party requests. The only network traffic is the PostgreSQL
  connection you configure. Fonts and all assets are bundled into the binary. This can
  be verified by running the app behind a deny-all egress firewall.
- **Credentials in the OS keychain.** Passwords are stored in the macOS Keychain, never
  written to `~/.snowy/config.json` (see [ADR-0003](./docs/adr/0003-keychain-password-storage.md)).
- **Encrypted connections by default.** New connections default to `sslmode=require`.
  For the strongest guarantee against MITM, use `verify-full` with a configured CA.
  Local/non-TLS servers (e.g. the demo Docker DB) must be set to `disable` explicitly.
- **Query results never persist.** Result rows live only in memory. They leave the app
  only on an explicit user action — CSV export (written `0600`) or clipboard copy.
- **Local files** (`~/.snowy`, dir `0700`, files `0600`): connection metadata, saved
  `.sql` queries, a schema/metadata cache (names only), and query history. Query history
  stores SQL text (which can embed literal values); it is capped at the 100 most recent
  entries per datasource and can be wiped anytime via **Clear** in the history drawer.

Residual, OS-level considerations for hardened deployments:

- **Clipboard**: copied cells go to the system pasteboard, which macOS Universal
  Clipboard/Handoff can sync to other signed-in Apple devices.
- **Crash reports / swap**: in-memory result data could surface in a macOS crash report
  (`~/Library/Logs/DiagnosticReports`) or swap. macOS encrypts swap by default and keeps
  crash reports local unless diagnostics sharing is enabled.

Supply-chain and vulnerability scanning (`govulncheck`, `npm audit`, CodeQL for Go and
JS/TS) run on every push/PR and weekly — see [`.github/workflows/security.yml`](./.github/workflows/security.yml).

## License

[ISC](./LICENSE) © Daniel
