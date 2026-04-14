# Spending Sankey

Drag-drop your bank CSVs, see where your money goes.

Export CSVs from your banks and credit cards, drop them in, and get an interactive Sankey diagram of your income and spending — no account linking, no sign-up, no data leaving your browser.

---

## How it works

1. **Export CSVs** from your bank(s) — Chase, BofA, Amex, Monzo, credit unions, most others work out of the box
2. **Drop them in** — the app auto-detects each bank's column layout, date format, and amount convention
3. **Categorize** — click "Categorize with Claude" and your transactions get sorted into 12 spending categories
4. **Explore** — interactive Sankey diagram shows income → spending flow; hover over any category for a top-5 vendor breakdown; filter by date range

The app handles multi-file uploads (checking + credit card + savings in one go), detects transfers between your own accounts so they don't inflate your totals, and lets you override any category it got wrong.

---

## Privacy

**Your bank data never leaves your browser.**

- All CSV parsing and processing runs locally in the page
- The only outbound network call is to the Claude API for transaction categorization
- That call sends merchant names and transaction types only — **amounts and account numbers are never sent**
- Your Claude API key is stored in `sessionStorage` (cleared when you close the tab, never sent anywhere except Anthropic's API)
- No analytics, no telemetry, no server of any kind

This is the core design constraint, not an afterthought. The reason the app exists is that connecting real bank credentials to a third party is a significant trust ask. CSV export sidesteps that entirely.

### What goes to the Claude API

When you click "Categorize", the app sends batches of transaction descriptions in this shape:

```json
[
  { "id": "tx-42", "description": "WHOLEFDS MKT #10", "type": "debit" },
  { "id": "tx-43", "description": "SHELL OIL 57442",  "type": "debit" }
]
```

No dates. No amounts. No account numbers. Claude reads the merchant name and returns a category.

---

## Getting started

You'll need a Claude API key from [console.anthropic.com](https://console.anthropic.com). The categorization step uses Claude Sonnet, which costs roughly $0.003 per 1,000 transactions — a full year of data typically runs a few cents.

1. Open the app and paste your API key into the key field (it's only kept for the current tab session)
2. Drag your CSV exports onto the drop zone — you can load multiple files at once
3. Click **Categorize with Claude**
4. Use the date range buttons to filter by period; hover expense nodes for vendor breakdowns

### Supported CSV formats

The app auto-detects format — you don't need to configure anything. Tested against:

| Bank | Date format | Amount style |
|------|-------------|--------------|
| Chase Checking | MM/DD/YYYY | Single `Amount` column, negative = credit |
| Bank of America Credit Card | MM/DD/YYYY | Positive = charge, negative = payment |
| American Express | MM/DD/YYYY | `(NNN.NN)` parenthetical = charge |
| Generic Credit Union | YYYY-MM-DD | Separate `Debit` / `Credit` columns |
| Monzo (UK) | DD/MM/YYYY | `Paid out` / `Paid in` columns, GBP |

Most other banks follow one of these patterns and will work without any configuration.

---

## Spending categories

Transactions are sorted into 12 categories:

| Category | What goes here |
|----------|---------------|
| **Groceries** | Supermarkets, warehouse stores, grocery delivery (Instacart) |
| **Dining** | Restaurants, coffee shops, food delivery apps, fast food |
| **Housing** | Rent, mortgage, utilities, internet, phone bill, renters insurance |
| **Transport** | Gas stations, rideshare trips, public transit, parking |
| **Travel** | Flights, hotels, Airbnb, vacation rentals |
| **Shopping** | Amazon, retail stores, electronics, clothing |
| **Health** | Pharmacies, doctors, dentists, gym memberships |
| **Subscriptions** | Streaming, SaaS, recurring software (Netflix, Spotify, Adobe…) |
| **Entertainment** | Bars, concerts, events, alcohol |
| **Income** | Salary, side income, interest, tax refunds |
| **Transfer** | Transfers between your own accounts (auto-detected, excluded from totals) |
| **Other** | Anything unrecognized |

You can override any category from the transaction table.

---

## Running locally

```bash
npm install
npm run dev
```

Requires Node 18+. There's no backend — `npm run dev` is the whole stack.

```bash
npm test      # unit tests (Vitest)
npm run build # production build
npm run lint  # ESLint
```

### Sample data

`sample-data/` contains five synthetic CSVs (Chase, BofA, Amex, Credit Union, Monzo) covering a full year of transactions. Drop them all in to test parsing and categorization without using real bank data. See [`sample-data/README.md`](sample-data/README.md) for what each file exercises.

---

## What's not built yet

- Budget generation from actual spend (compute monthly averages, detect recurring vs one-time)
- Budget vs actual overlay on the Sankey
- Recurring expense detection
- Export to JSON/CSV
- Hosted version (self-host for now)
