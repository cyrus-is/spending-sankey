# Build Progress

Source: hq/projects/ideas/spending-sankey.md

## v1 Features
- [x] CSV drag-and-drop upload (multi-file)
- [x] AI format detection (column mapping, date parsing, amount conventions)
- [x] Transaction normalization to common schema
- [x] AI transaction categorization (merchant → 12 categories)
- [x] User category overrides / corrections
- [x] Interactive Sankey diagram (income → categories)
- [x] Vendor tooltip on expense nodes (top 5 by spend)
- [x] Monthly/date-range filtering (All Time / Last Year / Last 3 Months / Last Month)
- [x] Transfer detection (keyword patterns + cross-file amount matching)
- [x] CC autopay detection (AUTOPAY PAYMENT, PAYMENT THANK YOU)

## v2 Features (post-launch)
- [ ] Recurring expense detection
- [ ] Budget generation from actual spend
- [ ] Budget vs actual overlay on Sankey
- [ ] Natural-language spending observations
- [ ] Export budget as JSON/CSV
- [ ] Hosted version

## Milestones
- [x] Architecture skeleton — Vite + React compiles, CI passes
- [x] CSV pipeline — drag-drop → parse → normalize → display table
- [x] Categorization — Claude API classifies transactions, user can override
- [x] Sankey — categorized data renders as interactive Sankey diagram
- [x] Polish — error states, edge cases, loading states, date filter presets
- [ ] Deploy — static hosting, shareable URL
