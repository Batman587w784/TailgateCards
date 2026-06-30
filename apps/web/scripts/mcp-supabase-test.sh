#!/usr/bin/env bash
# Launches the Supabase MCP server bound to the TEST project, read-only.
# Reads SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF from apps/web/.env.test.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f "./.env.test" ]]; then
  echo "mcp-supabase-test: apps/web/.env.test not found" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. "./.env.test"
set +a

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN missing in .env.test}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF missing in .env.test}"

exec npx -y @supabase/mcp-server-supabase \
  --read-only \
  --project-ref "$SUPABASE_PROJECT_REF" \
  --features=database,docs
