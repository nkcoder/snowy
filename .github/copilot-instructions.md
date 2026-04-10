# Copilot Workspace Instructions

This repository is a Wails-based macOS GUI client for PostgreSQL. It uses Go for backend logic and React + TypeScript for the frontend, with TailwindCSS styling.

## What this workspace is

- `wails.json` configures the Wails app.
- `main.go` and `app.go` are the Go backend entry points.
- `frontend/` contains the React + Vite frontend.
- `docker-compose.yml` starts a local PostgreSQL database for development.
- `demo.sql` is a sample schema to populate the dev database.

## Key commands

- `docker-compose up -d` — start the PostgreSQL dev database
- `go mod tidy` — sync Go dependencies
- `cd frontend && npm install` — install frontend dependencies
- `wails dev` — run the app in development mode
- `wails build` — build the desktop app
- `cd frontend && npm run dev` — run Vite frontend dev server
- `cd frontend && npm run build` — build frontend assets

## Where to work

- Backend code: root Go files and any future Go packages added under `backend/` or the root.
- Frontend UI: `frontend/src/`, especially `App.tsx`, `main.tsx`, and component files under `frontend/src/components/`.
- Styling: Tailwind is configured in `frontend/tailwind.config.js`, `frontend/postcss.config.js`, and `frontend/src/style.css`.

## Conventions

- Keep work scoped to the app's current roadmap: project/datasource management, schema introspection, query editor, and refresh behavior.
- Prefer small, focused PR-style changes rather than large rewrites.
- Preserve the planned architecture: Go backend + Wails binding, React frontend with Tailwind.
- Do not edit generated or build output files unless the change is directly required.

## Important notes

- The frontend uses Tailwind v4 with `@tailwindcss/postcss`.
- `frontend/src/lib/utils.ts` currently contains shared helper utilities.
- `frontend/dist/` is generated output and should be ignored for development changes.
- Database credentials and app state should be stored securely in future iterations; current plan uses encrypted app storage with a later Keychain upgrade.

**Notes**: For the features and UI layout, clone DataGrip. 

## If you need context

Use `README.md` in the repo root as the primary source of current goals and project scope. If asked for implementation next steps, follow the roadmap sections there.
