# Spending Sankey — Personal Finance Flow Visualizer

*Brainstorm from 2026-03-14*

---

## The Idea

A tool where you hand it a bunch of CSVs from your different banking institutions with as much purchase history as you can, and it builds a Sankey diagram of your spending and helps you build a budget.

## The Three Problems

### 1. CSV Parsing (hard part)
Every bank, credit union, and credit card company exports CSVs differently — column names, date formats, amount sign conventions, varying detail levels. Need a normalizer that ingests heterogeneous CSVs and maps them to a common schema. An LLM is perfect here — inspect headers and first few rows, auto-map columns to a standard format (date, description, amount, type).

### 2. Categorization (medium part)
Classify "AMZN Mktp US*2K7..." as Shopping and "SHELL OIL 57442" as Gas. LLM pattern matching on merchant names works well. Let users correct/override to improve over time.

### 3. The Sankey Visualization (easier part)
D3.js has solid Sankey support, Plotly can render them too. Once data is categorized and normalized, the visualization is straightforward. Income sources on left → categories → subcategories on right.

## Implementation Approach

React app where you drag-and-drop CSVs, use Claude's API to auto-detect format and categorize transactions, then render an interactive Sankey diagram.

## Feature: Auto-Generate Budget from Actual Spend

### What it does

After categorizing transactions, automatically infer a monthly budget from actual spending patterns. Detect recurring vs one-time expenses, classify fixed vs variable spending, identify income sources, and present an editable budget table the user can adjust. Phase 1 reflects reality ("here's what you actually spend"). Phase 2 surfaces observations without being preachy.

### Required data from categorized transactions

- **Per transaction:** date, normalized amount, category, subcategory, merchant name (cleaned)
- **Derived:** monthly totals per category, transaction frequency per merchant, income vs expense flag
- **Minimum viable data:** 3 months of history. 6+ months significantly better for seasonal detection.

### Recurring vs one-time detection

Group transactions by normalized merchant name (fuzzy match — "NETFLIX.COM" vs "NETFLIX INC" are the same), then check:
- **Same merchant + similar amount (within ~10%) + regular cadence** (monthly, weekly, quarterly) = recurring. Needs 3+ occurrences to confirm.
- **Same merchant + variable amounts + regular cadence** = variable recurring (e.g., electric bill)
- **Everything else** = one-time or irregular

Implementation: cluster by merchant name similarity, run periodicity detection on date intervals. No ML needed — simple heuristics work.

### Handling variable vs fixed spending

| Type | Detection | Budget Value |
|------|-----------|-------------|
| **Fixed** (rent, subscriptions) | Low coefficient of variation (<5%) | Use exact amount |
| **Variable-predictable** (electric, gas) | Recurring cadence, moderate variance | Use 3-month rolling average |
| **Variable-discretionary** (groceries, dining) | No fixed cadence, many merchants | Use median monthly total (not mean — resists outlier months) |
| **One-time / irregular** | No pattern | Exclude from monthly budget, surface as "one-time spend" note |

### Income detection

- **Salary:** Large recurring deposits, typically bi-weekly or semi-monthly, from the same source. Easy to detect.
- **Side income:** Smaller recurring or irregular deposits. Flag deposits above a threshold (e.g., >$100) that aren't internal transfers. Let user confirm.
- **Transfers between own accounts:** Hardest part. Match amounts on same date across CSVs from different accounts. Claude API can flag likely transfers based on description patterns ("TRANSFER FROM", "Zelle", etc.).
- **Recommended approach:** Auto-detect obvious salary, then prompt user to confirm/tag other deposits during an "income review" step before budget generation.

### Output format

**Monthly budget**, broken into:
- **Income** section: total expected monthly income, broken by source
- **Fixed expenses**: line items with exact amounts
- **Variable expenses**: line items with suggested range (median ± 1 std dev, capped to min/max observed)
- **Discretionary**: category-level totals
- **Summary**: total income, total budgeted, surplus/deficit

Format as a simple table the user can edit inline. Store as JSON internally so it can feed back into the Sankey diagram (budget vs actual overlay).

### Phased approach

**Phase 1: Reflect reality.** Auto-generate the budget as a mirror of actual spending. No judgment. This is the core value — "here is what you actually spend."

**Phase 2 (later): Surface observations, not prescriptions.** Examples: "Subscriptions are 5.5% of income (average US household: 3.2%)" or "Dining out increased 22% over the last 3 months." Let users set their own targets. Avoid being preachy — that's why people leave budgeting apps.

### Technical approach

**Client-side with Claude API calls is sufficient.** The categorization step produces the structured data needed. Recurring detection is pure arithmetic — group, measure intervals, compute variance. Runs in-browser in milliseconds on typical transaction volumes (10K rows is trivial). Budget generation is aggregation + simple statistics. No server needed. One optional Claude API call to generate natural-language observations (phase 2).

### Build estimate

| Component | Estimate |
|-----------|----------|
| Recurring detection engine | 2-3 days |
| Budget generation logic (aggregation, fixed/variable classification) | 2-3 days |
| Budget UI (editable table, income review step) | 3-4 days |
| Budget vs actual overlay on Sankey | 2-3 days |
| Edge cases (transfers, refunds, partial months) | 1-2 days |
| **Total for budget feature** | **~1.5-2 weeks** |
| **Full tool (CSV + categorization + Sankey + budget)** | **~3.5-6 weeks** |

### Reference projects

- **Firefly III** (github: firefly-iii) — mature open-source personal finance with recurring detection and budgeting; good reference for data model and rules engine
- **Lunch Money** — clean UX for recurring item detection worth studying
- **SankeyMATIC** (github: nowthis/sankeymatic) — open-source Sankey rendering, could use directly
- **up-bankey** (github: plewien/up-bankey) — Sankey from bank API data, closest prior art for visualization
- **Finflow** (github: Millais/Finflow) — prototype spending visualization dashboard with Sankey diagrams

## Status

Idea stage. Scoped with budget generation feature. Low strategic priority but clear value and short build.
