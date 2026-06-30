---
name: triaging-db-issue
description: Use when the user pastes a client report, error message, or row id, or asks why something is wrong on prod or test. Investigates read-only via the supabase MCP servers and reports finding → hypothesis → proposed fix → blast radius before any code change.
---

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
