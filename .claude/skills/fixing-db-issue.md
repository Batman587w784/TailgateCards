---
name: fixing-db-issue
description: Use when the user accepts a triage hypothesis or says "open a branch", "let's fix it", or similar. Creates a fix branch, writes a migration (declarative-first), resets local, runs typegen and verification.
---

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
