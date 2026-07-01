# ADR-0001: Wails (Go + React) over Electron

- **Status:** Accepted
- **Date:** 2026-07-01

## Context
Snowy is a desktop PostgreSQL GUI. The two obvious paths for a web-tech UI on the desktop are Electron (bundles Chromium + Node) and Wails (uses the OS-native WebView + a Go backend). We wanted a small, fast download, a native feel on macOS, and a backend language with first-class PostgreSQL drivers and easy static binaries.

## Decision
Build with **Wails v2**: a Go backend that exposes methods to a React/TypeScript frontend through generated bindings, compiled into a single native binary with the frontend embedded at build time (`main.go` embeds `frontend/dist`).

## Consequences
- **Easier:** tiny binary (no bundled Chromium), native window/WebView, Go's `pgx` driver and goroutines for DB work, trivial cross-compilation to a single file.
- **Harder:** we depend on the OS WebView (rendering can differ slightly from Chrome — relevant to the frameless title-bar/traffic-light region); the Go↔JS boundary needs binding mirrors kept in sync (see [ADR-0005](0005-manual-wails-bindings.md)); the ecosystem is smaller than Electron's.
- **Accepted:** primary target is macOS; we trade Electron's uniform rendering for size and nativeness.
