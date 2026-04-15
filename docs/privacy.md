# How Spending Sankey Handles Your Data

## The short version

Your bank data stays in your browser. The only network call is from your browser directly to Claude's API to classify your transactions. We never see, store, or proxy your data. There is no backend.

## What stays in your browser

| Data | Where it lives | How long |
|------|---------------|----------|
| Your CSV files | Browser memory only | Until you close the tab |
| Parsed transactions | Browser memory (React state) | Until you close the tab |
| Categorization results | sessionStorage (cache) | Until you close the tab |
| Your budget | localStorage | Until you click "Clear Budget" |
| Your API key | sessionStorage or localStorage | Depends on "Remember my key" |

Nothing is written to disk, uploaded to a server, or sent anywhere except as described below.

## What gets sent to Claude's API

When you click "Categorize with Claude," your browser calls the Anthropic API directly (api.anthropic.com). Each transaction sends:

- **Merchant name** — e.g., "STARBUCKS #12345 SAN FRANCISCO CA"
- **Amount** — e.g., $4.75
- **Type** — debit or credit

That's it. We do NOT send:

- Account numbers
- Balances
- Routing numbers
- Your name or address
- Any other columns from your CSV

The API call goes straight from your browser to Anthropic. It does not pass through our servers. We cannot see it. The `Content-Security-Policy` header on this page enforces that the only external domain your browser can talk to is `api.anthropic.com`.

## Your API key

You provide your own Claude API key. We store it in one of two places depending on your choice:

- **"Remember my key" unchecked (default):** stored in `sessionStorage` — deleted when you close the tab
- **"Remember my key" checked:** stored in `localStorage` — persists across sessions until you click "Clear"

The key is scoped to this site's origin. Other websites cannot read it. Clearing your browser data removes it.

## What about the Tax lens?

Same rules. The Tax lens sends the same data (merchant name, amount, type) to Claude for IRS-area classification. Same direct browser-to-API call, same privacy guarantees.

## What about budget data?

Your budget is stored in `localStorage` as aggregated category totals and monthly amounts. It contains no raw transaction data, no merchant names, no account information. It survives page refreshes. You can export it as a CSV and clear it at any time.

## Can I verify this?

Yes. This is an open-source project. You can:

1. Read the source code at [github.com/cyrus-is/spending-sankey](https://github.com/cyrus-is/spending-sankey)
2. Open your browser's Network tab while using the app — you'll see requests only to `api.anthropic.com`
3. Check the `Content-Security-Policy` header in the page source — it restricts all network access to `'self'` and `api.anthropic.com`
4. Run it locally: `git clone`, `npm install`, `npm run dev`

## Self-hosting

If you prefer not to use the hosted version at all, clone the repo and run it locally. The app is a static site — `npm run build` produces a `dist/` folder you can serve from anywhere. No server-side code, no database, no environment variables needed.
