# ADR-0002: Pooled `pgx` connections with stale-pool retry

- **Status:** Accepted
- **Date:** 2026-07-01

## Context
Snowy issues many small queries: schema introspection while browsing the tree, autocomplete metadata, and user queries. An earlier design opened a fresh `pgx.Conn` per call. That is simple but pays full TCP + TLS + auth latency on every action, which is noticeable when expanding the sidebar. Desktop apps also sit idle for long stretches, after which a NAT/firewall may have silently dropped the underlying TCP connections.

## Decision
Keep one **`pgxpool.Pool` per datasource**, created lazily and cached in `DbService.pools` (a `sync.Map`), with creation serialized by a mutex and a double-checked load. Pool sizing: `MaxConns 5`, `MinConns 0`, `MaxConnIdleTime 5m`, `MaxConnLifetime 30m`. `acquire()` borrows a connection and, if `Acquire` fails for a non-context reason (the classic "stale pool after long idle" case), **discards the pool and retries once** with a freshly built one. Pools are closed on disconnect and when credentials change (`closePool`), which also evicts the completion cache.

## Consequences
- **Easier:** warm connections make browsing/autocomplete snappy; the retry hides idle-disconnect blips so the user rarely sees a transient error.
- **Harder:** more state to manage than per-call connections (lifecycle on disconnect/credential change must be correct); a stale pool costs one failed attempt before recovery.
- **Accepted:** a small, bounded pool per datasource is the right trade for an interactive client. Sizing constants are currently inline (see code-review L5).
