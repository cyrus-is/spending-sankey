# Sample Data — Persona Methodology

How to build a realistic synthetic transaction persona for testing and demo purposes.

## Why bother with realism?

Generic fake data (MERCHANT A $50.00, MERCHANT B $120.00) doesn't test what matters: merchant name normalization, pre-classifier coverage, income/transfer edge cases, and realistic spending ratios. A realistic persona catches real bugs.

---

## Step-by-step

### 1. Anchor on net take-home, not gross

High income ≠ high cash flow. CA taxes + 401k + benefits can consume 40–45% of gross. Start with what actually hits checking:

- Federal effective rate (look up bracket + standard deduction math)
- CA state effective rate (~9–11% for mid-to-high earners)
- 401k max ($23,500 in 2026 per person)
- FICA phases out above $176k

At $500k combined (CA), take-home is ~$25,800/month — not $41k. The gap matters.

Include pay frequency and dates. Bi-weekly vs semi-monthly creates different transaction rhythms.

### 2. Build fixed costs first — they anchor everything else

List every committed monthly outflow before variable spending:
- **Housing:** mortgage PITI or rent. South Bay 2024–25: $10,000–$14,000/month for a house
- **Childcare:** full-time infant/toddler rates in expensive metros: $2,800–$3,600/month
- **Insurance:** auto (CA is expensive), pet, renters/homeowners
- **Subscriptions:** list them individually — they're categorized one by one
- **Recurring services:** gym, cleaner, landscaper, dog walker

Sum these. If they exceed take-home, the persona is fictional. If they're 60–70% of take-home, that's realistic for high-COL areas.

### 3. Assign variable spending by category with realistic amounts

| Category | Low | Mid | High |
|----------|-----|-----|------|
| Groceries (family of 4, SF Bay) | $900 | $1,350 | $1,800 |
| Dining + delivery | $600 | $1,100 | $1,800 |
| Gas (one ICE vehicle) | $120 | $185 | $250 |
| Amazon/general shopping | $150 | $280 | $500 |
| Target/big box | $100 | $200 | $350 |
| Kids activities | $100 | $220 | $500 |
| Medical (routine) | $50 | $150 | $350 |

### 4. Add persona-specific layers

What makes this person different from a generic household?

- **Chronic condition:** Pick something common and visible in transaction data. Type 1 Diabetes works well: pharmacy (monthly), DME supplier (monthly), specialist copay (quarterly), pump supplies (quarterly). Hypothyroidism is cheaper and simpler. RA requires specialty pharmacy. Each creates a distinct data pattern.
- **Pets:** Dog walkers (recurring Rover charges), Chewy (monthly), groomer (every 6–8 weeks), vet (1–2x/year with large bill)
- **Mental health:** Therapy is very common in tech. $180–250/session, bi-weekly.
- **House services:** Cleaning (bi-weekly Zelle, looks like peer transfer), landscaping (monthly)

### 5. Use geographic specificity for merchants

Generic "GROCERY STORE" doesn't test the pre-classifier. Use what people in that metro actually see on statements:

**SF Bay Area / South Bay:**
- Groceries: Whole Foods, Trader Joe's, 99 Ranch Market (very common), Safeway, Costco, Sprouts
- Coffee: Philz Coffee (Bay Area icon), Blue Bottle, Starbucks
- Dining: Dish Dash (Sunnyvale), Rangoon Ruby (Sunnyvale/Palo Alto), Evvia Estiatorio (Palo Alto), Plumed Horse (Saratoga), Manresa (Los Gatos), Ramen Nagi, Kang Nam BBQ, Ike's Sandwiches
- Gas: Chevron dominates, some Shell, Tesla Supercharger for EV owners
- Fitness: Equinox (Santa Clara), Bay Club, CorePower Yoga, Peloton

**By metro — grocery anchor stores:**
| Metro | Primary chains |
|-------|---------------|
| SF Bay Area | Safeway, Lucky's, 99 Ranch, Ranch 99, Draeger's |
| LA | Vons, Ralph's, Sprouts, Erewhon, Gelson's |
| NYC | Key Food, Associated, Fairway, Food Emporium, FreshDirect |
| Chicago | Jewel-Osco, Mariano's, Sunset Foods |
| Houston/Dallas | H-E-B (primary), Randalls, Tom Thumb, Central Market |
| Miami | Publix (dominant), Winn-Dixie, Sedano's |
| Atlanta | Publix, Kroger |
| Seattle | QFC, Fred Meyer, PCC Community Markets |
| DC/NoVA | Giant Food, Harris Teeter, Wegmans |
| Boston | Stop & Shop, Market Basket, Whole Foods |

### 6. Include trip/one-time spending

One or two trips per quarter adds realism and tests Travel categorization:
- Domestic with kids: flights (Alaska, Southwest, United), Airbnb or Hilton/Marriott, SeaWorld/Aquarium, local dining
- Weekend getaway: Airbnb, ski resort, gas for drive (if driving distance)
- Spread trip charges across a 3–5 day window so they cluster naturally

### 7. Build edge cases for testing

Think about what your categorization pipeline might get wrong:

| Edge case | How to include |
|-----------|---------------|
| Zelle to service worker | ZELLE*MARIA GARCIA — should not be Income |
| RSU vest | FIDELITY NETBENEFITS*NVDA RSU — should be Income |
| Pet-related spending | Rover (Transport?), Chewy (Shopping), VCA vet (Health) |
| Local restaurants pre-classifier doesn't know | Include a mix of chain + independent spots |
| Medical DME vs pharmacy | Dexcom (device supplies) vs CVS (drugs) — both Health |
| Kids activities | School district payments vs commercial gym class |
| Quarterly vs monthly charges | Some charges only appear 1–2x in a 3-month window |

### 8. Format for the parser

Use the simplest format the parser handles cleanly:

```
Date,Description,Amount
MM/DD/YYYY,MERCHANT NAME ON STATEMENT,±amount
```

- Negative = expense (debit)
- Positive = income or credit
- Use merchant names as they appear on actual bank statements (all caps, with store numbers, city suffix)
- Keep amounts to 2 decimal places
- Stay within 3 calendar months for budget generation accuracy

---

## Existing personas

| File | Description |
|------|-------------|
| `sfbay-mid-career-tech-couple/checking.csv` | Mid-30s tech couple (Nvidia engineer + Salesforce PM), 2 kids, dog, Sunnyvale CA, T1D, 3 months Jan–Mar 2026 |

---

## Persona ideas not yet built

- NYC 20-something, single, entry-level finance ($72k, Brooklyn, no car, Citibike, a lot of food delivery, roommates)
- Chicago couple no kids, dual income ($160k HH), condo owners, foodies, one dog
- Houston family, single income + spouse stays home, 3 kids, minivan, H-E-B loyalists, church tithing
- Retired couple, Sun City AZ, Medicare supplements, Costco, snowbirds (seasonal spending spikes)
- South Florida retiree couple, heavy medical, fixed income + RMDs, condo fees, no mortgage
