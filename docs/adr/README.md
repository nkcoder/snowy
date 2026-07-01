# Architecture Decision Records

This directory records the **consequential, hard-to-reverse decisions** behind Snowy — the "why," not the "how." Code and `CLAUDE.md` describe how the system works today; ADRs explain why it works that way, so a future contributor (human or AI) can tell a deliberate choice from an accident.

We use a lightweight [MADR](https://adr.github.io/madr/)-style format. Each record is immutable once **Accepted** — to change a decision, add a new ADR that supersedes the old one (and note it in both).

## Template

```markdown
# ADR-NNNN: <short title>

- **Status:** Proposed | Accepted | Superseded by ADR-XXXX
- **Date:** YYYY-MM-DD

## Context
What forces are at play? What problem or constraint prompted a decision?

## Decision
What we chose to do.

## Consequences
The trade-offs — what gets easier, what gets harder, what we accept.
```

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-wails-over-electron.md) | Wails (Go + React) over Electron | Accepted |
| [0002](0002-connection-pooling.md) | Pooled `pgx` connections with stale-pool retry | Accepted |
| [0003](0003-keychain-password-storage.md) | Store passwords in the macOS Keychain, not on disk | Accepted |
| [0004](0004-design-tokens.md) | CSS-custom-property design tokens (`T.*`) | Accepted |
| [0005](0005-manual-wails-bindings.md) | Hand-maintained Wails binding mirrors | Accepted |
| [0006](0006-local-file-storage.md) | Plain-file local storage + on-disk metadata cache | Accepted |
