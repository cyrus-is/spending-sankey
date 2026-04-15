# Spending Sankey — Deep Code Review

**Reviewer:** Opinionated frontend friend
**Date:** 2026-04-14
**Scope:** Full codebase, architecture, UX, security, testing, categorization strategy
**Codebase size:** ~4,600 LOC across 46 source files, 189 tests, 1,448 lines CSS

---

## Scorecard

| Area | Grade | Notes |
|------|-------|-------|
| **Architecture** | B | Clean separation of lib/components. State management is a ticking bomb at scale but fine for now. |
| **Code Quality** | B+ | Consistent patterns, good TypeScript discipline, minimal `any`. Some duplication. |
| **Security & Privacy** | D | No CSP, raw bank data retained in memory, debug logging in prod, no input sanitization on CSV. |
| **Testing** | B- | Strong lib coverage (189 tests), zero integration tests, zero E2E, 3 component tests. |
| **UX / Design** | C+ | Functional but unpolished. Dark-only, no responsive, no mobile, partial a11y. |
| **Performance** | C | O(n^2) transfer detection, no code splitting, 383KB single-chunk bundle, full Anthropic SDK shipped. |
| **Categorization Strategy** | B | Solid prompt engineering, good alias normalization, but leaves accuracy on the table by not sending amounts or using merchant pre-classification. |
| **Bundle / Build** | C- | Zero Vite config. Wildcard d3 import. No chunking. Anthropic SDK (~116KB) fully bundled. |
| **Documentation** | A- | Concept doc, brief, CLAUDE.md, session log, build progress — better than most startups. |

**Overall: B-** — A genuinely useful tool with solid bones that needs a security pass and some UX love before it's ready for public hosting.

---

## Architecture Analysis

### Current Architecture

**Pattern:** Monolithic single-page app with lifted state. All state lives in `App.tsx` (~560 lines, 20+ `useState` calls). Components are pure renderers. Business logic lives in `lib/` as pure functions. The Claude API is called directly from the browser with `dangerouslyAllowBrowser: true`.

**Data flow:**
```
CSV File → readCsv.ts (PapaParse) → parser.ts (detectFormat, parseTransactions)
    → App.tsx state (files[])
    → categorize.ts (Claude API batches) → App.tsx state (updated files[])
    → sankey.ts (buildSankeyData) → SankeyChart.tsx (D3 render)
    → budget.ts (generateBudget) → BudgetPanel.tsx → BudgetTable.tsx
```

**State lives in:** `App.tsx` via `useState`. Budget persists to `localStorage`. Categorization cache persists to `sessionStorage`. API key persists to `sessionStorage`.

### Alternative Architectures Considered

#### 1. useReducer + Context

**What it is:** Replace 20+ `useState` calls with a single `useReducer` containing all app state, exposed via Context to child components.

**Pros:**
- State transitions become explicit actions (`CATEGORIZE_START`, `BUDGET_GENERATED`, etc.)
- Easier to debug — state changes are traceable
- Components can subscribe to slices of state without prop drilling
- Natural fit for the "pipeline" data flow (load → categorize → visualize → budget)

**Cons:**
- Boilerplate — action types, reducer cases, context setup
- Over-engineering for a single-screen app with no routing
- Re-renders can be worse without careful memoization of context values

**Verdict:** Worth doing when the next feature lands. The current approach works but adding multi-budget support, settings, or undo/redo would make it collapse.

#### 2. Zustand / Jotai (lightweight state managers)

**What it is:** External state library with React integration. Zustand gives a single store with selectors. Jotai gives atomic state primitives.

**Pros:**
- Less boilerplate than Context + useReducer
- Built-in selector support prevents unnecessary re-renders
- Zustand's `persist` middleware replaces manual localStorage/sessionStorage code
- Works outside React (useful for service workers or Web Workers)

**Cons:**
- Another dependency (though both are tiny: ~1-2KB)
- Learning curve for contributors unfamiliar with the library
- For this app size, it's a lateral move — not dramatically better than useReducer

**Verdict:** Good choice if the app grows past 2-3 features. Zustand's `persist` middleware would clean up the manual storage code.

#### 3. Server-Side Proxy for Claude API

**What it is:** Instead of calling Claude directly from the browser, route API calls through a lightweight backend (Cloudflare Worker, Vercel Edge Function, or Lambda@Edge).

**Pros:**
- Eliminates `dangerouslyAllowBrowser: true` and the entire Anthropic SDK from the client bundle (-116KB)
- API key managed server-side — users don't need their own key
- Enables rate limiting, caching, and usage tracking
- CSP becomes simpler (`connect-src 'self'` only)
- Could add response caching at the edge (same merchant → same category)

**Cons:**
- Breaks the "no backend" principle from CLAUDE.md
- Now you're managing infrastructure, keys, costs
- Privacy model changes: transaction descriptions transit your server
- CORS configuration required

**Verdict:** The right move for a hosted version. Keep the current client-direct mode as a "bring your own key" option. The hosted version should proxy through an edge function.

#### 4. Web Worker for Heavy Computation

**What it is:** Move transfer detection, recurring detection, budget generation, and Sankey data building to a Web Worker so they don't block the main thread.

**Pros:**
- Fixes the O(n^2) transfer detection UI freeze (issue #3)
- Budget regeneration on large datasets won't block UI
- D3 Sankey layout computation is CPU-bound — natural Worker candidate

**Cons:**
- Structured cloning of Transaction arrays has overhead
- Worker communication is async — adds complexity
- D3 can't access the DOM from a Worker (but layout computation can run there; rendering stays on main thread)

**Verdict:** Worth doing for transfer detection. The others are fast enough to stay on the main thread for typical dataset sizes (<5,000 transactions).

### Architecture Recommendation

**Keep the current architecture** for now. It's the simplest thing that works for a single-screen app. Make these incremental changes:

1. **Now:** Extract `useBudget()`, `useTaxLens()`, `useCategorization()` hooks from App.tsx
2. **Before hosting:** Add a Cloudflare Worker proxy for the Claude API
3. **If perf degrades:** Move transfer detection to a Web Worker
4. **If features multiply:** Adopt Zustand with `persist` middleware

---

## Findings by Category

### Security & Data Handling

**S1. No Content-Security-Policy (Critical)**
The app holds a live API key in JS memory and processes bank data. Zero CSP protection. A single compromised npm dependency can exfiltrate everything. This is the #1 blocker for public hosting.

**S2. `rawRow` retains full bank CSV rows (Critical)**
Every `Transaction` object carries `rawRow: Record<string, string>` — the complete original row including account numbers, balances, check numbers. This data persists in React state, flows through every component, and would be captured by any error reporting, React DevTools, or rogue console logging. Nothing in the codebase reads `rawRow` after parsing. Drop it.

**S3. `console.debug` in production categorize path (High)**
Two debug statements in `categorize.ts` fire on every batch, logging Claude's raw response and category distributions to the browser console. Anyone with DevTools open sees transaction categorization data.

**S4. No CSV input sanitization (Medium)**
PapaParse handles parsing, but there's no validation that CSV cell values don't contain script tags, extremely long strings (DoS via memory), or formula injection payloads (`=CMD(...)`). For a client-side app the XSS risk is lower (no server rendering), but formula injection matters if users re-export CSV data and open it in Excel.

**S5. API key visible in network tab (Informational)**
With `dangerouslyAllowBrowser: true`, the `x-api-key` header is visible in browser DevTools network tab. This is inherent to the architecture and documented, but worth noting for the hosted version.

### State Management

**SM1. App.tsx is a state monolith (Medium)**
560+ lines, 20+ `useState`, ~15 `useCallback`/`useMemo`. All state transitions happen through callbacks defined in the root component and passed down as props. This works but makes it hard to reason about state changes and increases merge conflict risk when multiple features touch App.tsx.

**SM2. `overrides` and `taxOverrides` are unbounded maps (Low)**
These `Record<string, string>` maps grow with every user correction but are never pruned when transactions are removed or files are unloaded. For typical usage this is fine, but loading/unloading many files in a session could accumulate stale entries.

**SM3. Budget and categorization cache use different storage backends (Low)**
Budget → `localStorage` (persists across sessions). Categorization cache → `sessionStorage` (dies on tab close). API key → `sessionStorage`. This is intentional per CLAUDE.md but there's no central documentation of what's stored where and why.

### Testing Strategy

**T1. Strong unit test coverage for `lib/` (Good)**
189 tests across 14 test files. Every `lib/` module has co-located tests. Pure function testing is thorough: parser edge cases (date formats, amount conventions), categorization normalization, recurring detection cadences, budget generation heuristics, CSV round-tripping.

**T2. Zero integration tests (Gap)**
No test verifies the end-to-end flow: CSV → parse → categorize → Sankey data. Each step is tested in isolation but the contract between them (e.g., that parser output matches what categorize expects) is only implicitly verified.

**T3. Component tests are superficial (Gap)**
Three component test files exist (`LensSwitcher`, `CategorizationModeSelector`, `TaxFlagPanel`) with 20 tests total. They test rendering and click handlers. The heavy components — `SankeyChart`, `BudgetTable`, `BudgetPanel`, `TransactionTable` — have zero tests.

**T4. No E2E or visual regression tests (Gap)**
No Playwright, Cypress, or screenshot tests. The Sankey chart, budget overlay, and tooltip interactions are only verifiable manually.

**T5. Test helpers are well-designed (Good)**
`makeTx()`, `monthlyTxns()`, `series()` — clean, composable test factories that make test cases readable.

### Error Handling & Edge Cases

**E1. No retry logic on API failures (Medium)**
A single network error or rate limit kills the entire categorization run. The error propagates to the UI as a banner, but the user must click "Categorize" again from scratch. Retrying the failed batch (with exponential backoff) would be more robust.

**E2. `parseBatchResponse` throws on a single bad item (Medium)**
If one item in a 50-item batch has a missing `id`, the entire batch throws. The 49 good results are lost. A more forgiving approach: skip the bad item, log a warning, continue processing.

**E3. Zero-amount transactions silently dropped (Low)**
`parseTransactions` skips rows where both debit and credit are 0. This is usually correct (zero-amount rows are typically balance entries or placeholders) but could drop legitimate $0.00 authorization holds that later post at full amount.

**E4. Date parsing silently skips unparseable rows (Low)**
If a date can't be parsed, the row is silently skipped (line 195 of parser.ts). There's no count of skipped rows shown to the user. With a malformed CSV, users could lose 20% of their transactions and never know.

**E5. No error boundary component (Low)**
A rendering error in any component (e.g., D3 throws on bad data) would crash the entire app with a white screen. A React error boundary around the Sankey chart and budget table would allow graceful degradation.

### Categorization Strategy

**C1. Amounts not sent to Claude (Medium impact)**
Only `id`, `description`, and `type` are sent. Amount context would help disambiguate: $5 STARBUCKS = coffee (Dining), $500 STARBUCKS = catering (could be business expense). The system prompt could use amount ranges without revealing exact values ("small purchase under $20" vs "large purchase over $200").

**C2. No merchant pre-classification (Medium impact)**
`normalizeVendorName` already maps 40+ merchants to canonical names. These mappings could directly assign categories (STARBUCKS → Dining, NETFLIX → Subscriptions) without an API call. For a 500-transaction file where 60% are known merchants, this would cut API calls from 10 to 4 and eliminate classification errors for unambiguous merchants.

**C3. No confidence scoring on spending categorization (Medium impact)**
The tax lens has `ambiguous: boolean` but the main categorizer has no confidence signal. Adding even a simple "unsure" flag would let the UI highlight transactions that need user review, dramatically improving effective accuracy.

**C4. User corrections don't improve future categorizations (Low impact now, high later)**
When a user overrides a category, that correction is stored in `overrides` (in-memory) but never fed back to the cache or used as few-shot examples in subsequent API calls. Over time, user corrections could build a per-user merchant → category mapping that eliminates most API calls.

**C5. `streaming` alias maps to Entertainment, not Subscriptions (Bug)**
`CATEGORY_ALIASES` maps `streaming` → `Entertainment` (line 148) but the system prompt says Netflix/Spotify/Hulu are Subscriptions. If Claude returns "Streaming" as a category name, it gets misclassified.

**C6. Cache key includes amount but amount isn't sent to Claude (Inconsistency)**
The cache key is `${mode}|${type}|${amount.toFixed(2)}|${description}`. The amount is part of the key even though it's not part of the API request. This means two identical descriptions with different amounts get separate cache entries pointing to the same Claude response. This wastes cache space but doesn't cause incorrect behavior.

**C7. Tax categorization has no cache at all (Cost issue)**
Every time the tax lens is activated, all transactions are re-sent to Claude. With 500 transactions, that's 10 API calls per lens activation. The spending categorizer's cache could be trivially extended to tax results.

### UX & Design

**U1. Not responsive — unusable on mobile (High)**
One `@media` query in 1,448 lines of CSS. Tables have `min-width: 600-700px`. The Sankey SVG renders at 900-1200px. No touch event handling on the chart. This app is desktop-only.

**U2. Dark mode only — no light mode or system preference (Medium)**
All 1,448 lines of CSS use hardcoded dark-theme hex values. No `prefers-color-scheme` support. No theme toggle. Users who prefer light mode or are in bright environments have no option.

**U3. Accessibility gaps (Medium)**
Good: DropZone has keyboard support and ARIA. Bad: TransactionTable selects have no labels, BudgetTable editable fields have no ARIA descriptions, SankeyChart SVG has no ARIA whatsoever, no `aria-live` for loading/error states, no skip links, no focus management.

**U4. No color variables — 100+ hardcoded hex values (Low, high refactor cost)**
The same colors (`#1a202c`, `#2d3748`, `#e2e8f0`, etc.) appear dozens of times. A move to CSS custom properties would enable theming and reduce the CSS file size.

**U5. Inconsistent empty states (Low)**
Some components show a message when empty (`empty-state` card), others return `null` and vanish. TransactionTable and SankeyChart both silently disappear when they have no data.

**U6. Two oversized components (Low)**
`SankeyChart.tsx` (323 lines) and `BudgetTable.tsx` (219 lines) exceed the 150-line CLAUDE.md guideline. SankeyChart should extract the D3 rendering logic into a hook. BudgetTable should extract `EditableAmount` and `EditableNotes` to their own files.

### Bundle & Build

**B1. Anthropic SDK fully bundled (~116KB of 383KB total) (High)**
The full SDK including streaming, retry, rate-limit handling ships to every user. For a hosted version, proxying through an edge function would eliminate this entirely.

**B2. Wildcard d3 import prevents tree-shaking (Medium)**
`import * as d3 from 'd3'` in SankeyChart.tsx. Should be `import { select } from 'd3-selection'` etc. to allow Rollup to eliminate unused d3 sub-modules.

**B3. Zero code splitting (Medium)**
One 383KB JavaScript chunk. React, D3, Anthropic SDK, and all application code load upfront. Lazy-loading the budget panel, tax lens, and Sankey chart would improve first-load time.

**B4. No Vite build configuration (Low)**
`vite.config.ts` is 6 lines: just the React plugin. No manual chunks, no `build.rollupOptions`, no chunk size warnings, no optimization hints.

---

## Prioritized Issue List

Combining the 16 open GitHub issues with new findings from this review. Ordered by impact.

### Tier 1 — Must fix before hosting

| # | Source | Title | Why |
|---|--------|-------|-----|
| 1 | Issue #1 | Add Content-Security-Policy headers | API key + bank data with zero XSS protection |
| 2 | Issue #2 | Drop rawRow from Transaction objects | Full bank rows retained in memory unnecessarily |
| 3 | Issue #5 | Remove console.debug from production | Leaks categorization data to browser console |
| 4 | New: S4 | Sanitize CSV formula injection in exports | Budget/tax CSV exports could contain `=CMD()` payloads |
| 5 | New: C5 | Fix `streaming` → Entertainment alias (should be Subscriptions) | Active categorization bug |

### Tier 2 — Fix before public release

| # | Source | Title | Why |
|---|--------|-------|-----|
| 6 | Issue #3 | Fix O(n^2) transfer detection | Freezes browser on large uploads |
| 7 | Issue #7 | Deduplicate EXPENSE_CATEGORIES | Divergence already exists (sankey.ts omits "Other") |
| 8 | Issue #6 | Fix budget CSV round-trip merchant field | Budget overlay breaks after reimport |
| 9 | Issue #9 | Add tax categorization caching | Every lens toggle costs 10 API calls |
| 10 | Issue #4 | Clarify/fix transaction type sent to API | Privacy claim doesn't match behavior |
| 11 | New: C2 | Add merchant pre-classification lookup | Cut API calls 40-60% for known merchants |
| 12 | Issue #10 | Bump version to 2.0.0 | Version doesn't match shipped features |
| 13 | New: E1 | Add retry with backoff on API failures | Single failure kills entire categorization |
| 14 | New: B2 | Switch d3 to named imports | Free bundle size reduction |

### Tier 3 — Improve before scaling

| # | Source | Title | Why |
|---|--------|-------|-----|
| 15 | Issue #8 | Fix budget overlay ghost rect scaling | Visual inaccuracy in Sankey overlay |
| 16 | Issue #11 | Fix exportTaxCSV DOM attachment | Download may not trigger in some browsers |
| 17 | Issue #16 | Extract state from App.tsx | 560 lines, 20+ state vars — approaching limit |
| 18 | New: C3 | Add confidence scoring to spending categorization | Let users focus review on uncertain items |
| 19 | New: C1 | Send amount context to Claude | Improve categorization accuracy |
| 20 | New: E2 | Make parseBatchResponse skip bad items instead of throwing | One bad item shouldn't kill 49 good results |
| 21 | New: E5 | Add React error boundary | Prevent white-screen crashes |
| 22 | New: B1 | Split bundle / code-split Anthropic SDK | 116KB of SDK code loads even before user enters API key |
| 23 | New: U1 | Add responsive breakpoints | App is desktop-only |

### Tier 4 — Nice to have

| # | Source | Title | Why |
|---|--------|-------|-----|
| 24 | Issue #12 | Fix locale-dependent parseDate fallback | Edge case in date parsing |
| 25 | Issue #13 | Debounce BudgetTable localStorage writes | Performance nit |
| 26 | Issue #14 | Consistent truncation lengths in normalize.ts | Code clarity |
| 27 | Issue #15 | Comment on non-overlapping cadence windows | Defensive documentation |
| 28 | New: U2 | Support light mode / system preference | User comfort |
| 29 | New: U3 | Complete accessibility audit | Screen reader and keyboard support gaps |
| 30 | New: U4 | Extract CSS custom properties | Enable theming, reduce duplication |
| 31 | New: C4 | Feed user corrections back to cache | Compound accuracy improvement over time |
| 32 | New: E4 | Show count of skipped/unparseable rows | Users don't know when rows are silently dropped |
| 33 | New: T2 | Add integration tests for CSV→Sankey pipeline | Verify contracts between pipeline stages |

---

## Final Verdict

This is a solid MVP. The concept is sharp — "drag-drop CSVs, see where your money goes" — and the execution is mostly clean. The lib/components split is disciplined, TypeScript is used properly, the test suite covers the important computation, and the documentation is better than most production apps I've worked on.

**What's genuinely good:**
- Pure function architecture in `lib/` — easy to test, easy to reason about
- The categorization prompt engineering is thoughtful (detailed merchant examples, alias normalization, missing-ID backfill)
- The budget generation heuristics (median for discretionary, CV thresholds for fixed vs variable, one-time outlier detection) are statistically sound
- Transfer detection using cross-file amount matching is clever
- CSV format auto-detection is a real differentiator — most tools make you map columns manually

**What needs to change before you put this on a domain:**
1. CSP headers. Non-negotiable.
2. Drop `rawRow` from Transaction objects. You're carrying around account numbers for no reason.
3. Kill the console.debug calls. You're logging API responses in prod.
4. Fix the `streaming` → Entertainment alias bug. It's actively misclassifying.
5. Sanitize CSV exports against formula injection.

**What would take this from good to great:**
- A merchant pre-classification layer that handles 50%+ of transactions without an API call
- Confidence scoring so users know which categorizations to trust and which to review
- A Cloudflare Worker proxy so the hosted version doesn't require users to bring their own API key
- Code splitting so the 383KB bundle loads in stages
- Responsive design — even basic tablet support would double the usable audience

**Would I continue with this architecture?** Yes. The bones are right. React + Vite + D3 + Claude is a good stack for this problem. The single-file state management in App.tsx needs to evolve (extract hooks first, then consider Zustand if it keeps growing), and the build needs configuration (chunking, tree-shaking), but these are incremental improvements — not rewrites.

The biggest strategic question is whether to stay "bring your own API key" or add a proxy for hosted use. I'd do both: keep the BYOK mode for self-hosters, add a proxy with usage limits for the hosted version. That's the path from "cool tool" to "product."

Ship the security fixes, host it, and iterate. The hard problems (CSV parsing, categorization, budget heuristics) are already solved well.
