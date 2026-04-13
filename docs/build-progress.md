# Build Progress

Source: hq/projects/ideas/spending-sankey.md

## v1 Features
- [x] CSV drag-and-drop upload (multi-file)
- [x] AI format detection (column mapping, date parsing, amount conventions)
- [x] Transaction normalization to common schema
- [x] AI transaction categorization (merchant → category)
- [x] User category overrides / corrections
- [x] Interactive Sankey diagram (income → categories → subcategories)
- [x] Monthly/date-range filtering
- [x] Transfer detection (between own accounts)

## v2 Features (post-launch)
- [ ] Recurring expense detection
- [ ] Budget generation from actual spend
- [ ] Budget vs actual overlay on Sankey
- [ ] Natural-language spending observations (Phase 2)
- [ ] Export budget as JSON/CSV

## Milestones
- [x] Architecture skeleton — Vite + React compiles, CI passes
- [x] CSV pipeline — drag-drop → parse → normalize → display table
- [x] Categorization — Claude API classifies transactions, user can override
- [x] Sankey — categorized data renders as interactive Sankey diagram
- [x] Polish — error states, edge cases (empty CSVs, weird formats), loading states
- [ ] Deploy — static hosting, shareable URL
