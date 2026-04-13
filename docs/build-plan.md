# Build Plan

Created: 2026-04-12

Each chunk is a shippable increment. Commit + push after each. Every push must pass `npm run build`.

---

## Chunk 1: Project scaffold
**Goal:** `npm run dev` renders a blank page. `npm run build` passes. CI green.

- package.json with React 19, TypeScript, Vite, D3, @anthropic-ai/sdk, Vitest, ESLint
- vite.config.ts, tsconfig.json, .eslintrc
- src/index.html, src/main.tsx, src/App.tsx (blank page, "Spending Sankey" heading)
- .gitignore updated for node_modules/dist

## Chunk 2: CSV drag-drop + raw display
**Goal:** User can drop CSV files onto the app and see raw rows in a table.

- `src/components/DropZone.tsx` — drag-and-drop file input
- `src/components/RawTable.tsx` — displays raw CSV rows
- App state: list of uploaded files with their raw parsed rows
- Multi-file support (upload from 3 banks at once)
- Uses browser File API + PapaParse for CSV reading

## Chunk 3: CSV parser lib + tests
**Goal:** `lib/parser.ts` normalizes any CSV to `Transaction[]`. Tests pass.

- `Transaction` interface: `{ id, date, description, amount, type, sourceFile, rawRow }`
- `detectFormat(headers, rows)` — returns column mapping
- `parseTransactions(file, rawRows, format)` — normalizes to Transaction[]
- Handle: different column names, date formats (MM/DD/YYYY, YYYY-MM-DD, etc.), amount sign conventions (debit column + credit column, or single signed amount)
- `src/lib/parser.test.ts` with Chase, BofA, Amex format fixtures

## Chunk 4: Claude API integration
**Goal:** Transactions get categories assigned via Claude API. User enters API key.

- `src/components/ApiKeyEntry.tsx` — input for Claude API key (sessionStorage)
- `src/lib/categorize.ts` — sends transaction descriptions in batches, returns `{ id, category, subcategory }[]`
- Categories: Housing, Food, Transport, Shopping, Entertainment, Health, Subscriptions, Income, Transfer, Other
- `src/lib/format-detect.ts` — uses Claude to detect ambiguous CSV formats
- App flow: upload → parse → detect format → categorize → show categorized table

## Chunk 5: Sankey diagram
**Goal:** Categorized transactions render as an interactive D3 Sankey.

- `src/lib/sankey.ts` — transforms `Transaction[]` → Sankey nodes + links
- Income sources (left) → categories (right), link width = dollar amount
- `src/components/SankeyChart.tsx` — D3 SVG rendering, hover tooltips
- Filters out Transfer category from Sankey
- Shows total income and total expenses

## Chunk 6: Date-range filtering
**Goal:** User can filter transactions by month or custom date range.

- `src/components/DateFilter.tsx` — month picker or custom range
- Filter state lifted to App, passed down to Sankey + table
- Default: show all loaded data; "This month" convenience button

## Chunk 7: Category overrides
**Goal:** User can correct any transaction's category. Changes persist in session.

- `src/components/TransactionTable.tsx` — shows categorized transactions with inline category dropdown
- Override stored in app state (overrides map: `id → category`)
- Sankey re-renders when overrides change

## Chunk 8: Transfer detection
**Goal:** Transfers between own accounts are flagged and excluded from Sankey.

- `src/lib/transfers.ts` — match transactions by amount + date proximity across files
- Flag as "Transfer" category automatically
- User can un-flag false positives

## Chunk 9: Polish
**Goal:** Error states, loading states, empty states, basic responsive layout.

- Loading spinner during Claude API calls
- Error banner for API errors (invalid key, rate limit)
- Empty state for DropZone (nice prompt)
- Error boundary for Sankey
- Basic CSS pass — readable, not embarrassing

---

## Order of execution
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

Stop after each chunk, verify build, commit, push.
