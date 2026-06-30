# DB Environment Workflow — Design

**Date:** 2026-04-26
**Status:** Draft, awaiting review

## Problem

Production incidents currently require manual dashboard navigation to inspect data, schema, and migration state. Switching the Supabase CLI between `local`, `test`, and `prod` environments overwrites `apps/web/supabase/.temp/project-ref` on every `supabase link`, making ad-hoc multi-env work noisy and error-prone. Claude has no direct way to query remote databases, so investigating a client report means the human re-runs the same lookups by hand.

## Goals

1. Claude can browse remote schemas, migrations, and table data on **test and prod**, read-only.
2. The human can run ad-hoc Supabase CLI commands against any environment without losing the current `supabase link` state.
3. The end-to-end "client report → fix → promote" flow is reproducible: same triage steps, same branch conventions, same promotion sequence each time.
4. No write access to remote databases from Claude. The human remains the only writer.

## Non-Goals

- Replacing the Supabase Studio dashboard for human use. The dashboard stays as a fallback.
- Automating production migration pushes. Prod pushes remain human-initiated and human-executed.
- Building a custom UI for incident triage. Skills + MCP cover the workflow.

## CLI invocation rule (applies throughout)

| Op type | Use |
|---|---|
| Remote (test or prod): push, migration list, db dump, inspect, etc. | `./scripts/sb <env> <args...>` from `apps/web/` |
| Local Docker: start, stop, status, db reset, db diff, db lint | bare `supabase ...` from `apps/web/` |
| Composed local helpers (e.g. typegen runs to two output paths) | `pnpm` script — earns its layer |

Never `pnpm supabase:web:*` for remote ops. Never bare `supabase` for remote ops either — the wrapper uses `--db-url` and avoids clobbering local link state.

## Architecture

Three pieces, each with a single responsibility:

```
┌──────────────────────────┐   ┌──────────────────────────┐
│ Supabase MCP servers     │   │ apps/web/scripts/sb      │
│ (read-only, per env)     │   │ (env-aware CLI wrapper)  │
│                          │   │                          │
│ Used by: Claude          │   │ Used by: human           │
└──────────────────────────┘   └──────────────────────────┘
            │                             │
            └──────────────┬──────────────┘
                           │
                ┌──────────────────────┐
                │ .claude/skills/      │
                │ (workflow playbooks) │
                │                      │
                │ Used by: Claude      │
                └──────────────────────┘
```

## Component 1 — Supabase MCP servers

Add three entries to the project `.mcp.json`:

```json
{
  "mcpServers": {
    "supabase-local": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase", "--read-only", "--project-ref", "<local-ref>", "--features=database,docs"],
      "env": { "SUPABASE_ACCESS_TOKEN": "${SUPABASE_PAT_LOCAL}" }
    },
    "supabase-test": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase", "--read-only", "--project-ref", "<test-ref>", "--features=database,docs"],
      "env": { "SUPABASE_ACCESS_TOKEN": "${SUPABASE_PAT}" }
    },
    "supabase-prod": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase", "--read-only", "--project-ref", "<prod-ref>", "--features=database,docs"],
      "env": { "SUPABASE_ACCESS_TOKEN": "${SUPABASE_PAT}" }
    }
  }
}
```

Project refs come from `.env.local` / `.env.test` / `.env.prod` (`SUPABASE_PROJECT_REF`). The `SUPABASE_PAT` is a Supabase Personal Access Token scoped to the org; one token covers test + prod (local MCP is optional — local Studio at `:54323` covers most local browsing).

`--read-only` enforces server-side that no `INSERT/UPDATE/DELETE/DDL` succeeds.
`--features=database,docs` excludes branches/storage/auth-management to keep the tool surface focused.

**Tools Claude gains, namespaced per env:** `list_tables`, `list_extensions`, `list_migrations`, `execute_sql`, `get_logs`, plus docs search.

## Component 2 — `apps/web/scripts/sb` wrapper

A ~15-line shell script that sources the per-env file and forwards to `supabase` using `--db-url` so the local link state is never touched.

```bash
#!/usr/bin/env bash
# Usage (run from apps/web/): ./scripts/sb <env> <supabase-args...>
#   env: local | test | prod
set -euo pipefail
env="${1:?usage: sb <env> <args...>}"; shift
case "$env" in
  local) DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" ;;
  test|prod)
    set -a; . "./.env.$env"; set +a
    : "${DATABASE_URL:?DATABASE_URL missing in .env.$env}"
    ;;
  *) echo "unknown env: $env" >&2; exit 1 ;;
esac
exec supabase --db-url "$DATABASE_URL" "$@"
```

Use cases:

```bash
./scripts/sb test migration list
./scripts/sb prod inspect db long-running-queries
./scripts/sb test db dump --schema public --data-only > /tmp/test-snapshot.sql
./scripts/sb test db push                # promotion step
```

`DATABASE_URL` (the direct connection string, not pooled) gets added to `.env.test` and `.env.prod` if not already present. Files are gitignored.

## Component 3 — Three workflow skills

Project-scoped, in `.claude/skills/`, so they ship with the repo. Each is a single markdown file with frontmatter:

### `triaging-db-issue`

**`description`:** "Use when the user pastes a client report, error message, or row id, or asks why something is wrong on prod or test. Investigates read-only via the supabase MCP servers and reports finding → hypothesis → proposed fix → blast radius before any code change."

**Body covers:**
- Default env = prod unless the user named test.
- Step 1: SELECT the offending row(s) plus 1-hop context via `mcp__supabase-<env>__execute_sql`.
- Step 2: `mcp__supabase-<env>__list_migrations` filtered to affected tables; flag anything from the last 30 days.
- Step 3: Read relevant loader / RPC / server action in the repo (Read tool, no edits).
- Step 4: Report in fixed format — **Finding / Hypothesis / Proposed Fix / Blast Radius**. No migration, no branch, no code yet.
- Stop here. Wait for "let's fix it" before invoking `fixing-db-issue`.

### `fixing-db-issue`

**`description`:** "Use when the user accepts a triage hypothesis or says 'open a branch', 'let's fix it', or similar. Creates a fix branch, writes a migration (declarative-first), resets local, runs typegen and verification."

**Body covers:**
- Branch name: derive from task id present in the source report; never auto-prefix `blz-` unless the report has it (per `feedback_branch_naming` memory).
- Migration: edit `apps/web/supabase/schemas/*.sql` first; from `apps/web/`, run `supabase db diff -f <name>` to generate. Imperative migration (raw SQL in `migrations/`) only if the change isn't expressible declaratively.
- From `apps/web/`: `supabase db reset` → then `pnpm supabase:web:typegen` (composed: writes both type files) → then `pnpm typecheck`.
- Run affected tests (`pnpm test --filter ...` scoped to touched packages).
- Commit, push, open PR against `testing`. PR body links the source report.

### `promoting-db-fix`

**`description`:** "Use when the user says 'promote to test', 'push to prod', or confirms a PR has been merged into testing. Walks through the multi-env push sequence with explicit pauses for human approval."

**Body covers:**
- Confirm the PR is squash-merged into `testing` before any push (check via `gh pr view`).
- `cd apps/web && ./scripts/sb test migration list` → show pending diff.
- Pause. On user "go": `./scripts/sb test db push`. Re-run `./scripts/sb test migration list` to confirm.
- Seed if requested (see Open Items — `sb test db push --include-seed` once seed file is ready).
- For prod: same migration-list step against `prod`, but **never** push prod. Print the exact `./scripts/sb prod db push` command for the user to copy and run themselves.

Skills are authored using `superpowers:writing-skills` so each one passes that skill's lint (frontmatter present, description includes trigger language, body is rigid where it needs to be).

## End-to-End Flow

1. Client reports an issue; user pastes the report into chat.
2. Claude invokes `triaging-db-issue` → reports finding + hypothesis.
3. User accepts → Claude invokes `fixing-db-issue` → branch, migration, local repro, PR to `testing`.
4. User merges PR (squashed). User says "promote to test".
5. Claude invokes `promoting-db-fix` → walks through `./scripts/sb test db push`, pauses for approval, then prints the prod command for the user to execute.

## Security Considerations

- **MCP `--read-only` flag** is the primary guard. Without it, `execute_sql` can mutate data. Treat absence of the flag as a config bug.
- **`SUPABASE_PAT` and `DATABASE_URL`** are secrets. `DATABASE_URL` lives in `.env.test` / `.env.prod` (gitignored), read by the `sb` wrapper via `set -a && . ./.env.<env>`. The PAT used by the MCP servers is the open question: `.mcp.json` env values may or may not honor `${VAR}` expansion depending on Claude Code version. Implementation plan must pick one of: (a) wrapper script `scripts/mcp-supabase-<env>.sh` that sources env then `exec npx ...`, (b) gitignore `.mcp.json` and inline the PAT, or (c) confirm env-var expansion works on the user's CC version. Option (a) is safest.
- **PII in MCP responses.** SELECTs against prod will return real cardholder data. The user accepts this; no separate masking layer in v1. If needed later, a `claude_readonly` Postgres role with column-level grants can replace the default credentials.
- **Audit trail.** Every `execute_sql` call by Claude shows in transcript. Supabase logs also capture queries via `get_logs` — useful for after-the-fact review.

## Testing / Verification

This is tooling, not a code feature, but each piece has a smoke check:

- **MCP:** `mcp__supabase-prod__list_tables` returns the public schema. `mcp__supabase-prod__execute_sql` with `INSERT INTO ...` returns a permission error.
- **Wrapper:** `./scripts/sb test migration list` returns the expected pending list and `cat apps/web/supabase/.temp/project-ref` is unchanged before vs. after the call.
- **Skills:** Manually trigger by pasting a fake report ("client says cardholder X can't see discount Y on prod") and confirm Claude invokes `triaging-db-issue` and stops at the report-back step.

## Open Items / Future Work

- A `seed.sql` for the test environment plus `./scripts/sb test db push --include-seed` step in the promote skill — does not exist yet.
- A potential `db-rollback` skill if a bad migration ships — not in scope for v1.
- Consider the `branches` MCP feature later for ephemeral preview DBs per PR.
- Existing `pnpm supabase:web:push:test|prod` and `pnpm supabase:web:migrations:list:test|prod` scripts become redundant once the wrapper lands. Decide later: delete them, or keep as legacy aliases that call the wrapper.
- MCP env-var injection mechanism (see Security Considerations) needs a final pick before implementation.

## Out of Scope

- Replacing or wrapping Supabase Studio.
- Automating production migration pushes.
- Adding write capabilities for Claude (revisit only if access mode changes from A).
- Cross-project tooling (this design is project-vulpecula specific).
