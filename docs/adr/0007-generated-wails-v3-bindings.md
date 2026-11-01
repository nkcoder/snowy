# ADR-0007: Generated Wails v3 bindings behind a `backend/` seam

- **Status:** Accepted
- **Date:** 2026-11-01
- **Supersedes:** [ADR-0005](0005-manual-wails-bindings.md)

## Context
Wails v3 generates typed TypeScript bindings (`frontend/bindings/`) that call Go through the Wails runtime by method ID, not through `window.go`. The v2-era approach of hand-mirroring bindings and mocking `window.go` no longer applies.

## Decision
Commit the generated bindings and never edit them. Components import only from `frontend/src/backend/` (`app`, `models`, `events`), which is the single seam the tests replace: vitest mocks it, and Playwright aliases `backend/app` to `e2e/backend-shim.ts` (over the existing `window.go` mock) when Vite runs with `E2E_MOCK=1`.

## Consequences
- **Easier:** no hand-maintained binding mirrors; types come from the Go structs.
- **Harder:** a new Go method needs a regenerate step plus an entry in the vitest mock, the e2e shim and the e2e bridge.
- **Accepted:** unit and e2e tests still run against mocks, so real bindings are verified by running the app.
