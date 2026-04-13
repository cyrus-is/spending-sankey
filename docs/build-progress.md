# Build Progress

Source: hq/projects/ideas/spending-sankey.md

## v1 Features
- [ ] CSV drag-and-drop upload (multi-file)
- [ ] AI format detection (column mapping, date parsing, amount conventions)
- [ ] Transaction normalization to common schema
- [ ] AI transaction categorization (merchant → category)
- [ ] User category overrides / corrections
- [ ] Interactive Sankey diagram (income → categories → subcategories)
- [ ] Monthly/date-range filtering
- [ ] Transfer detection (between own accounts)

## v2 Features (post-launch)
- [ ] Recurring expense detection
- [ ] Budget generation from actual spend
- [ ] Budget vs actual overlay on Sankey
- [ ] Natural-language spending observations (Phase 2)
- [ ] Export budget as JSON/CSV

## Milestones
- [ ] Architecture skeleton — Vite + React compiles, CI passes
- [ ] CSV pipeline — drag-drop → parse → normalize → display table
- [ ] Categorization — Claude API classifies transactions, user can override
- [ ] Sankey — categorized data renders as interactive Sankey diagram
- [ ] Polish — error states, edge cases (empty CSVs, weird formats)
- [ ] Deploy — static hosting, shareable URL
