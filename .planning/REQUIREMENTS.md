# Requirements — Snowy Sprint 7: Design Refresh

## v1 Requirements

### Design Tokens

- [ ] **TOK-01**: App applies warm OKLCH palette (`SnowyLight`/`SnowyDark`) via CSS custom properties; all components read from token variables, not hardcoded colors
- [ ] **TOK-02**: User can toggle light/dark theme; preference is persisted across restarts

### Window Chrome

- [ ] **CHR-01**: Title bar renders macOS traffic lights (12px circles, correct red/yellow/green), `t.chrome` background, 38px height, `0.5px solid t.border` bottom edge
- [ ] **CHR-02**: Status bar renders at bottom of workspace: host:port, active schema, encoding, row count + query timing, cursor position, timezone; 22px height, monospace font

### Connection Manager

- [ ] **CONN-01**: Connection manager uses two-column layout — 260px sidebar (connection list) + main form panel
- [ ] **CONN-02**: Connection list shows each datasource with elephant glyph, online/offline dot indicator, selected-row accent left-border, environment badge
- [ ] **CONN-03**: Connection form has tabbed header (General / Options / SSH-SSL / Schemas / Advanced), auth section with User & Password fields, "Save password" checkbox, JDBC URL preview row, footer with Test Connection button + result indicator + Cancel/Apply/OK

### Sidebar

- [ ] **SIDE-01**: Sidebar toolbar shows DataGrip-style icon buttons: New, Data source properties, Synchronize, Stop, separator, New query console (with accent `+` badge), Jump to table, DDL, Diagram, Preview
- [ ] **SIDE-02**: Sidebar has filter search bar with `⌘F` hint below toolbar
- [ ] **SIDE-03**: Sidebar tree shows: connection nodes (elephant glyph, `N of M` badge) → database → schema → tables folder (with row-count meta) → table internals (columns with PK/FK/plain glyphs, keys, foreign keys, indexes, checks folders)

### Workspace Layout

- [ ] **WORK-01**: Workspace splits vertically — top half (Database Explorer sidebar + Console pane side-by-side) and bottom half (Services panel); no full-screen single-panel view
- [ ] **WORK-02**: Tool window headers use shared `ToolWindowHeader` component: tab strip with active accent underline, close × per tab, trailing `+` for new console, `⋯` overflow button

### SQL Editor

- [ ] **EDIT-01**: Editor toolbar shows: Play (green accent button with `⌘↵` hint), Execute as statement, History, Cancel, Transaction, Tx:Auto dropdown, Schema/context selector right-aligned
- [ ] **EDIT-02**: Editor gutter shows line numbers with ✓ run-mark on lines that were part of last successful execution

### Services Panel

- [ ] **SVC-01**: Services panel occupies bottom 320px; left side is 220px tree (Database > connections > consoles with timing meta); right side is results pane
- [ ] **SVC-02**: Services tree toolbar shows: Tx label, Plus, View, Enter, Stop, X icon buttons

### Results

- [ ] **RES-01**: Results pane tab strip shows Output tab + pinned result tabs (with rotated pin icon and close ×); `⋯` overflow at right
- [ ] **RES-02**: Results toolbar has full DataGrip-style button set: Table/Chart view | Reload/Stop | Add row/Delete/Revert/Submit | Tx:Auto | DDL | Pin toggle | Find/Values/Aggregates/Filter/Geo | CSV dropdown | Export/Import/Sort/View/Settings

### Data Grid

- [ ] **GRID-01**: Data grid column headers show ColGlyph (PK: key rectangle + corner circle in `sem.warn`; FK: key rectangle + arrow in `accent`; plain: rectangle in `textDim`), column name in mono, type label in `textDim`, filter icon, sort indicator
- [ ] **GRID-02**: Data grid rows are 24px tall, include row number column, zebra-stripe every other row with `t.gridStripe`, selected row uses `t.selected` background + `2px solid t.selectedBorder` left border
- [ ] **GRID-03**: Status chips render inline in grid cells for status columns: colored dot + label, background tinted to semantic color (`posted` → green, `pending` → warn, `failed` → error, `reversed` → purple)

---

## v2 Requirements (deferred)

- AI copilot strip (AIStrip inline suggestions in editor) — Sprint 8+
- Dashboard screen (pinned query tiles with auto-refresh) — Sprint 8+
- Autocomplete popover visual redesign — existing CodeMirror works
- SSH / SSL / Schemas / Advanced connection form tabs (content, not just labels)

---

## Out of Scope

- Backend tech debt (connection pooling, keychain, query cancel, path traversal fixes) — addressed in dedicated security/performance sprint
- Multi-connection workspace (multiple active datasources simultaneously) — not in roadmap
- pgpass / IAM / Kerberos auth methods — connection form shows UI but wires User & Password only

---

## Traceability

| REQ-ID | Phase |
|--------|-------|
| TOK-01, TOK-02 | Phase 1 |
| CHR-01, CHR-02 | Phase 1 |
| CONN-01, CONN-02, CONN-03 | Phase 2 |
| SIDE-01, SIDE-02, SIDE-03 | Phase 2 |
| WORK-01, WORK-02 | Phase 3 |
| EDIT-01, EDIT-02 | Phase 3 |
| SVC-01, SVC-02 | Phase 3 |
| RES-01, RES-02 | Phase 3 |
| GRID-01, GRID-02, GRID-03 | Phase 3 |
