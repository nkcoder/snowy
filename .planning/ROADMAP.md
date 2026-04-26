# Roadmap — Snowy Sprint 7: Design Refresh

**3 phases** | **19 requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Design Foundation | Token system + window shell styled correctly | TOK-01, TOK-02, CHR-01, CHR-02 | 4 |
| 2 | Connection Manager + Sidebar | Entry-point screens pixel-match spec | CONN-01, CONN-02, CONN-03, SIDE-01, SIDE-02, SIDE-03 | 5 |
| 3 | Workspace Core | Full workspace pixel-matches spec | WORK-01, WORK-02, EDIT-01, EDIT-02, SVC-01, SVC-02, RES-01, RES-02, GRID-01, GRID-02, GRID-03 | 6 |

---

## Phase 1: Design Foundation

**Goal:** Establish the design token system and apply it to the app shell — theme toggle works, title bar matches macOS chrome spec, status bar renders at the bottom of the workspace.

**Requirements:** TOK-01, TOK-02, CHR-01, CHR-02

**UI hint:** yes

**Success criteria:**
1. CSS custom properties defined for `SnowyLight` and `SnowyDark` token sets; all existing components read from these variables (no hardcoded hex values)
2. Theme toggle (light/dark) switches the app instantly; preference survives app restart
3. Title bar: 38px height, `t.chrome` background, `0.5px solid t.border` bottom, macOS traffic lights (12px circles, correct red/yellow/green), no visual flash on startup
4. Status bar: 22px, monospace, host:port + schema + encoding + row count + timing + cursor + timezone segments all visible

**Dependencies:** None — foundation for all subsequent phases

---

## Phase 2: Connection Manager + Sidebar

**Goal:** Redesign the two entry-point UI surfaces — connection manager form and sidebar — to pixel-match `spec/designs/project/components/connection-manager.jsx` and `sidebar.jsx`.

**Requirements:** CONN-01, CONN-02, CONN-03, SIDE-01, SIDE-02, SIDE-03

**UI hint:** yes

**Success criteria:**
1. Connection manager: two-column layout — 260px list sidebar + main form panel; matches spec proportions
2. Connection list: each row shows elephant glyph, online/offline indicator dot, selected accent left-border, environment badge
3. Connection form: General tab wired (Name, Host, Port, Database, Auth section, Password with save checkbox, JDBC URL preview); Test Connection shows result; Cancel/Apply/OK footer
4. Sidebar toolbar: all 10 icon buttons render in correct order with separator; New console has accent `+` badge; icon colors match spec
5. Sidebar search: filter bar renders below toolbar with `⌘F` hint

**Dependencies:** Phase 1 (tokens must exist)

---

## Phase 3: Workspace Core

**Goal:** Implement the DataGrip-style split workspace layout with Services panel, redesign the editor toolbar and gutter, and deliver the full results grid with column glyphs — matching `spec/designs/project/components/workspace.jsx`, `sql-editor.jsx`, and `data-grid.jsx`.

**Requirements:** WORK-01, WORK-02, EDIT-01, EDIT-02, SVC-01, SVC-02, RES-01, RES-02, GRID-01, GRID-02, GRID-03

**UI hint:** yes

**Success criteria:**
1. Workspace splits top/bottom: top half = sidebar + console pane side-by-side; bottom 320px = Services panel; no regression in editor or sidebar functionality
2. ToolWindowHeader component shared across Console pane and Results pane: tab strip with active accent underline, close × per tab, trailing `+`, `⋯` overflow
3. Editor toolbar: Play (green), Execute as statement, History, Cancel, Transaction, Tx:Auto dropdown, Schema/context selector; Cmd+Enter still runs query
4. Services panel: 220px left tree (Database > connections > consoles with timing) + right results pane; Services tree toolbar renders Tx label + icon buttons
5. Results pane: Output tab + pinned result tabs with pin icon; full toolbar button set renders; CSV dropdown functional
6. Data grid: column headers have ColGlyph (PK/FK/plain) + type label; rows are 24px, zebra-striped; selected row has accent border; StatusChip renders for status columns

**Dependencies:** Phase 1 (tokens), Phase 2 (sidebar already styled)

---

## Coverage Check

All 19 v1 requirements mapped:
- Phase 1: TOK-01, TOK-02, CHR-01, CHR-02 (4)
- Phase 2: CONN-01, CONN-02, CONN-03, SIDE-01, SIDE-02, SIDE-03 (6)
- Phase 3: WORK-01, WORK-02, EDIT-01, EDIT-02, SVC-01, SVC-02, RES-01, RES-02, GRID-01, GRID-02, GRID-03 (11) — but wait: missing SIDE-03 from traceability? No — SIDE-03 is in Phase 2. ✓

Total: 4 + 6 + 11 = 21? Let me recount. 

TOK-01, TOK-02, CHR-01, CHR-02 = 4
CONN-01, CONN-02, CONN-03, SIDE-01, SIDE-02, SIDE-03 = 6
WORK-01, WORK-02, EDIT-01, EDIT-02, SVC-01, SVC-02, RES-01, RES-02, GRID-01, GRID-02, GRID-03 = 11

Total = 21 (not 19 — 21 requirements total)
