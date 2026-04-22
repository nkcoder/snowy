# Snowy — Roadmap

Each sprint ships a **runnable app**. Features may be partial but nothing broken.
Stop after each sprint for review + discussion before committing.

---

## ✅ Sprint 1 — Connection Manager

**Delivered:** Full connection CRUD; app launches and connects to PostgreSQL.

- Two-column layout: projects panel (left) + connections table + inline edit form (right)
- Project CRUD: add, delete
- Connection CRUD: add, edit, duplicate, delete
- Edit form: name, host, port, database, user, password (reveal toggle), env badge, SSL mode, derived URL
- "Test connection" button → inline green/red result badge
- New design tokens applied: warm graphite dark theme, icy blue accent

**Runnable:** Launch → create project → add connection → test → connect → workspace.

---

## ✅ Sprint 2 — Flat Sidebar

**Delivered:** DataGrip-style schema explorer in workspace.

- Search box at top with ⌘K hint
- Connection row (depth 0) with refresh button
- 4 peer folders at depth 1: **queries** (stubbed), **schemas**, **views**, **reports**
- Schemas: lazy-load tables on expand → lazy-load columns on expand
- Double-click table → auto `SELECT * FROM schema.table LIMIT 100`
- Views folder: flat list of all views across loaded schemas
- "New connection" footer button → back to connection manager

**Runnable:** Connect → browse schemas → click table → see results.

---

## 🔲 Sprint 3 — SQL Editor (CodeMirror)

**Goal:** Replace `<textarea>` with CodeMirror 6. Keywords highlight, real line numbers, `Cmd+Enter` runs.
Autocomplete limited to SQL keywords only (DB-aware completions in Sprint 5).
Saved queries UI stubbed — Save button works but no file manager yet.

**Scope:**
- Install `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-sql`, `@codemirror/theme-one-dark`
- Rewrite `QueryEditor.tsx`: CodeMirror editor, dynamic line gutter, SQL syntax highlight
- Keymap: `Cmd+Enter` = Run, `Cmd+S` = Save (prompts for filename)
- Backend: `SaveQuery(dsId, filename, sql)`, `ListSavedQueries(dsId)`, `LoadSavedQuery(dsId, filename)`, `DeleteSavedQuery(dsId, filename)` — files at `~/.snowy/queries/<dsId>/`
- Sidebar queries folder lists saved files; click → loads into editor; delete action

**Runnable:** Connect → write SQL with highlighting → `Cmd+Enter` runs → save to file → reload from sidebar.

---

## 🔲 Sprint 4 — Editor Tabs + Dirty State

**Goal:** Tab strip above editor for open files. Unsaved indicator. Multiple files open at once.

**Scope:**
- Tab strip: file tabs with editor icon + filename + dirty dot (●) + close (×)
- Opening a saved query from sidebar → opens in new tab or focuses existing
- Clicking a table in sidebar → opens `SELECT *` in new tab named after the table
- Tab state: each tab has its own SQL content; switching preserves content
- `RenameQuery(dsId, oldName, newName)` backend method + sidebar rename affordance

**Runnable:** Open multiple queries → switch tabs → content preserved → close tab.

---

## 🔲 Sprint 5 — DB-aware Autocomplete

**Goal:** Autocomplete shows schemas, tables, columns from connected DB.

**Scope:**
- Backend: `GetCompletions(dsId) → CompletionSet` (schemas, tables, columns with types; cached per dsId)
- Expose via `app.go`; update wailsjs bindings
- Wire into CodeMirror SQL extension: custom completion source alongside keyword completions
- Autocomplete entry format: COL/TBL/KW/FN type badge, name, type string, description
- Matches design popover: 440px wide, selected row with left blue border

**Runnable:** Connect → type `SELECT * FROM ` → table names appear → pick one.

---

## 🔲 Sprint 6 — Results Panel: Pinnable Tabs + History

**Goal:** Pin result sets; persist query history; CSV export.

**Scope:**
- Results panel: tab strip with "Result 1" (live) + pinned tabs (rotated pin icon, timestamp, row-count diff badge)
- "Pin result" button in tab bar right rail; each run can be pinned
- Close (×) per pinned tab
- Row count + execution time displayed in tab bar
- Backend: `RecordHistory(dsId, sql, rowCount, durationMs)` appends to `~/.snowy/history/<dsId>.jsonl`
- `GetQueryHistory(dsId, limit)` → history entries
- History panel: slide-in drawer from right; click entry → loads SQL into active editor tab
- CSV export: format rows client-side → `runtime.SaveFileDialog` download

**Runnable:** Run query → pin result → run again → compare → open history → re-run old query.

---

## Tech Decisions

| Concern | Choice |
|---------|--------|
| SQL editor | CodeMirror 6 |
| State | Local React state (no Zustand until complexity warrants) |
| Backend logging | `log/slog` (stdlib Go 1.21+) |
| Password storage | Plaintext for now; keychain post-Sprint 6 |
| AI copilot strip | Design reference only; not in scope |
| Linting | Biome (add when setting up CI) |

## Design Reference

All UI follows tokens in `spec/designs/project/components/tokens.jsx`:
- BG: `#1a1917` · Chrome: `#252320` · Panel: `#1f1d1b` · Sidebar: `#1d1b19`
- Accent: `oklch(0.62 0.17 240)` · Text: `#ecebe8` · Dim: `#6e6a62`
- Fonts: SF Pro (UI) · SF Mono / JetBrains Mono (code)
- Full screen designs: `spec/designs/project/Snowy.html`
