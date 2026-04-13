Generate a session log entry for today's work and append it to `docs/session-log.md`.

## Process

### Step 1: Determine session boundaries

Read the first entry in `docs/session-log.md` to find the date and last commit SHA mentioned. This marks where the previous session ended.

### Step 2: Gather data

Run these in parallel:

```bash
# Commits since last session entry
git log --oneline --since="{date of last entry}" --reverse

# PRs merged recently
gh pr list --state merged --json number,title,mergedAt,headRefName --limit 20

# PRs currently open
gh pr list --state open --json number,title,headRefName --limit 10

# Issues opened/closed recently
gh issue list --state all --json number,title,labels,createdAt --limit 30

# Package version
cat package.json | jq .version
```

### Step 3: Draft the entry

```markdown
## YYYY-MM-DD — {Title summarizing the session's main theme}

### What Shipped
- **PR #N** ({title}): {1-2 sentence summary}

### Review Findings
- **#N** (P1/P2/P3): {one-line description} — fixed/deferred

### Key Decisions
- {decision}: {rationale}

### Gotchas
- {thing that broke and why}

### Issues
- **Opened**: #N, #N
- **Closed**: #N, #N

### Current State
- Next steps / what the next session should pick up
```

### Step 4: Update build progress

If `docs/build-progress.md` exists, check off any v1 features or milestones that were completed this session. Include it in the commit.

### Step 5: Append, commit, and push

Do NOT ask for confirmation. Immediately:

1. Insert the entry at the top of `docs/session-log.md` (after the header and `---`, before the first existing entry)
2. If `docs/build-progress.md` was updated, stage it too
3. Commit: `git add docs/session-log.md docs/build-progress.md && git commit -m "Update session log: {title}"`
4. Push: `git push`

## Guidelines

- Keep entries skimmable in 30 seconds
- Focus on "what" and "why", not "how"
- Include commit SHAs for major changes
- If nothing was shipped (research-only session), say so and describe what was explored
- Omit empty sections
