Check the health and current state of the project. Run all checks in parallel where possible, then present a single summary table.

### Check 1: CI status
```bash
gh run list --limit 5 --json status,name,conclusion,createdAt
```

### Check 2: Open issues and PRs
```bash
gh issue list --state open --json number,title,labels --limit 20
gh pr list --state open --json number,title --limit 10
```

### Check 3: Build progress
Read `docs/build-progress.md` and summarize what's done vs remaining.

### Check 4: Last session
Read the most recent entry in `docs/session-log.md`.

## Output Format

```
## Status — Spending Sankey

| Check | Status | Details |
|-------|--------|---------|
| CI | OK/FAIL | ... |
| Open issues | N | ... |
| Open PRs | N | ... |
| v1 progress | X/Y features | ... |

{If failures, add a Failures section with details and suggested actions.}
{If all good: "All systems operational."}
```
