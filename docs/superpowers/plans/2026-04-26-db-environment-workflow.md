# DB Environment Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Claude read-only access to test + prod databases via Supabase MCP, give the human a non-destructive CLI wrapper for env-switching, and codify the client-report → fix → promote flow as three project-scoped skills.

**Architecture:** Three independent components plumbed together. (1) `apps/web/scripts/sb` shell wrapper uses `--db-url` so `supabase` CLI calls don't clobber the linked project. (2) Three Supabase MCP servers registered in `.mcp.json`, each launched via a small wrapper script that sources `.env.<env>` so the existing `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` flow through. (3) Three skills in `.claude/skills/` written via `superpowers:writing-skills`.

**Tech Stack:** Bash, Supabase CLI, `@supabase/mcp-server-supabase` (npx), Claude Code MCP / skills.

**Spec reference:** `docs/superpowers/specs/2026-04-26-db-environment-workflow-design.md`

---

## File Structure

| Path | Purpose |
|---|---|
| `apps/web/scripts/sb` | Env-aware wrapper: `./scripts/sb <env> <supabase-args...>` (created) |
| `apps/web/scripts/mcp-supabase-test.sh` | Sources `.env.test`, execs the MCP server (created) |
| `apps/web/scripts/mcp-supabase-prod.sh` | Sources `.env.prod`, execs the MCP server (created) |
| `apps/web/scripts/mcp-supabase-local.sh` | Launches MCP server against local Docker (created, optional) |
| `.mcp.json` | Project MCP config — three new server entries (modified or created) |
| `apps/web/.env.test` | Add `DATABASE_URL` (modified — secret, user does this) |
| `apps/web/.env.prod` | Add `DATABASE_URL` (modified — secret, user does this) |
| `.claude/skills/triaging-db-issue.md` | Investigation playbook (created) |
| `.claude/skills/fixing-db-issue.md` | Branch + migration playbook (created) |
| `.claude/skills/promoting-db-fix.md` | Test → prod promotion playbook (created) |
| `apps/web/CLAUDE.md` | Add brief pointer to the three skills + the CLI invocation rule (modified) |

---

## Task 0: Create the implementation branch

**Files:** none.

- [ ] **Step 1: Create and switch to a working branch**

```bash
git switch -c feat/db-environment-workflow
```

- [ ] **Step 2: Confirm branch and clean tree**

Run: `git status -sb`
Expected: `## feat/db-environment-workflow` and no other lines.

---

## Task 1: `apps/web/scripts/sb` wrapper script

**Files:**
- Create: `apps/web/scripts/sb`

The wrapper sources `.env.<env>` for remote envs (test, prod) and constructs `DATABASE_URL` for local. It uses `supabase --db-url ...` so the linked project state is never touched.

- [ ] **Step 1: Create the script**

```bash
mkdir -p apps/web/scripts
```

Create `apps/web/scripts/sb` with the following content:

```bash
#!/usr/bin/env bash
# Env-aware Supabase CLI wrapper.
# Usage (from apps/web/): ./scripts/sb <env> <supabase-args...>
#   env: local | test | prod
#
# Uses --db-url so it never touches supabase/.temp/project-ref (the linked state).
set -euo pipefail

env="${1:?usage: sb <env> <supabase-args...>}"
shift

case "$env" in
  local)
    DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    ;;
  test|prod)
    if [[ ! -f "./.env.$env" ]]; then
      echo "sb: ./.env.$env not found (run from apps/web/)" >&2
      exit 1
    fi
    set -a
    # shellcheck disable=SC1090
    . "./.env.$env"
    set +a
    : "${DATABASE_URL:?DATABASE_URL missing in .env.$env (see plan Task 2)}"
    ;;
  *)
    echo "sb: unknown env '$env' (expected: local | test | prod)" >&2
    exit 1
    ;;
esac

exec supabase --db-url "$DATABASE_URL" "$@"
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x apps/web/scripts/sb
```

- [ ] **Step 3: Smoke test against local (does not need DATABASE_URL in env files yet)**

Prereq: local Supabase running (`cd apps/web && supabase status` shows running services). If not, start it: `cd apps/web && supabase start`.

Run from `apps/web/`:
```bash
./scripts/sb local migration list
```

Expected: a table of local migrations matching `ls supabase/migrations/`. No prompts. No errors. Exit code 0.

- [ ] **Step 4: Smoke test that link state is untouched**

Run from `apps/web/`:
```bash
ref_before=$(cat supabase/.temp/project-ref 2>/dev/null || echo "(none)")
./scripts/sb local migration list >/dev/null
ref_after=$(cat supabase/.temp/project-ref 2>/dev/null || echo "(none)")
[[ "$ref_before" == "$ref_after" ]] && echo "OK: link state preserved" || echo "FAIL: link state changed"
```

Expected: `OK: link state preserved`

- [ ] **Step 5: Smoke test argument forwarding (no env-file ops)**

Run from `apps/web/`:
```bash
./scripts/sb local --help | head -5
```

Expected: top of `supabase --help` output, no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/scripts/sb
git commit -m "feat(scripts): add env-aware sb wrapper for supabase CLI

Wraps 'supabase --db-url …' per environment (local|test|prod),
so ad-hoc CLI ops against test/prod don't overwrite supabase/.temp/project-ref."
```

---

## Task 2: Add `DATABASE_URL` to `.env.test` and `.env.prod` (USER STEP)

**Files:**
- Modify: `apps/web/.env.test`
- Modify: `apps/web/.env.prod`

This step touches gitignored secret files. **The user must do this; the agent must not.**

- [ ] **Step 1: User adds DATABASE_URL to each env file**

For each project ref (test, prod):
1. Open Supabase Dashboard → Project Settings → Database → "Connection string" → "URI" tab → "Direct connection" (port 5432, NOT the pooler).
2. Copy the URI and replace `[YOUR-PASSWORD]` with the project's database password.
3. Append to the corresponding env file as a new line:

   ```
   DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
   ```

   (Direct connection — needed because `supabase db push` and other DDL ops do not work over the pooler.)

- [ ] **Step 2: User confirms with the agent that DATABASE_URL is set in both files**

Agent verification (does not read the value):

```bash
grep -c "^DATABASE_URL=" apps/web/.env.test
grep -c "^DATABASE_URL=" apps/web/.env.prod
```

Expected: both return `1`.

- [ ] **Step 3: Smoke test wrapper against test**

Run from `apps/web/`:
```bash
./scripts/sb test migration list
```

Expected: a remote migration list. Network call may take a couple seconds. No password prompt (URL embeds it). No link state change.

- [ ] **Step 4: Smoke test wrapper against prod (read-only verification)**

Run from `apps/web/`:
```bash
./scripts/sb prod migration list | head -5
```

Expected: top of remote migration list from prod.

- [ ] **Step 5: No commit (env files are gitignored — nothing to commit)**

Confirm:
```bash
git status apps/web/.env.test apps/web/.env.prod
```

Expected: `nothing to commit` for these paths.

---

## Task 3: MCP server launcher scripts

**Files:**
- Create: `apps/web/scripts/mcp-supabase-test.sh`
- Create: `apps/web/scripts/mcp-supabase-prod.sh`
- Create: `apps/web/scripts/mcp-supabase-local.sh`

Each script sources its env file (so `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` flow through) and execs the MCP server with `--read-only`. Wrapper-script approach was chosen over `.mcp.json` env-var expansion (Option a in the spec) because it works on every Claude Code version.

- [ ] **Step 1: Create `mcp-supabase-test.sh`**

Create `apps/web/scripts/mcp-supabase-test.sh`:

```bash
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
```

- [ ] **Step 2: Create `mcp-supabase-prod.sh`**

Identical to test but sources `./.env.prod`:

```bash
#!/usr/bin/env bash
# Launches the Supabase MCP server bound to the PROD project, read-only.
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
```

- [ ] **Step 3: Create `mcp-supabase-local.sh`**

Local doesn't need the Management API (no `SUPABASE_ACCESS_TOKEN`), but the MCP server still requires `--project-ref`. Local Studio at `:54323` covers most local browsing, so this script is *optional* — included for completeness so all three envs are uniform.

```bash
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
```

- [ ] **Step 4: Make all three executable**

```bash
chmod +x apps/web/scripts/mcp-supabase-test.sh \
         apps/web/scripts/mcp-supabase-prod.sh \
         apps/web/scripts/mcp-supabase-local.sh
```

- [ ] **Step 5: Smoke test each script can launch (test + prod)**

The MCP server reads JSON-RPC from stdin, so we can't fully smoke-test without a client. Confirm the script gets past env loading and starts node:

```bash
( apps/web/scripts/mcp-supabase-test.sh </dev/null & PID=$!; sleep 3; kill $PID 2>/dev/null; wait $PID 2>/dev/null; true )
echo "test launcher: did not crash on env load"
```

Expected: no `SUPABASE_ACCESS_TOKEN missing` or `SUPABASE_PROJECT_REF missing` error in stderr. (`npx` may print download progress; that is fine.) Repeat with `mcp-supabase-prod.sh`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/scripts/mcp-supabase-test.sh \
        apps/web/scripts/mcp-supabase-prod.sh \
        apps/web/scripts/mcp-supabase-local.sh
git commit -m "feat(scripts): add per-env Supabase MCP launcher scripts

Each script sources the matching apps/web/.env.<env>, then execs
@supabase/mcp-server-supabase with --read-only and the project's ref.
Used by .mcp.json entries added in the next commit."
```

---

## Task 4: Register MCP servers in `.mcp.json`

**Files:**
- Create or modify: `.mcp.json` (project root)

- [ ] **Step 1: Check whether `.mcp.json` already exists**

```bash
ls .mcp.json 2>/dev/null && echo "exists" || echo "missing"
```

If "missing", create it with the full structure below. If "exists", merge the three new servers into the existing `mcpServers` object.

- [ ] **Step 2: Write or merge the config**

Target shape (full file if creating from scratch):

```json
{
  "mcpServers": {
    "supabase-local": {
      "command": "apps/web/scripts/mcp-supabase-local.sh"
    },
    "supabase-test": {
      "command": "apps/web/scripts/mcp-supabase-test.sh"
    },
    "supabase-prod": {
      "command": "apps/web/scripts/mcp-supabase-prod.sh"
    }
  }
}
```

If `.mcp.json` already exists, add the three keys under the existing `mcpServers` object — do not overwrite other servers. Verify with:

```bash
node -e "console.log(Object.keys(require('./.mcp.json').mcpServers).sort())"
```

Expected output includes `supabase-local`, `supabase-prod`, `supabase-test`.

- [ ] **Step 3: Restart Claude Code to pick up the new MCP servers**

This step requires a session restart — the agent cannot do this in-flight.

User: quit and restart `claude` from the project root. When prompted to enable the new project MCP servers, accept.

- [ ] **Step 4: Verify MCP tools are loaded**

In the new session, the user pastes:
> "List the tables in the supabase-test database."

Expected: agent invokes `mcp__supabase-test__list_tables` and returns the public schema tables.

- [ ] **Step 5: Verify read-only enforcement on prod**

In the new session:
> "Run `INSERT INTO accounts(id) VALUES (gen_random_uuid())` against supabase-prod."

Expected: agent calls `mcp__supabase-prod__execute_sql`, the server rejects the statement with a permission / read-only error. Agent reports the error rather than retrying.

- [ ] **Step 6: Commit**

```bash
git add .mcp.json
git commit -m "feat(mcp): register read-only Supabase MCP servers per env

Adds supabase-local, supabase-test, supabase-prod, each launched via
the wrapper scripts that source the matching .env.<env>."
```

---

## Task 5: Skill — `triaging-db-issue`

**Files:**
- Create: `.claude/skills/triaging-db-issue.md`

Authored using the `superpowers:writing-skills` skill so the format passes its lint (description includes trigger phrasing, body is rigid where needed, no fluff).

- [ ] **Step 1: Invoke the writing-skills skill**

In the agent session, invoke `superpowers:writing-skills`. Tell it: "Author a project-scoped skill at `.claude/skills/triaging-db-issue.md` using the body below."

- [ ] **Step 2: Provide skill content**

Frontmatter:
```yaml
---
name: triaging-db-issue
description: Use when the user pastes a client report, error message, or row id, or asks why something is wrong on prod or test. Investigates read-only via the supabase MCP servers and reports finding → hypothesis → proposed fix → blast radius before any code change.
---
```

Body:
```markdown
# Triaging a DB issue (read-only)

Use the Supabase MCP servers to investigate. **Do not write any migration, branch, or code in this skill.** Stop after the report.

## Steps

1. **Identify the env.** Default to `prod` unless the user named `test` or `local`. Tools you'll use: `mcp__supabase-<env>__execute_sql`, `mcp__supabase-<env>__list_migrations`, `mcp__supabase-<env>__list_tables`.

2. **Pull the offending data.** SELECT the row(s) the report points at, plus 1-hop context (joined tables, recent rows for the same actor — cardholder, org, merchant, etc.). Paraphrase findings; don't dump entire rows containing PII unless the user asks.

3. **Check recent migrations.** Call `list_migrations`. Flag anything from the last 30 days affecting the tables involved.

4. **Read the relevant code path.** From the repo, find the loader / RPC / server action that produces the wrong output. Use `Read` only — no edits.

5. **Report back in this exact format:**

   ```
   **Finding:** [what's actually in the DB / what the code does]
   **Hypothesis:** [why the wrong behavior happens]
   **Proposed fix:** [shape of the change — one or two sentences, no code]
   **Blast radius:** [other rows / tables / users affected if we change this]
   ```

6. **Stop.** Wait for the user to say "let's fix it" (or similar) before invoking `fixing-db-issue`.

## Anti-patterns

- Writing a migration in this skill. Wrong skill — that's `fixing-db-issue`.
- Calling `execute_sql` with anything other than SELECT. Read-only enforcement should reject it, but don't try.
- Dumping every column of a row in chat. Summarize. PII is real.
- Skipping step 3 ("recent migrations"). The fix is often "we shipped a regression last week" and step 3 catches it instantly.
```

- [ ] **Step 3: Verify the skill file is well-formed**

```bash
head -5 .claude/skills/triaging-db-issue.md
```

Expected: starts with `---`, contains `name:` and `description:`.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/triaging-db-issue.md
git commit -m "feat(skills): add triaging-db-issue skill

Invoked when the user pastes a client report or asks why prod/test
behavior is wrong. Read-only investigation via supabase MCP, reports
finding/hypothesis/fix/blast-radius, stops before any code change."
```

---

## Task 6: Skill — `fixing-db-issue`

**Files:**
- Create: `.claude/skills/fixing-db-issue.md`

- [ ] **Step 1: Invoke writing-skills, then write the file**

Frontmatter:
```yaml
---
name: fixing-db-issue
description: Use when the user accepts a triage hypothesis or says "open a branch", "let's fix it", or similar. Creates a fix branch, writes a migration (declarative-first), resets local, runs typegen and verification.
---
```

Body:
```markdown
# Fixing a DB issue (branch + migration)

Assumes `triaging-db-issue` has already produced a hypothesis the user accepted. This skill is execution: branch, migration, local repro, PR.

## Steps

1. **Branch.** Derive the name from a task id present in the source report (e.g. `BLZ-937 fix darkmode` → `blz-937-fix-darkmode`). **Do not auto-prefix `blz-` if the source has no such id** — see the `feedback_branch_naming` memory.

   ```bash
   git switch -c <branch-name>
   ```

2. **Migration — declarative first.** Edit the relevant file under `apps/web/supabase/schemas/` (e.g. `08-billing-customers.sql`). Then from `apps/web/`:

   ```bash
   supabase db diff -f <descriptive-name>
   ```

   This generates a timestamped file under `supabase/migrations/`. Inspect the generated SQL — confirm it's the change you intended, nothing else.

   **Imperative fallback:** If the change is something `db diff` can't express (data backfill, RLS policy quirks), hand-write the migration directly:

   ```bash
   supabase migration new <descriptive-name>
   ```

3. **Local repro.** From `apps/web/`:

   ```bash
   supabase db reset
   pnpm supabase:web:typegen
   pnpm typecheck
   ```

   `db reset` rebuilds local from declarative schemas + migrations + seed. `typegen` is a pnpm script because it composes two output paths (per `feedback_tooling` memory).

4. **Verify the bug is gone.** Reproduce the original symptom against local. If a test exists for the affected code path, run it; if not, write one.

   ```bash
   pnpm test --filter <affected-package>
   ```

5. **Commit and push.**

   ```bash
   git add apps/web/supabase/schemas apps/web/supabase/migrations apps/web/lib/database.types.ts packages/supabase/src/database.types.ts
   git commit -m "fix(<area>): <one-line description>"
   git push -u origin <branch-name>
   ```

6. **Open the PR against `testing`.**

   ```bash
   gh pr create --base testing --title "<title>" --body "$(cat <<'EOF'
   ## Source report
   <paste or link to the original client report>

   ## Triage finding
   <one-paragraph from the triage step>

   ## Fix
   <what the migration does>

   ## Test plan
   - [ ] migration applies cleanly on test
   - [ ] reproduce-bug-then-confirm-fix steps run against test
   EOF
   )"
   ```

7. **Stop.** Wait for the user to merge to `testing` (squashed) and say "promote to test" before invoking `promoting-db-fix`.

## Anti-patterns

- Pushing the migration to a remote DB from this skill. That's `promoting-db-fix`.
- Using `pnpm supabase:web:reset` instead of `supabase db reset`. Single-shot wrappers add a layer for no benefit (per `feedback_tooling` memory).
- Skipping `pnpm supabase:web:typegen` after `db reset`. Stale types break typecheck on the next task.
- Targeting `main` with the PR. Always `testing`.
```

- [ ] **Step 2: Verify and commit**

```bash
head -5 .claude/skills/fixing-db-issue.md
git add .claude/skills/fixing-db-issue.md
git commit -m "feat(skills): add fixing-db-issue skill

Branch, declarative-first migration, local reset + typegen + typecheck,
PR against testing. Stops before remote push."
```

---

## Task 7: Skill — `promoting-db-fix`

**Files:**
- Create: `.claude/skills/promoting-db-fix.md`

- [ ] **Step 1: Invoke writing-skills, then write the file**

Frontmatter:
```yaml
---
name: promoting-db-fix
description: Use when the user says "promote to test", "push to prod", or confirms a PR has been merged into testing. Walks through the multi-env push sequence with explicit pauses for human approval.
---
```

Body:
```markdown
# Promoting a DB fix (test → prod)

Push to test on the user's go-ahead. **Never push to prod** — print the command for the user to run.

## Steps

### To test

1. **Confirm the PR is squash-merged into `testing`.**

   ```bash
   gh pr view <pr-number> --json state,mergeCommit,baseRefName
   ```

   Expected: `state: MERGED`, `baseRefName: testing`. If not, stop and tell the user.

2. **Show the pending diff.** From `apps/web/`:

   ```bash
   ./scripts/sb test migration list
   ```

   The output marks local-only migrations (those not yet applied to test). Read those filenames back to the user.

3. **Pause for approval.** Wait for the user to say "go" / "push" / "yes" before the next step.

4. **Push.** From `apps/web/`:

   ```bash
   ./scripts/sb test db push
   ```

5. **Confirm.** Re-run `./scripts/sb test migration list` and check the previously local-only files are now applied.

6. **Seed (only if requested or if seed file changed).**

   ```bash
   ./scripts/sb test db push --include-seed
   ```

### To prod

1. **Show the pending diff.**

   ```bash
   ./scripts/sb prod migration list
   ```

2. **Print, do not run.** Output the exact command for the user to run themselves:

   > "To push to prod, run from `apps/web/`:
   > `./scripts/sb prod db push`"

3. **Stop.** Do not invoke prod push.

## Anti-patterns

- Running `./scripts/sb prod db push` from this skill. Always print, never execute prod writes.
- Using `pnpm supabase:web:push:test`. Use the wrapper — it doesn't clobber the link state (per `feedback_tooling` memory).
- Skipping the migration-list step before push. The user needs to see what's about to ship.
```

- [ ] **Step 2: Verify and commit**

```bash
head -5 .claude/skills/promoting-db-fix.md
git add .claude/skills/promoting-db-fix.md
git commit -m "feat(skills): add promoting-db-fix skill

Test push via ./scripts/sb (with explicit human-approval pause); prod
push command is printed for the user to run, never executed."
```

---

## Task 8: Update `apps/web/CLAUDE.md`

**Files:**
- Modify: `apps/web/CLAUDE.md` (or `CLAUDE.md` at repo root if `apps/web/CLAUDE.md` doesn't exist)

Add a short pointer to the workflow + the CLI invocation rule. Skills auto-trigger on description match, but a one-paragraph reminder helps the user find them and helps Claude pick the right one when descriptions overlap.

- [ ] **Step 1: Confirm which CLAUDE.md to edit**

```bash
ls apps/web/CLAUDE.md CLAUDE.md 2>/dev/null
```

Edit the more specific one (`apps/web/CLAUDE.md` if present, else root).

- [ ] **Step 2: Append a `## DB workflow` section**

Append exactly this content (adjust paths if you target the root CLAUDE.md):

```markdown
## DB workflow (test/prod)

**Browsing.** Three Supabase MCP servers are registered (read-only): `supabase-local`, `supabase-test`, `supabase-prod`. Use them to inspect schemas, migrations, and rows on remote envs without dashboard navigation.

**CLI.** Use `./scripts/sb <env> <args...>` from `apps/web/` for all remote ops (`migration list`, `db push`, `db dump`, etc.). Bare `supabase ...` from `apps/web/` for local Docker. `pnpm supabase:web:typegen` is the one wrapper worth keeping — it composes two output paths.

**Incident flow.** Three skills cover the loop end-to-end:
- `triaging-db-issue` — read-only investigation when a report lands.
- `fixing-db-issue` — branch + declarative-first migration + local repro.
- `promoting-db-fix` — `./scripts/sb test db push` after merge to `testing`; prints (does not run) the prod push command.
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/CLAUDE.md  # or CLAUDE.md if that's what you edited
git commit -m "docs(claude): document DB workflow, MCP servers, sb wrapper, skills"
```

---

## Task 9: End-to-end smoke test (manual)

**Files:** none.

This is the integration check — exercise the full loop with a synthetic incident.

- [ ] **Step 1: Restart Claude if not yet done**

If you haven't restarted since Task 4, do so now so all three skills are discoverable.

- [ ] **Step 2: Trigger triage**

Paste into chat:
> "Client says cardholder with email `nonexistent@example.com` can't see any discounts on prod. What's going on?"

Expected: agent invokes `triaging-db-issue`, calls `mcp__supabase-prod__execute_sql` to check for that email in `cardholder_profiles` / `accounts`, finds no row, and reports back as Finding/Hypothesis/Proposed fix/Blast radius. Stops before any code change.

- [ ] **Step 3: Trigger fixing (no real fix — just verify the skill activates)**

Paste:
> "Let's fix it — open a branch."

Expected: agent invokes `fixing-db-issue`, asks for a branch-relevant task id since there isn't one in the synthetic report, OR proposes a no-prefix descriptive branch name. Stop the agent before it writes a real migration; this step is just verifying skill activation.

- [ ] **Step 4: Trigger promotion (against an empty/no-op promotion)**

Paste:
> "Let's promote to test."

Expected: agent invokes `promoting-db-fix`, runs `./scripts/sb test migration list`. Since no new migration is pending, output should show "no pending migrations" or equivalent. Agent should stop and not push.

- [ ] **Step 5: No commit — verification only.**

---

## Task 10: Decide fate of the legacy pnpm scripts (DECISION POINT)

**Files:**
- Possibly modify: `apps/web/package.json`

The wrapper makes these redundant:
- `supabase:push:test`, `supabase:push:prod`
- `supabase:migrations:list:test`, `supabase:migrations:list:prod`

Two valid options:

**Option A — delete them.** Cleaner, fewer paths to teach. Anyone running them by muscle memory gets a clear "script not found" and learns the new way.

**Option B — keep as aliases that call the wrapper.** E.g. `"supabase:push:test": "./scripts/sb test db push"`. Backwards-compatible for any docs/CI that reference the old names.

- [ ] **Step 1: User picks A or B**

- [ ] **Step 2 (if A): Delete the four entries from `apps/web/package.json`**

- [ ] **Step 2 (if B): Replace each entry's command with the wrapper invocation**

- [ ] **Step 3: Commit either way**

```bash
git add apps/web/package.json
git commit -m "chore(scripts): <retire|alias> legacy supabase remote scripts in favor of ./scripts/sb"
```

---

## Task 11: Open PR

**Files:** none.

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/db-environment-workflow
```

- [ ] **Step 2: Open PR against `main`**

```bash
gh pr create --base main --title "feat: db environment workflow (MCP + sb wrapper + 3 skills)" --body "$(cat <<'EOF'
## Summary
- Read-only Supabase MCP servers per env (local/test/prod), launched via wrapper scripts that source the matching `.env.<env>`.
- `apps/web/scripts/sb <env> <args>` wrapper for all remote `supabase` CLI ops — uses `--db-url` so the linked project state is preserved across env switches.
- Three project-scoped skills codifying the report→fix→promote loop: `triaging-db-issue`, `fixing-db-issue`, `promoting-db-fix`.
- Spec: `docs/superpowers/specs/2026-04-26-db-environment-workflow-design.md`.
- Plan: `docs/superpowers/plans/2026-04-26-db-environment-workflow.md`.

## Test plan
- [ ] `./scripts/sb local migration list` returns local migrations and does not modify `apps/web/supabase/.temp/project-ref`.
- [ ] `./scripts/sb test migration list` and `./scripts/sb prod migration list` work with `DATABASE_URL` set in env files.
- [ ] After CC restart, `mcp__supabase-test__list_tables` and `mcp__supabase-prod__list_tables` return public schema tables.
- [ ] `mcp__supabase-prod__execute_sql` rejects an `INSERT` statement.
- [ ] Pasting a synthetic client report triggers `triaging-db-issue` automatically.
EOF
)"
```

---

## Self-review notes

- Spec coverage: every component (MCP servers, sb wrapper, three skills) has tasks. Security considerations are handled by `--read-only` flag (Task 3) and verified in Task 4 step 5.
- Task 2 is human-only by necessity (env files are gitignored secrets); plan calls this out explicitly.
- Skill descriptions in Tasks 5–7 match the spec verbatim — that's the trigger surface and must stay stable.
- TDD doesn't fit infra/config tasks; smoke tests appear after each artifact instead. Honest about this.
- Open Items from spec: seed-test script and db-rollback skill are NOT in this plan (they were marked "future work" in the spec).
