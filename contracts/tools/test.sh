#!/usr/bin/env bash
# Runs the contract unit tests and the near-workspaces sandbox integration tests.
#
# The sandbox node (neard) asks for a 65535 open-files limit at startup. Some
# containers cap the hard limit lower and can't raise it; there we preload a
# tiny shim (tools/fdlimit-shim.c) that clamps the request to the allowed max.
set -euo pipefail
cd "$(dirname "$0")/.."

# near-workspaces compiles both contracts by calling the `cargo near` CLI.
if ! cargo near --version >/dev/null 2>&1; then
  echo "error: cargo-near is not installed. Install it with: cargo install --locked cargo-near@0.23.0" >&2
  echo "       (see README → For judges → Prerequisites)" >&2
  exit 1
fi

PRELOAD=""
HARD=$(ulimit -Hn)
if [[ "$HARD" != "unlimited" && "$HARD" -lt 65535 ]]; then
  if command -v cc >/dev/null 2>&1; then
    mkdir -p target
    cc -shared -fPIC -O2 -o target/fdlimit-shim.so tools/fdlimit-shim.c -ldl
    PRELOAD="$(pwd)/target/fdlimit-shim.so"
    echo "note: open-files hard limit is $HARD (<65535); using tools/fdlimit-shim.c for the sandbox"
  else
    echo "warning: open-files hard limit is $HARD and no C compiler to build the shim; sandbox may fail to start" >&2
  fi
fi

THREADS="${CALLSIGN_TEST_THREADS:-4}"
LD_PRELOAD="$PRELOAD" cargo test --workspace -- --test-threads="$THREADS" "$@"
