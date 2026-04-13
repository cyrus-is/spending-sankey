# Session Log

Reverse-chronological log of work done each session. Read this at session start to rebuild context quickly. Keep entries concise.

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
