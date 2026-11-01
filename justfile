# Snowy local development. Run `just` to list these.

set shell := ["bash", "-uc"]

compose := "docker compose -f docker/docker-compose-postgresql.yml"
logfile := ".dev/wails.log"
pidfile := ".dev/wails.pid"

app := "snowy"
bin := "bin"
vite_port := "9245"

# Binding analysis and the Go build must see the same flags.
dev_flags := '-buildvcs=false -gcflags=all="-l"'
prod_flags := '-tags production -trimpath -buildvcs=false'

export CGO_ENABLED := "1"
export CGO_CFLAGS := "-mmacosx-version-min=12.0"
export CGO_LDFLAGS := "-mmacosx-version-min=12.0"
export MACOSX_DEPLOYMENT_TARGET := "12.0"

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
    nohup wails3 dev -config ./build/config.yml >{{ logfile }} 2>&1 &
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
    pkill -f '[w]ails3 dev' || true
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

# Hot-reload dev mode in the foreground (what `start` runs detached)
dev:
    wails3 dev -config ./build/config.yml -port {{ vite_port }}

# Production bin/snowy.app for this machine's architecture
package version="" build_date="": _tidy _frontend-deps (_bindings prod_flags) _icons _frontend-prod
    just _compile "$(go env GOARCH)" "{{ bin }}/{{ app }}" "{{ version }}" "{{ build_date }}"
    just _bundle "{{ bin }}/{{ app }}.app" build/darwin/Info.plist

# Production bin/snowy.app as a universal (arm64 + amd64) binary
package-universal version="" build_date="": _tidy _frontend-deps (_bindings prod_flags) _icons _frontend-prod
    just _compile amd64 "{{ bin }}/{{ app }}-amd64" "{{ version }}" "{{ build_date }}"
    just _compile arm64 "{{ bin }}/{{ app }}-arm64" "{{ version }}" "{{ build_date }}"
    lipo -create -output "{{ bin }}/{{ app }}" "{{ bin }}/{{ app }}-amd64" "{{ bin }}/{{ app }}-arm64"
    rm "{{ bin }}/{{ app }}-amd64" "{{ bin }}/{{ app }}-arm64"
    just _bundle "{{ bin }}/{{ app }}.app" build/darwin/Info.plist

# --- the steps `wails3 dev` runs (see dev_mode.executes in build/config.yml) ---

[private]
_build-dev: _tidy _frontend-deps (_bindings dev_flags) _icons
    cd frontend && npm run build:dev -q
    wails3 tool prepare-macos-output --dir "{{ bin }}"
    go build {{ dev_flags }} -o "{{ bin }}/{{ app }}"

[private]
_dev-frontend: _frontend-deps
    cd frontend && npm run dev -- --port {{ vite_port }} --strictPort

[private]
_run-dev:
    wails3 tool prepare-macos-output --dir "{{ bin }}"
    just _bundle "{{ bin }}/{{ app }}.dev.app" build/darwin/Info.dev.plist
    "{{ bin }}/{{ app }}.dev.app/Contents/MacOS/{{ app }}"

# --- shared steps ---

[private]
_tidy:
    go mod tidy

[private]
_frontend-deps:
    cd frontend && npm install

[private]
_frontend-prod:
    cd frontend && npm run build -q

# Regenerated bindings are classes (no -i): tests build fixtures with `createFrom`.
[private]
_bindings flags:
    wails3 generate bindings -f '{{ flags }}' -clean=true -ts

# The tool always writes a Windows .ico too; send it somewhere disposable.
[private]
_icons:
    #!/usr/bin/env bash
    set -euo pipefail
    [ build/darwin/icons.icns -nt build/appicon.png ] && exit 0
    cd build
    wails3 generate icons -input appicon.png -macfilename darwin/icons.icns \
        -windowsfilename "$(mktemp -d)/icon.ico" \
        -iconcomposerinput appicon.icon -macassetdir darwin

[private]
_compile arch output version build_date:
    #!/usr/bin/env bash
    set -euo pipefail
    ldflags="-w -s"
    [ -n "{{ version }}" ] && ldflags+=" -X main.Version={{ version }}"
    [ -n "{{ build_date }}" ] && ldflags+=" -X main.BuildDate={{ build_date }}"
    wails3 tool prepare-macos-output --dir "{{ bin }}"
    GOOS=darwin GOARCH={{ arch }} go build {{ prod_flags }} -ldflags="$ldflags" -o "{{ output }}"

# A fresh bundle each time: a reused one can pick up Finder metadata that breaks codesign.
[private]
_bundle dir plist:
    #!/usr/bin/env bash
    set -euo pipefail
    test -n "{{ dir }}" && rm -rf -- "{{ dir }}"
    mkdir -p "{{ dir }}/Contents/MacOS" "{{ dir }}/Contents/Resources"
    cp build/darwin/icons.icns "{{ dir }}/Contents/Resources"
    [ -f build/darwin/Assets.car ] && cp build/darwin/Assets.car "{{ dir }}/Contents/Resources"
    cp "{{ bin }}/{{ app }}" "{{ dir }}/Contents/MacOS"
    cp "{{ plist }}" "{{ dir }}/Contents/Info.plist"
    xattr -cr "{{ dir }}"
    codesign --force --deep --sign - "{{ dir }}"
    codesign --verify --deep --strict "{{ dir }}"
