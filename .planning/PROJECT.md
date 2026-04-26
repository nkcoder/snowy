# Snowy — Sprint 7: Design Refresh

## What This Is

Snowy is a native macOS desktop PostgreSQL GUI client (Wails v2: Go backend + React/TypeScript frontend). Sprints 1–6 shipped the core feature set: connection manager, schema tree sidebar, CodeMirror SQL editor with autocomplete, multi-tab workspace, pinnable result tabs, CSV export, and query history.

**Sprint 7** is a pixel-accurate design refresh targeting the spec at `spec/designs/project/`. Goal: make Snowy look and feel like a polished DataGrip-grade tool — warm macOS-native theme, dense DataGrip-style layout, column glyphs in the data grid, Services panel, and a fully redesigned connection manager form.

## Core Value

A desktop PostgreSQL GUI that looks and feels indistinguishable from a professional tool — warm graphite/icy-blue aesthetic, DataGrip-density, macOS-native polish.

## Context

- **Platform:** Wails v2 desktop app — WebView renders React/TypeScript frontend; Go backend exposes methods via IPC bridge
- **Design spec:** `spec/designs/project/` — JSX prototypes with exact tokens, layout, colors, and glyphs
- **Reference DB:** `docker/docker-compose-postgresql.yml` — local Postgres for verification
- **Sprint history:** Sprints 1–6 complete; existing code at `frontend/src/components/`

## Requirements

### Validated (Sprints 1–6 — existing)

- ✓ Connection manager — create/edit/delete datasources — existing
- ✓ Schema tree sidebar — lazy-load schemas → tables → columns — existing
- ✓ CodeMirror 6 SQL editor — syntax highlighting, DB-aware autocomplete — existing
- ✓ Multi-tab workspace — open/close/dirty tabs — existing
- ✓ Query execution — run SQL, display results table — existing
- ✓ Pinnable result tabs — pin/unpin result sets — existing
- ✓ CSV export — download query results — existing
- ✓ Saved queries — persist .sql files per datasource — existing
- ✓ Query history drawer — JSONL-backed, slide-in panel — existing

### Active (Sprint 7)

- [ ] **TOK-01**: Design token system — warm OKLCH palette (`SnowyLight`/`SnowyDark`) applied via CSS variables across all components
- [ ] **TOK-02**: Light/dark theme toggle — persisted preference, seamless switch
- [ ] **CHR-01**: Window chrome / title bar — macOS traffic lights, `t.chrome` background, 38px height, `0.5px` border
- [ ] **CHR-02**: Status bar — host:port, schema, encoding, row count + timing, cursor position, timezone; `22px` height, monospace
- [ ] **CONN-01**: Connection manager redesign — two-column layout: 260px connection list sidebar + form panel
- [ ] **CONN-02**: Connection list — elephant glyph, online/offline dot, selected accent border, env badge
- [ ] **CONN-03**: Connection form — tabbed (General / Options / SSH-SSL / Schemas / Advanced); auth section with User & Password, Save password checkbox, URL preview, Test Connection footer
- [ ] **SIDE-01**: Sidebar toolbar redesign — DataGrip-style icon row: New, Data source properties, Synchronize, Stop, separator, New query console (with `+` badge), Jump to table, DDL, Diagram, Preview
- [ ] **SIDE-02**: Sidebar search bar — `⌘F` filter objects input
- [ ] **SIDE-03**: Sidebar tree — connection nodes with elephant glyph + `N of M` badge, database node, schema node, tables/sequences folders, table internals (columns with PK/FK glyphs, keys, foreign keys, indexes, checks)
- [ ] **WORK-01**: Workspace layout — DataGrip split: top half (sidebar + console pane side-by-side), bottom half (Services panel)
- [ ] **WORK-02**: ToolWindowHeader — tab strip with active accent underline, close × button, trailing `+` for new console, `⋯` overflow
- [ ] **EDIT-01**: Editor toolbar — Play (green), Execute as statement, History, Cancel, Transaction, Tx:Auto dropdown, Schema/context selector (right-aligned)
- [ ] **EDIT-02**: Editor gutter — line numbers with run-mark checkmarks on executed lines
- [ ] **SVC-01**: Services panel — bottom 320px panel: left tree (Database > connections > consoles with timing meta) + right results pane
- [ ] **SVC-02**: Services tree toolbar — Tx label, Plus, View, Enter, Stop, X icon buttons
- [ ] **RES-01**: Results pane tab strip — Output tab + pinned result tabs with pin icon, close ×, `⋯` overflow
- [ ] **RES-02**: Results toolbar — Table/Chart/Reload/Stop | Add row/Delete/Revert/Submit | Tx:Auto | DDL | Pin | Find/Values/Aggregates/Filter/Geo | CSV dropdown | Export/Import/Sort/View/Settings
- [ ] **GRID-01**: Data grid column headers — ColGlyph (PK: key+circle in warn color; FK: key+arrow in accent; regular: plain rect in textDim), column name, type badge, filter icon, sort indicator
- [ ] **GRID-02**: Data grid rows — row numbers, zebra stripe, 24px row height, monospace cell values, selected row uses `t.selected` + accent border
- [ ] **GRID-03**: StatusChip — inline status badge (posted/pending/failed/reversed) with dot + color per semantic palette

### Out of Scope (Sprint 7)

- AI copilot strip (AIStrip) — Sprint 8+
- Dashboard screen (pinned query tiles) — Sprint 8+
- Autocomplete popover redesign — existing CodeMirror works, visual refresh deferred
- New backend features (connection pooling, keychain, query cancel) — tech debt addressed separately
- SSH/SSL/Schemas/Advanced form tabs — stub acceptable for Sprint 7

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CSS custom properties for tokens | Single source of truth; theme switch without re-render | Active |
| Services panel replaces HistoryDrawer | Design spec shows DataGrip Services panel; history moves inside it | Active |
| Keep CodeMirror, restyle chrome only | Autocomplete works; editor toolbar + gutter are the visual diff | Active |
| DataGrip split layout (top/bottom) | Design spec is explicit; matches professional tool expectation | Active |
| Pixel-match spec, not approximate | Sprint goal is fidelity to `spec/designs/project/` JSX prototypes | Active |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-26 after initialization*
