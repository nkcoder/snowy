# Snowy local development. Run `just` to list these.

set shell := ["bash", "-uc"]

compose := "docker compose -f docker/docker-compose-postgresql.yml"
logfile := ".dev/wails.log"
pidfile := ".dev/wails.pid"

# List available commands
default:
    @just --list

# Start the demo database and the app in the background
start:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -f {{ pidfile }} ] && kill -0 "$(cat {{ pidfile }})" 2>/dev/null; then
        echo "already running (pid $(cat {{ pidfile }})) — 'just logs' to follow it"
        exit 0
    fi
    mkdir -p .dev
    {{ compose }} up -d
    until docker exec postgres_db pg_isready -q; do sleep 1; done
    nohup wails dev >{{ logfile }} 2>&1 &
    echo $! >{{ pidfile }}
    echo "started (pid $(cat {{ pidfile }})) — 'just logs' to follow, 'just stop' to stop"

# Stop the app and the demo database
stop:
    #!/usr/bin/env bash
    set -uo pipefail
    if [ -f {{ pidfile }} ] && kill -0 "$(cat {{ pidfile }})" 2>/dev/null; then
        pid=$(cat {{ pidfile }})
        kill "$pid"
        for _ in $(seq 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
        kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f {{ pidfile }}
    pkill -f '[w]ails dev' || true
    {{ compose }} down

# Follow the app logs
logs:
    #!/usr/bin/env bash
    test -f {{ logfile }} || { echo "no log yet — run 'just start'"; exit 1; }
    tail -n 100 -f {{ logfile }}

# Run every test suite: frontend unit, backend, e2e
test:
    cd frontend && npm run test
    go test .
    npx playwright test
