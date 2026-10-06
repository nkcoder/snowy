# Product

<!-- impeccable:product-schema 1 -->

<!-- Maintained with the Impeccable plugin (`/impeccable init`). The tool only looks for this file at the repo root, so it lives here. Safe to edit by hand. Visual rules live in DESIGN.md. -->


## Platform

web

<!-- Desktop app: Wails v2 (Go backend + React/TypeScript frontend in a native macOS webview). The UI is web technology, so the platform is `web`; the primary target is macOS. -->

## Users

Developers and DevOps engineers who reach for a Postgres client daily: browsing schema, running ad-hoc queries, reading result sets, and moving between local / dev / staging / prod connections. Often at a company where a commercial client (e.g. DataGrip) is not licensed for work use.

## Product Purpose

A native macOS PostgreSQL GUI client covering the core everyday features: connections grouped by project, a lazy-loading schema explorer, a SQL editor with DB-aware autocomplete, readable result grids with pinnable tabs and CSV export, per-datasource query history, and saved `.sql` queries. Success is that a developer can do their daily Postgres work without the weight, license wall, or sprawl of existing tools.

## Positioning

Open-source, beautiful, easy to use, and focused. Existing clients each give up one of those: DataGrip, Postico, TablePlus and Navicat are commercial or limited; pgAdmin is heavy and dated; DBeaver is a large do-everything Java app. Snowy is Postgres-only, ships as a single Go/Wails binary with no Electron overhead, and deliberately omits server-administration surface area.

## Operating Context

- Developers switch between multiple connections per project (local, dev, staging, prod), distinguished by per-connection environment tags.
- Heavy keyboard use in the SQL editor; many query console tabs open at once, each with dirty-state tracking.
- Local state lives in `~/.snowy/` (config, saved queries, history). Passwords live in the macOS Keychain, never in config files.

## Capabilities and Constraints

- Connection manager: add / edit / duplicate / delete, test connection, optional saved password, env tags.
- Sidebar is flat, DataGrip-style, not pgAdmin-style nested layers: datasources → schemas → tables → columns · keys · foreign keys · indexes · checks, loaded lazily.
- Query editor (CodeMirror) with syntax highlighting and low-latency completion for schemas, tables, columns, functions, keywords.
- Results grid with pinnable tabs, row/duration counters, CSV export. History drawer; saved queries renamed/deleted from the sidebar.
- Scope is PostgreSQL only: no multi-database support, no server-admin dashboards or backup tooling.
- macOS is the primary (only) target; the app is keyboard-friendly.
- Dark (SnowyDark) and light (SnowyLight) themes; all color and type go through `T.*` CSS custom-property tokens with no hardcoded hex in components (ADR-0004).

## Brand Commitments

- Name: Snowy.
- DataGrip is the binding UX reference for layout, themes and interactions (`spec/design/datagrip-references/`); Snowy's own prototypes are `spec/design/1.jpeg`–`5.jpeg`.

## Evidence on Hand

- Design prototypes and DataGrip references under `spec/design/`.
- Demo Postgres DB (users, accounts, transactions, audit_logs) via `docker/docker-compose-postgresql.yml`.
- Project site in `docs/` and hero GIF in `docs/images/`.
- Not on hand: user testimonials, usage metrics, or benchmarks. Do not fabricate them.

## Product Principles

1. **Everyday core over completeness.** Every surface serves a daily developer task; admin-style features stay out.
2. **Beautiful and calm.** Polish is a feature; the interface should be easy to scan during long sessions and never feel heavy.
3. **Keyboard-first, flat navigation.** Reach schema, editor and results in few steps; avoid deep nesting.
4. **Know which environment you are in.** Connections carry an environment identity so prod is never confused with local.
5. **Local and trustworthy.** Credentials stay in the Keychain, data stays on the machine.
