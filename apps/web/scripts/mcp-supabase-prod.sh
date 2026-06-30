#!/usr/bin/env bash
# Launches the Supabase MCP server bound to the PROD project, read-only.
# Reads SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF from apps/web/.env.prod.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f "./.env.prod" ]]; then
  echo "mcp-supabase-prod: apps/web/.env.prod not found" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. "./.env.prod"
set +a

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN missing in .env.prod}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF missing in .env.prod}"

exec npx -y @supabase/mcp-server-supabase \
  --read-only \
  --project-ref "$SUPABASE_PROJECT_REF" \
  --features=database,docs
