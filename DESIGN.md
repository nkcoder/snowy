---
name: Snowy
description: A calm, dense, warm-neutral PostgreSQL workbench for macOS, DataGrip-inspired, with one blue accent.
colors:
  accent: "oklch(0.62 0.17 240)"
  accent-hover: "oklch(0.68 0.17 240)"
  on-accent: "#ffffff"
  selected-fill: "oklch(0.28 0.07 240)"
  selected-edge: "oklch(0.62 0.17 240)"
  ok: "oklch(0.6 0.14 155)"
  warn: "oklch(0.7 0.15 75)"
  err: "oklch(0.58 0.19 25)"
  info: "oklch(0.62 0.14 240)"
  magenta: "oklch(0.6 0.18 320)"
  purple: "oklch(0.58 0.17 290)"
  bg: "#1a1917"
  chrome: "#252320"
  chrome-hi: "#2d2b27"
  panel: "#1f1d1b"
  panel-alt: "#232120"
  sidebar: "#1d1b19"
  grid-header: "#232120"
  text: "#ecebe8"
  text-sec: "#a9a59d"
  text-dim: "#908c83"
  border: "rgba(255, 255, 255, 0.07)"
  border-strong: "rgba(255, 255, 255, 0.13)"
  divider: "rgba(255, 255, 255, 0.05)"
  hover: "rgba(255, 255, 255, 0.04)"
  grid-stripe: "rgba(255, 255, 255, 0.018)"
  bg-light: "#f3f1ec"
  chrome-light: "#e8e5df"
  chrome-hi-light: "#f7f5f1"
  panel-light: "#fbfaf7"
  panel-alt-light: "#f6f4ef"
  grid-header-light: "#f0ede7"
  text-light: "#1c1b19"
  text-sec-light: "#5a574f"
  text-dim-light: "#67635a"
  selected-fill-light: "oklch(0.93 0.04 240)"
  selected-edge-light: "oklch(0.7 0.14 240)"
  syntax-keyword: "#c586c0"
  syntax-identifier: "#bcbec4"
  syntax-function: "#56a8f5"
  syntax-type: "#4ec9b0"
  syntax-string: "#6aab73"
  syntax-constant: "#5394ec"
  syntax-operator: "#a9a59d"
  syntax-comment: "#6a9955"
typography:
  title:
    fontFamily: "Monaco, Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  body:
    fontFamily: "Monaco, Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  control:
    fontFamily: "Monaco, Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  data:
    fontFamily: "Monaco, JetBrains Mono, SF Mono, ui-monospace, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: "Monaco, JetBrains Mono, SF Mono, ui-monospace, Menlo, monospace"
    fontSize: "10px"
    fontWeight: 400
    letterSpacing: "0.4px"
rounded:
  sm: "3px"
  md: "4px"
  toast: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "4px 14px"
  button-danger:
    backgroundColor: "{colors.err}"
    textColor: "#ffffff"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "4px 14px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-sec}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "4px 14px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "7px 10px"
  tab-active:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    height: "30px"
    padding: "0 10px"
  tab-idle:
    backgroundColor: "transparent"
    textColor: "{colors.text-sec}"
    height: "30px"
    padding: "0 10px"
  tree-row:
    textColor: "{colors.text}"
    typography: "{typography.body}"
    height: "24px"
  tree-row-selected:
    backgroundColor: "{colors.selected-fill}"
    textColor: "{colors.text}"
    height: "24px"
  dialog:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    width: "340px"
  toast:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.toast}"
    padding: "10px 12px"
---

# Design System: Snowy

<!-- Maintained with the Impeccable plugin (`/impeccable document`), which reads this file from the repo root. Its machine-readable companion is .impeccable/design.json. Safe to edit by hand; the source of truth for the values is frontend/src/style.css. -->

## Overview

**Creative North Star: "The Quiet Workbench"**

Snowy is a place where a developer sits down to work with data, and the interface stays out of the way. Surfaces are warm stone-grey rather than cold blue-grey or pure black and white; there is exactly one accent hue (a clear blue); chrome is drawn with hairline borders rather than boxes, shadows, or fills. Everything that is not the schema tree, the editor, or the result grid is kept at low contrast so the data leads.

The mood is calm, focused, dense, and precise: IDE-density 24px rows, 10–13px type, a monospace-first voice, and information-rich panels that still read as quiet. It should feel at home on macOS (a vibrancy-blurred chrome, restrained controls, no web-app flourish) and beautiful in the way a well-kept tool is: through proportion, alignment, and consistency rather than decoration. DataGrip is the binding reference for layout, theming and interaction; Snowy borrows its flat sidebar and editor-over-results arrangement.

Confirmed rejections: the pgAdmin look (nested-layer trees, dated web-admin chrome), the generic SaaS dashboard (large cards, gradients, big radii, colourful KPI tiles), and the neon "hacker terminal" (saturated green or cyan on pure black, glow).

**Key Characteristics:**
- Warm neutral surfaces in two themes (SnowyDark default, SnowyLight), switched by one `data-theme` attribute.
- One blue accent carries selection, focus, active tab and primary action; semantic colors appear only as status and environment signals.
- Hairline (0.5–1px) translucent borders instead of shadows for structure.
- Monospace-led typography at small sizes (10–13px), with 13px as the base.
- 24px tree rows and a 30px tab bar: density is a feature.
- Every color and font is a `--t-*` custom property exposed as `T.*`; no hex in components.

## Colors

A restrained palette: warm greys in layered steps, one saturated blue, and a small set of status hues. The frontmatter holds SnowyDark values (the `:root` default) and the SnowyLight overrides as `-light` keys; keys without a `-light` twin (accent, status hues, syntax) are shared by both themes.

### Primary
- **Workbench Blue** (`accent`): the single interactive voice. Selected-row edge, active tab underline, primary buttons, filter and pin states, dirty-tab dot, local-environment connections. `accent-hover` is a lighter step for hover.
- **Selection Wash** (`selected-fill`, `selected-edge`): a deep blue fill (light theme: pale blue) with a 2px left edge in the accent, for the selected tree row.

### Secondary
- **Status hues** (`ok`, `warn`, `err`, `info`): success / warning / error / information, used on toasts, validation, and environment tags. Always paired with an icon or label, never color alone.
- **Project hues** (`magenta`, `purple`, alongside accent, ok, warn, err): the six-color cycle assigned to project groups in the connection list.

### Neutral
- **Charcoal Floor** (`bg`, `#1a1917`; light `#f3f1ec`): window background and input wells.
- **Chrome Stone** (`chrome`, `#252320`; light `#e8e5df`): title bar, tab strip, toolbars. `chrome-hi` is the raised variant.
- **Panel** (`panel`, `#1f1d1b`; light `#fbfaf7`): editor, results, dialogs, active tab. `panel-alt` is the subtle alternate.
- **Sidebar** (`sidebar`, `#1d1b19`): schema explorer, a half-step darker than panel.
- **Ink** (`text`, `text-sec`, `text-dim`): primary, secondary and tertiary text. Dim is for metadata, counts, and placeholders; it is tuned to clear 4.5:1 on panel and chrome in both themes.
- **On Accent** (`on-accent`, `#ffffff`): text and icons placed on accent or danger fills.
- **Hairlines** (`border`, `border-strong`, `divider`): white-at-7%/13%/5% on dark, black-at-9%/14%/6% on light. The translucency lets surfaces change underneath without re-tuning.
- **Interaction** (`hover`, `grid-stripe`, `grid-header`): 4% overlay for hover, a barely-there 1.8% zebra stripe for result rows, and a header slightly offset from the panel.

### Syntax (editor)
Eight `syntax-*` colors, DataGrip-inspired: purple keywords, blue italic functions, teal types, green strings, blue constants, grey operators and identifiers, muted green italic comments. The frontmatter holds the SnowyDark values; SnowyLight overrides each in `style.css` with a darker hue so every token clears 4.5:1 on the light panel. The editor surface itself is the ordinary `panel` token, not a separate "code island".

### Named Rules
**The One Voice Rule.** Blue is the only chromatic color that means "interactive". If something is blue, you can act on it. Status hues report state; they never decorate.

**The Environment Rule.** Connection environments map to fixed hues: prod = `err`, stg = `warn`, dev = `ok`, local = `accent`. Production must never share a color with a safe environment.

**The Token Rule.** Components never contain hex; they read `T.*`. A new color is added to `style.css` and `tokens.ts` together, or it does not exist.

## Typography

**UI Font:** Monaco, with Inter, -apple-system, system-ui as fallbacks
**Data / Editor Font:** Monaco, with JetBrains Mono, SF Mono, ui-monospace, Menlo as fallbacks

**Character:** A monospace-led interface: Monaco is first in both stacks, so labels, tabs, and tree rows share the voice of the editor and grid. Differentiation comes from size and weight, not from switching families.

### Hierarchy
- **Title** (600, 13px): dialog titles, section headers, result column names, selected tree rows.
- **Body** (400, 13px): tree rows, grid cells, base UI text.
- **Control** (400, 12px; 11.5px for tab labels): inputs, buttons, form fields, toasts, tab text.
- **Data** (400, 13px, mono): result-grid values, SQL, identifiers, counts.
- **Label** (10–11px, `0.4px` tracking, uppercase for counters): row and duration counters, sub-folder rows (11px), badges.

### Named Rules
**The Small and Steady Rule.** Nothing in the chrome exceeds 13px. Hierarchy comes from weight (400 / 500 / 600) and ink step (`text`, `text-sec`, `text-dim`), not from size jumps.

## Layout

A fixed application shell, not a scrolling page: the window is 100vh with hidden overflow, and each region scrolls itself. A flat sidebar (datasources → schemas → tables, expanding inline) sits left; editor tabs and the SQL editor sit upper right with the results panel below, matching the DataGrip arrangement in `spec/design/`.

Density is IDE-level. Tree rows are 24px (22px for sub-folders) with 14px indentation per depth level and a 14px chevron gutter; the tab bar is 30px; result toolbars are 32px; dialog gutters are 20px with 14px gaps. Spacing runs on a 2/4/8/12/20px rhythm. Regions are separated by hairlines, not gutters or cards. The app is macOS-only; there is no responsive breakpoint system.

## Elevation & Depth

Flat by default. Structure is conveyed by tonal layering (bg → sidebar → panel → chrome) and hairline borders, never by shadow. Shadows exist only for things that float above the app.

### Shadow Vocabulary
- **Popover** (`box-shadow: 0 1px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(0,0,0,0.4)` dark; `…0.04 / 0.06` light): menus and floating surfaces (`--t-shadow`).
- **Modal** (`--t-shadow-modal`, `box-shadow: 0 8px 32px rgba(0,0,0,0.5)` dark / `0.18` light), over the shared `--t-scrim` backdrop (50% black dark, 32% warm ink light, no blur): every modal dialog.
- Toasts, the find bar, the sidebar context menu, the appearance menu and the autocomplete popup all use the Popover shadow; there is no separate toast shadow.
- **Vibrancy** (`--t-vibrancy`, 85% chrome color): translucent chrome for blurred surfaces.

### Named Rules
**The Flat-Until-Floating Rule.** Anything docked in the layout is flat and hairline-bordered. Only overlays (menus, dialogs, toasts) get a shadow.

## Shapes

Small, tight, utilitarian radii. Controls and inputs use 4px; small chips and tab close buttons use 3px; toasts use 6px; dialogs use 8px, the largest in the system. There are no pills and no large rounded cards. Tabs and tree rows are square-edged; selection is signalled by a 2px accent edge, not a rounded highlight. Borders are 0.5px on chrome seams and 1px around inputs and dialogs. Scrollbars are 10px with a 5px-radius thumb inset by a 2px bg-colored border.

## Components

### Buttons
- **Shape:** 4px radius, 12px text, padding `4px 14px`.
- **Primary:** `accent` fill, white text, weight 500. The Save / confirm action.
- **Danger:** `err` fill, white text; the confirm action for destructive dialogs (e.g. "Close anyway").
- **Secondary:** transparent with a 1px `border`, `text-sec` text; Cancel.
- **Icon buttons:** borderless, transparent, 11–13px lucide icons in `text-dim` / `text-sec`; the accent tint marks an active toggle (filter, pin).
- **States:** hover brightens fill buttons and washes ghost buttons with `hover`; active dims slightly; disabled is inert. Keyboard focus shows a 2px `accent` ring (1px inset on inputs), drawn once, globally, with `:focus-visible`; the CodeMirror pane is exempt (its caret and active line carry focus).

### Tabs (query consoles)
- **Style:** 30px strip on `chrome`; the active tab lifts to `panel` with a 2px accent underline and a semibold mono label; idle tabs are transparent with `text-sec`.
- **Details:** 100–200px wide, a 12px file icon (accent when active), a dirty dot `●` in accent, a close `×` in `text-dim`, 0.5px right-hand dividers.

### Tree rows (schema explorer)
- **Style:** 24px rows, 13px text, chevron + icon + ellipsized label + right-aligned dim mono meta (counts, types).
- **States:** hover is a 4% overlay; selected is `selected-fill` with a 2px `selected-edge` left border and semibold text. Connections wear their environment color.

### Inputs / Fields
- **Style:** `bg` fill (a recessed well inside panels), 1px `border`, 4px radius, `7px 10px` padding, 12px text; mono for SQL-like values.
- **Focus:** the border shifts to `accent` (form fields) or a 1px inset accent ring (dialog and find inputs); composite fields such as the sidebar filter show the ring on their wrapper.

### Results grid
- **Style:** mono 13px cells, 1px `divider` row lines, 1.8% zebra stripe, sticky `grid-header` with semibold column names, type icons (hash in accent at 50%, text in dim), draggable column resize handles.
- **Selection:** cell/row highlight is painted by our own cell background; native text selection is made transparent so ⌘C still works.
- **Chrome:** 32px toolbar with icon buttons, a pinned-tab chip, and an uppercase mono row/duration counter on the right.

### Dialogs
- **Style:** 340px wide, `panel` surface, 1px `border-strong`, 8px radius, 20px padding, 14px gaps; semibold 13px title, buttons right-aligned. Enter confirms, Esc cancels.

### Toasts
- **Style:** `panel` surface faintly tinted with the status color (8%), a 0.5px border at the status color, 6px radius, status icon + 12px message + dismiss, stacked bottom-right, 8s auto-dismiss. No colored side stripe.

### Appearance menu
- **Style:** the sidebar-footer gear opens a small popover (System / Dark / Light, check on the active mode). System follows macOS live; the choice persists in `localStorage` and is applied before first paint.

### Environment badge (signature)
A connection's environment (prod / stg / dev / local) is expressed as a color on its row and list entry, per The Environment Rule. It is the one place semantic color is used decoratively, because the information it carries (which database am I touching) is safety-critical.

## Do's and Don'ts

### Do:
- **Do** take every color and font from `T.*` / `--t-*`; add new tokens to `style.css` and `tokens.ts` together.
- **Do** build structure from tonal steps and 0.5–1px translucent hairlines.
- **Do** keep chrome text at 10–13px and let weight and ink step carry hierarchy.
- **Do** reserve the accent blue for interactive and selected state.
- **Do** check every new surface in both SnowyDark and SnowyLight; both are reachable from the appearance menu.
- **Do** keep tree rows at 24px (22px for sub-folders) and let data take the visual priority.
- **Do** pair every status color with an icon or label.

### Don't:
- **Don't** use hardcoded hex in components (ADR-0004).
- **Don't** reproduce the pgAdmin look: no deeply nested connection → server → database → schema chains, and no heavy web-admin chrome.
- **Don't** build a generic SaaS dashboard: no big cards, gradients, rounded-xl corners, or colorful KPI tiles.
- **Don't** drift toward a neon "hacker terminal": no saturated green or cyan on pure black, no glow.
- **Don't** put shadows on docked panels; shadows belong to overlays.
- **Don't** use pure black or pure white as a surface; stay on the warm neutral ramp.
- **Don't** introduce a second interactive hue next to the accent blue.
- **Don't** use a spacing utility without checking it compiled; Tailwind v4 needs `@import "tailwindcss";` at the top of `style.css`.
