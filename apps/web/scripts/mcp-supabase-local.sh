#!/usr/bin/env bash
# Launches the Supabase MCP server against the LOCAL Docker stack, read-only.
# Local Studio (:54323) usually suffices; this exists for parity with test/prod.
set -euo pipefail

# Local project ref comes from supabase/config.toml (project_id field).
PROJECT_REF="$(grep -E '^project_id' "$(dirname "$0")/../supabase/config.toml" | cut -d'"' -f2)"
: "${PROJECT_REF:?could not parse project_id from supabase/config.toml}"

# Local stack does not require an access token.
exec npx -y @supabase/mcp-server-supabase \
  --read-only \
  --project-ref "$PROJECT_REF" \
  --features=database,docs
