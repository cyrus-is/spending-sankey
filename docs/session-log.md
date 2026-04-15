# Session Log

Reverse-chronological log of work done each session. Read this at session start to rebuild context quickly. Keep entries concise.

---

## 2026-04-15 — Security hardening, merchant pre-classifier, new categories, sample data

### What Shipped
- **9baddf4** Security hardening: CSP meta tag (`connect-src api.anthropic.com`), removed `rawRow` from Transaction interface, gated debug logs behind `import.meta.env.DEV`, "Remember my key" checkbox (localStorage vs sessionStorage)
- **6815833** Amounts now sent to Claude for better categorization accuracy; comprehensive `docs/privacy.md` written
- **11df51e + 3878685** Merchant pre-classifier: 270+ rules across 13 categories, 27 processor prefix patterns (SQ*, TST*, PAYPAL*, APL*, etc.), wired as Layer 1 before cache + Claude
- **e28a1ca** Broadened `isMerchantCredit()` with VENDOR_INDICATOR_PATTERNS to fix income misclassification (Restaurant, Amazon, Tesco, M&S showing as income)
- **9a235d8** Childcare added as top-level category (28 merchant rules: Bright Horizons, KinderCare, Goddard, etc.)
- **0a55a91** Education added as top-level category (23 rules: Navient, Kumon, Coursera, Udemy, etc.)
- **497d64c** Deep code review filed as 17 GitHub issues (#1–#17); CI lint failures fixed (prefer-const, react-hooks/exhaustive-deps)
- Sample persona created: `public/samples/sfbay-mid-career-tech-couple/` — 218 transactions, Jan–Mar 2026, with methodology doc at `docs/sample-data-methodology.md`

### Review Findings (issues filed)
- **#1** (P1): CSP via meta tag only — fixed this session
- **#2** (P1): rawRow persisting full bank CSV rows — fixed this session
- **#5** (P1): console.debug in production — fixed this session
- **#3, #6, #7, #8, #9, #10–#17**: Open, deferred

### Key Decisions
- **Send amounts to Claude**: Originally CLAUDE.md said amounts never sent. User agreed since we're already trusting Anthropic with merchant names. Docs updated.
- **Remember my key is universal**: Originally only for hosted version. User decided everyone keeps their key on their own machine anyway — no meaningful privacy difference. Single checkbox, default unchecked.
- **Childcare and Education as first-class categories**: Scope creep but good scope creep. $3.5k+/month childcare is significant. Education similarly adds value. Both required 8-file change pattern (types, sankey, budget, categorize, essentials, normalize, merchantLookup).
- **Merchant pre-classifier before Claude**: Saves API credits, faster, deterministic for known chains. Claude handles the long tail.

### Gotchas
- Adding a new top-level Category requires changes in 8 files: `types.ts`, `sankey.ts`, `budget.ts`, `categorize.ts` (prompt + taxonomy + aliases), `essentials.ts`, `normalize.ts`, `merchantLookup.ts`, `merchantLookup.test.ts`
- Stale sessionStorage cache masks pre-classifier fixes in the browser — users need to close the tab or clear DevTools → Application → Session Storage
- M&S pattern needed `\bm&s\b` word boundary to avoid false matches; bare "M&S" was slipping through to income
- Categorize tests broke after pre-classifier wiring — tests used STARBUCKS/WHOLE FOODS which get pre-classified before the mock API. Fixed by using obscure merchant names in tests.

### Issues
- **Opened**: #1–#17 (bulk filing from deep code review)

### Current State
- All 362 tests passing, CI green, pushed to main
- User out of Anthropic API credits — unable to test the CSV in-browser tonight
- Next: work through open issues (#3, #6, #7, #8, #9, #10 are highest leverage); more sample personas if useful

---

## 2026-04-13 — Full v1 build: CSV → categorization → Sankey

### What Shipped

All 9 planned chunks completed in one session. The app is fully functional end-to-end.

- **c1d362a** Chunk 1 — Project scaffold: Vite + React 19 + TypeScript + ESLint + Vitest. `npm run build` and `npm run lint` clean.
- **44634c9** Chunk 2 — CSV drag-drop + raw table display: `DropZone`, `RawTable`, PapaParse wrapper, `LoadedFile`/`Transaction` types.
- **9c84b1b** Chunk 3 — CSV parser lib: `detectFormat` (heuristic column detection), `parseDate` (ISO/MDY/DMY), `parseTransactions` (signed amount, separate debit/credit). 16 tests.
- **d285a55** Chunk 4 — Claude API integration: `categorize.ts` batches descriptions to claude-haiku in groups of 50, `ApiKeyEntry` stores key in sessionStorage, `TransactionTable` shows categories with inline overrides.
- **5306827** Chunk 5 — Sankey diagram: `buildSankeyData` builds income→spending→categories graph; `SankeyChart` renders with D3, hover tooltips, income/expense/net summary.
- **9cd0f9f** Chunks 6+7 — Date-range filtering + category overrides: `DateFilter` with "This month / Last 3 months / All time" shortcuts; overrides map propagates to Sankey re-render.
- **d9f099c** Chunk 8 — Transfer detection: keyword patterns (Zelle, Venmo, Transfer, etc.) + cross-file amount matching (±1%, within 3 days). 6 tests.
- **b2e4478** Chunk 9 — Polish: loading spinner during file reads, dismissible error banner, warning when format detection fails, empty state when Sankey has no data, privacy hint on categorize button.

### Key Decisions

- **ISO date parsing as local time**: `new Date('2024-03-15')` parses as UTC midnight → off-by-one in Pacific timezone. Fixed by parsing year/month/day parts directly into `new Date(y, m, d)`.
- **`getStoredApiKey`/`storeApiKey` in separate `lib/apiKey.ts`**: ESLint `react-refresh/only-export-components` blocks exporting non-components from `.tsx` files. Extracted to `.ts`.
- **Sankey merges small income sources** (<5% of total) into "Other Income" to keep the diagram readable when there are many small deposits.
- **Positive-is-credit detection**: samples first 20 rows with a Type column to infer whether positive amounts are credits or debits. Handles Amex-style CSVs where positive = charge.

### Gotchas

- `vite.config.ts` doesn't accept `test:` config — Vitest needs its own `vitest.config.ts`. TypeScript was rejecting the merged config.
- Transfer detection runs on every file load (inside `setFiles` updater) so it re-runs cross-file matching when a second file is added.

### Current State

All v1 features complete and checked off in `build-progress.md`. App builds cleanly, 22 tests passing. Not yet deployed.

**Next session:** Deploy to Vercel or S3/CloudFront (static site). Then consider v2: recurring expense detection → budget generation → budget vs actual Sankey overlay.

---

## 2026-04-12 — Repository initialization

### What happened
- Repository scaffolded with standard command set
- CLAUDE.md created with coding standards and platform decisions
- Project docs copied from HQ (concept + brief)
- CI skeleton added

### Key decisions
- Tech stack: React 19 + TypeScript + Vite + D3.js + Claude API
- Client-side only — no backend, no database, privacy-first
- User provides their own Claude API key (sessionStorage, not localStorage)
- CSV-first approach (no bank API integration)

### Next steps
- Initialize package.json and Vite config
- Build CSV drag-drop + parsing (Problem 1)
- Build Claude API categorization wrapper (Problem 2)
- Build Sankey visualization (Problem 3)
