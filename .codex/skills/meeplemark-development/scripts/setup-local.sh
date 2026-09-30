#!/usr/bin/env bash
set -euo pipefail

mode="${1:-guest}"
case "$mode" in
  guest|account) ;;
  -h|--help)
    echo "Usage: $0 [guest|account]"
    exit 0
    ;;
  *)
    echo "Unknown mode: $mode" >&2
    echo "Usage: $0 [guest|account]" >&2
    exit 2
    ;;
esac

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../../../.." && pwd)"
cd "$repo_root"

command -v node >/dev/null 2>&1 || { echo "Node.js 22 or later is required." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required." >&2; exit 1; }

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if (( node_major < 22 )); then
  echo "Node.js 22 or later is required; found $(node --version)." >&2
  exit 1
fi

npm ci

if [[ "$mode" == "account" ]]; then
  command -v docker >/dev/null 2>&1 || { echo "Docker is required for account mode." >&2; exit 1; }
  docker compose -f compose.integration.yaml up -d --wait test-db
  DATABASE_URL="postgres://meeplemark_test:integration-only@127.0.0.1:55432/meeplemark_test" npm run migrate

  echo
  echo "Setup complete. Start these in separate terminals:"
  echo "  DATABASE_URL=postgres://meeplemark_test:integration-only@127.0.0.1:55432/meeplemark_test npm run dev:server"
  echo "  npm run dev"
else
  echo
  echo "Setup complete. Start the guest app with:"
  echo "  npm run dev"
fi
