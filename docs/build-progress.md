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

## v1.2 Features (lenses)
- [x] Lens switcher infrastructure (pill toggle, lens state)
- [x] Essentials lens (Fixed / Variable / Discretionary — no API call)
- [x] Tax lens — Claude re-categorization into IRS schedule areas
- [x] Tax lens — ambiguous transaction flagging (? badge + side panel)
- [x] Tax lens — per-lens override isolation
- [x] CPA export (CSV sorted by tax area)
- [x] Extended sample data with tax-relevant transactions

## v1.3 Features (detailed categorization)
- [x] Detailed mode: 4-column Sankey with subcategory nodes (Claude taxonomizes to subcategory)
- [x] Categorization mode selector (Simple / Detailed toggle)
- [x] Wider SVG canvas in detailed mode (1200×560)

## v2 Features (budget)
- [x] Recurring expense detection (weekly / monthly / quarterly cadences, CV-based type classification)
- [x] Budget generation from actual spend (fixed/variable-predictable from recurring, variable-discretionary from median monthly totals, one-time detection)
- [x] Editable budget table (inline amount + notes editing, live totals)
- [x] Budget vs actual comparison table (red/green diffs, per-month normalization, net summary)
- [x] Budget CSV export + import (round-trippable, #-prefixed metadata, browser download)
- [x] Budget persistence via localStorage (restored on page load)
- [x] Budget overlay on Sankey (dashed ghost rects at budgeted height, red tint for over-budget)
- [ ] Natural-language spending observations
- [x] v2.0.0 — budget generation, comparison, CSV export/import, Sankey overlay
- [ ] Gig economy lens (Uber/Lyft drivers, Airbnb hosts)
- [ ] Business sub-tab within Tax lens (Schedule C personal/business toggle)
- [ ] Hosted version

## Milestones
- [x] Architecture skeleton — Vite + React compiles, CI passes
- [x] CSV pipeline — drag-drop → parse → normalize → display table
- [x] Categorization — Claude API classifies transactions, user can override
- [x] Sankey — categorized data renders as interactive Sankey diagram
- [x] Polish — error states, edge cases, loading states, date filter presets
- [ ] Deploy — static hosting, shareable URL
