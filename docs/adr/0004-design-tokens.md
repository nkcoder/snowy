# ADR-0004: CSS-custom-property design tokens (`T.*`)

- **Status:** Accepted
- **Date:** 2026-07-01

## Context
Snowy's look is deliberate and DataGrip-inspired, with a dark and a light theme. Hardcoding hex values across dozens of components makes theming impossible and lets visual drift creep in (slightly different greys everywhere). We needed one source of truth for color and typography that can switch themes at runtime without a rebuild.

## Decision
Define every color and font as a **CSS custom property** in `style.css` (`:root` = SnowyDark, `[data-theme=light]` = SnowyLight) and expose them to components through a single `T` object in `lib/tokens.ts`, where each key resolves to `var(--t-*)`. Components reference `T.bg`, `T.accent`, etc. — **never raw hex**. Theme switching is a single attribute flip on the root; the same `T.*` references re-resolve.

## Consequences
- **Easier:** consistent palette, runtime theming, one place to retune the design; reviewers can reject stray hex on sight.
- **Harder:** a small indirection to learn; values live in CSS while names live in TS, so adding a token means editing both.
- **Accepted:** the indirection is worth a coherent, themeable UI. "No hardcoded hex in components" is a standing rule.
