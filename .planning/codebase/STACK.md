# Technology Stack

**Analysis Date:** 2026-04-26

## Overview

Snowy is a native desktop PostgreSQL GUI client. The backend is Go, the frontend is React/TypeScript, and the two are bridged by Wails v2, which embeds the built frontend into the Go binary and exposes Go methods as callable JS functions via WebSocket/WebView.

## Languages & Runtimes

**Backend:**
- Go 1.25.0 (declared in `go.mod`; runtime on this machine: go1.26.2 darwin/arm64)
- No CGO dependencies beyond what Wails requires for the native WebView

**Frontend:**
- TypeScript 6.0.3 (`frontend/package.json`)
- Target: ESNext (`frontend/tsconfig.json`)
- Strict mode enabled: `"strict": true`

**Runtime:**
- Node.js 24.13.0 (frontend toolchain only; not bundled into the app)
- npm 11.6.2

## Key Dependencies

**Backend (go.mod):**

| Package | Version | Purpose |
|---------|---------|---------|
| `github.com/wailsapp/wails/v2` | v2.12.0 | Desktop app framework — WebView bridge, JS bindings, asset embedding |
| `github.com/jackc/pgx/v5` | v5.9.2 | PostgreSQL driver (no ORM; raw SQL via `pgx.Conn`) |
| `github.com/google/uuid` | v1.6.0 | UUID generation (indirect via Wails) |
| `github.com/gorilla/websocket` | v1.5.3 | WebSocket transport used by Wails dev mode |
| `github.com/labstack/echo/v4` | v4.13.3 | HTTP server used internally by Wails |
| `golang.org/x/crypto` | v0.33.0 | Crypto primitives (indirect) |

**Frontend (frontend/package.json):**

| Package | Version | Purpose |
|---------|---------|---------|
| `react` / `react-dom` | ^19.2.5 | UI framework |
| `@codemirror/view` | ^6.41.1 | CodeMirror 6 editor core |
| `@codemirror/state` | ^6.6.0 | CodeMirror editor state |
| `@codemirror/lang-sql` | ^6.10.0 | SQL syntax highlighting + completions |
| `@codemirror/commands` | ^6.10.3 | Editor keymaps (Cmd+Enter, Cmd+S) |
| `@codemirror/theme-one-dark` | ^6.1.3 | Dark theme for CodeMirror |
| `@codemirror/language` | ^6.12.3 | Language support infrastructure |
| `lucide-react` | ^1.9.0 | Icon set |
| `tailwind-merge` | ^3.5.0 | Tailwind class merging utility |
| `clsx` | ^2.1.1 | Conditional className utility |
| `class-variance-authority` | ^0.7.1 | Component variant styling |

## Build Tooling

**Primary build command:**
```bash
wails build        # Compiles Go + embeds frontend/dist into a native binary
wails dev          # Hot-reload dev mode: runs Vite dev server + Go with live bindings
```

**Frontend build chain:**
```bash
cd frontend && npm run build   # tsc (type check) + vite build → frontend/dist/
```

- Vite 8.0.10 — module bundler (`frontend/vite.config.ts`)
- `@vitejs/plugin-react` 6.0.1 — JSX transform (Babel-based, not SWC)
- `@babel/plugin-transform-react-jsx-development` 7.27.1 — dev JSX transform
- TypeScript compiler (`tsc`) runs before Vite build for type validation
- PostCSS 8.5.10 + `@tailwindcss/postcss` 4.2.4 — CSS processing
- Tailwind CSS 4.2.4 — utility-first CSS (`frontend/tailwind.config.js`, `frontend/postcss.config.js`)
- `frontend/dist` must exist before `wails build`; `wails build` handles this automatically

**Wails configuration:** `wails.json` at repo root
- Frontend install: `npm install`
- Frontend build: `npm run build`
- Frontend dev watcher: `npm run dev`

## Dev Tooling

**Testing — Unit/Component (frontend):**
- Vitest 4.1.5 (`frontend/vitest.config.ts`)
- jsdom 29.0.2 — browser environment simulation
- `@testing-library/react` 16.3.2 + `@testing-library/user-event` 14.6.1
- `@testing-library/jest-dom` 6.9.1 — custom matchers
- `@vitest/coverage-v8` 4.1.5 — V8 coverage provider
- Test files: `frontend/src/**/*.{test,spec}.{ts,tsx}`
- Wails JS bindings are mocked at `frontend/src/test/mocks/wailsjs.ts`

**Testing — Unit (backend):**
- Go standard `testing` package
- Test files: `config_test.go`, `query_service_test.go`, `history_service_test.go`

**Testing — E2E:**
- Playwright 1.59.1 (`playwright.config.ts` at repo root)
- Tests in `e2e/`; runs against Vite dev server at `http://localhost:5173`
- Browser: Chromium only (Desktop Chrome profile)
- Root `package.json` scripts: `npm test` / `npm run test:e2e`

**No linting config detected** — no `.eslintrc*`, `biome.json`, or Biome config present (roadmap notes Biome planned for CI).

---

*Stack analysis: 2026-04-26*
