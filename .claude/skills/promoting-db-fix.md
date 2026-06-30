---
name: promoting-db-fix
description: Use when the user says "promote to test", "push to prod", or confirms a PR has been merged into testing. Walks through the multi-env push sequence with explicit pauses for human approval.
---

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
