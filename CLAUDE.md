# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**Spending Sankey** — drag-drop your bank CSVs, see where your money goes.

A client-side web app. You drag-and-drop CSV exports from any bank or credit card. AI auto-detects the format (column mapping, date parsing, amount conventions) and categorizes each transaction. Renders an interactive Sankey diagram: income sources on the left, spending categories on the right, flow width shows relative amounts. Helps you build a budget from what you actually spend.

No backend. No account creation. No bank login. Your data never leaves your browser (except the Claude API call for categorization).

## Repository Structure

```
spending-sankey/
├── CLAUDE.md
├── README.md
├── docs/
│   ├── session-log.md          # Session tracking
│   ├── build-progress.md       # v1 feature checklist
│   ├── concept.md              # Full product concept (from HQ)
│   └── brief.md                # One-page brief (from HQ)
├── src/
│   ├── index.html              # Entry point
│   ├── App.tsx                 # Root component
│   ├── components/             # React components
│   ├── lib/                    # Core logic (parsing, categorization, budgeting)
│   └── styles/                 # CSS
├── public/                     # Static assets
├── .claude/
│   └── commands/               # Claude Code slash commands
├── .github/
│   └── workflows/
│       └── ci.yml              # Build + lint + test
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .gitignore
```

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | React 19 + TypeScript | Fast iteration, strong ecosystem for data viz |
| Build | Vite | Fast dev server, simple config |
| Visualization | D3.js (d3-sankey) | Best Sankey support, full control over rendering |
| AI | Claude API (@anthropic-ai/sdk) | CSV format detection + transaction categorization |
| Styling | CSS Modules or Tailwind | TBD — keep it simple |
| Testing | Vitest | Vite-native, fast |
| Hosting | Static (S3/CloudFront or Vercel) | No backend needed |

## Commands

```bash
# Setup
npm install

# Dev server
npm run dev

# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

## Key Decisions

1. **Client-side only.** No backend, no database. All processing happens in the browser. The only network call is to Claude's API for CSV format detection and transaction categorization.
2. **Privacy-first.** Bank data never touches a server we control. The Claude API call sends merchant descriptions, amounts, and debit/credit type for categorization — no account numbers, balances, or PII. Users provide their own API key. See `docs/privacy.md` for the full data flow.
3. **CSV-first, not bank-API.** Users export CSVs manually. This avoids Plaid/bank integration complexity and the trust barrier of sharing credentials. Every bank supports CSV export.
4. **Budget from reality.** Phase 1 reflects actual spending patterns — no prescriptive budgeting. Phase 2 surfaces observations without being preachy.

## Coding Standards

### General principles
- Clarity over cleverness
- Explicit over implicit
- Fail fast, fail loudly

### TypeScript
- Strict mode enabled (`strict: true` in tsconfig)
- No `any` — use proper types or `unknown` with type guards
- Prefer `interface` for object shapes, `type` for unions/intersections
- Named exports, no default exports
- Barrel files (`index.ts`) only at feature boundaries, not everywhere

### React
- Functional components only
- Props interfaces named `{Component}Props`
- No prop drilling beyond 2 levels — use context or composition
- `useCallback`/`useMemo` only when profiling shows a need, not preventively
- Keep components under ~150 lines — extract when they have distinct responsibilities

### File organization
- One component per file, filename matches component name
- Co-locate tests: `Foo.tsx` + `Foo.test.tsx`
- Core logic (parsing, categorization, budget math) lives in `lib/`, not in components
- Components are for rendering; `lib/` is for computation

### Data flow
- CSV parsing and normalization: pure functions in `lib/parser.ts`
- Categorization: Claude API wrapper in `lib/categorize.ts`
- Budget generation: pure functions in `lib/budget.ts`
- Sankey data transformation: pure functions in `lib/sankey.ts`
- Components consume transformed data, they don't compute it

### Testing
- Unit tests required for `lib/` (parsing, budget math, recurring detection)
- Component tests optional for MVP
- Test files live alongside source: `foo.ts` → `foo.test.ts`

### Security
- Never log or persist raw bank data beyond the browser session
- Claude API key entered by user, stored in sessionStorage (not localStorage)
- No telemetry, no analytics, no tracking
- CSP headers in production build

### CSS
- Keep it minimal for MVP — ship ugly before shipping never
- Responsive is a nice-to-have, not a blocker

## Credentials

GitHub PATs, AWS tokens, Cloudflare keys, and similar credentials referenced by this project live at `~/.claude/pats/` on the Mac Mini (gitignored). Some entries are symlinks to the canonical tool locations.
