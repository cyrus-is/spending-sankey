import Anthropic from '@anthropic-ai/sdk'
import type { Transaction } from './types'
import { CATEGORIES } from './types'
import { getCached, setCached } from './categorizationCache'

interface CategorizationResult {
  id: string
  category: string
  subcategory: string
}

/** Fixed subcategory taxonomy per category.
 *  Simple mode: Claude picks any short label (free-form).
 *  Detailed mode: Claude must pick from this list; unknown → falls back to the
 *  category name itself (e.g. "Shopping" for Shopping/Other). */
export const SUBCATEGORY_TAXONOMY: Record<string, string[]> = {
  Housing:       ['Rent/Mortgage', 'Utilities', 'Internet/Cable', 'Phone Bill', 'Insurance'],
  Groceries:     ['Supermarket', 'Warehouse Club', 'Grocery Delivery', 'Specialty Food'],
  Dining:        ['Restaurant', 'Coffee Shop', 'Food Delivery', 'Fast Food', 'Bar'],
  Transport:     ['Gas Station', 'Rideshare', 'Parking', 'Public Transit', 'Auto Insurance'],
  Travel:        ['Flight', 'Hotel', 'Vacation Rental', 'Car Rental'],
  Shopping:      ['Online Retail', 'Department Store', 'Electronics', 'Clothing'],
  Entertainment: ['Concert/Event', 'Movies/Theater', 'Nightlife', 'Gaming'],
  Health:        ['Pharmacy', 'Doctor/Medical', 'Dentist', 'Vision', 'Gym'],
  Subscriptions: ['Streaming', 'Software/SaaS', 'News/Media', 'Cloud Storage'],
  Income:        ['Payroll', 'Freelance', 'Interest', 'Tax Refund', 'Other Income'],
  Other:         ['Other'],
  Transfer:      ['Transfer'],
}

const SYSTEM_PROMPT = `You are a personal finance categorization assistant. Your job is to categorize bank transactions.

For each transaction, assign EXACTLY one of these category strings (use the exact spelling):
- Income
- Housing
- Groceries
- Dining
- Transport
- Travel
- Shopping
- Entertainment
- Health
- Subscriptions
- Transfer
- Other

Category rules:
- Income: salary, payroll, direct deposits, interest earned, tax refunds, side job payments, freelance deposits
- Housing: rent, mortgage, utilities (electric, gas, water), internet/cable, renters/home insurance, phone bill (AT&T, Comcast)
- Groceries: supermarkets and warehouse stores for food (Whole Foods, Trader Joe's, Costco, Sainsbury's, Tesco, M&S Food, Instacart delivery)
- Dining: restaurants, coffee shops (Starbucks, Blue Bottle, Costa, Pret A Manger), food delivery apps (DoorDash, GrubHub, Uber Eats, Deliveroo), fast food (Chipotle, McDonald's), Sweetgreen
- Transport: gas stations (Shell, Costco Gas), parking, rideshare trips (Uber trip, Lyft), public transit (Oyster/TfL), auto insurance, car payments
- Travel: flights (Delta, American, United), hotels (Marriott, Hilton, Hyatt), Airbnb, vacation rentals
- Shopping: Amazon, Target, retail stores, clothing, electronics (Apple Store, Best Buy), general online retail
- Entertainment: bars, concerts, movies, events, Total Wine, alcohol
- Health: CVS, Walgreens, pharmacies, doctors, dentists, gym memberships (Equinox, Planet Fitness)
- Subscriptions: Netflix, Spotify, Hulu, Apple.com/bill, Adobe, Zoom, Notion, ANTHROPIC *API, recurring SaaS
- Transfer: Zelle, Venmo, account-to-account transfers, savings transfers. Do NOT use Transfer for credit card autopay — those are flagged separately.
- Other: truly unrecognizable merchants only. When in doubt, pick the most likely category above.

Also provide a short subcategory (2-3 words). Examples:
{"id":"tx1","category":"Groceries","subcategory":"Supermarket"}
{"id":"tx2","category":"Dining","subcategory":"Food Delivery"}
{"id":"tx3","category":"Transport","subcategory":"Gas Station"}
{"id":"tx4","category":"Travel","subcategory":"Hotel"}
{"id":"tx5","category":"Subscriptions","subcategory":"Streaming"}
{"id":"tx6","category":"Income","subcategory":"Payroll"}
{"id":"tx7","category":"Housing","subcategory":"Rent"}

IMPORTANT: Respond ONLY with a valid JSON array. No markdown, no explanation, no code fences. Each element: {"id": "...", "category": "...", "subcategory": "..."}`

const DETAILED_SYSTEM_PROMPT = `You are a personal finance categorization assistant. Your job is to categorize bank transactions with a precise subcategory.

For each transaction, assign EXACTLY one category AND one subcategory from the lists below (use exact spelling):

Housing:       Rent/Mortgage | Utilities | Internet/Cable | Phone Bill | Insurance
Groceries:     Supermarket | Warehouse Club | Grocery Delivery | Specialty Food
Dining:        Restaurant | Coffee Shop | Food Delivery | Fast Food | Bar
Transport:     Gas Station | Rideshare | Parking | Public Transit | Auto Insurance
Travel:        Flight | Hotel | Vacation Rental | Car Rental
Shopping:      Online Retail | Department Store | Electronics | Clothing
Entertainment: Concert/Event | Movies/Theater | Nightlife | Gaming
Health:        Pharmacy | Doctor/Medical | Dentist | Vision | Gym
Subscriptions: Streaming | Software/SaaS | News/Media | Cloud Storage
Income:        Payroll | Freelance | Interest | Tax Refund | Other Income
Transfer:      Transfer
Other:         Other

Category rules:
- Income: salary, payroll, direct deposits, interest earned, tax refunds, side job payments, freelance deposits
- Housing: rent, mortgage, utilities (electric, gas, water), internet/cable, renters/home insurance, phone bill (AT&T, Comcast)
- Groceries: supermarkets and warehouse stores for food (Whole Foods, Trader Joe's, Costco, Sainsbury's, Tesco, M&S Food, Instacart delivery)
- Dining: restaurants, coffee shops (Starbucks, Blue Bottle, Costa, Pret A Manger), food delivery apps (DoorDash, GrubHub, Uber Eats, Deliveroo), fast food (Chipotle, McDonald's), Sweetgreen
- Transport: gas stations (Shell, Costco Gas), parking, rideshare trips (Uber trip, Lyft), public transit (Oyster/TfL), auto insurance, car payments
- Travel: flights (Delta, American, United), hotels (Marriott, Hilton, Hyatt), Airbnb, vacation rentals
- Shopping: Amazon, Target, retail stores, clothing, electronics (Apple Store, Best Buy), general online retail
- Entertainment: bars, concerts, movies, events, Total Wine, alcohol
- Health: CVS, Walgreens, pharmacies, doctors, dentists, gym memberships (Equinox, Planet Fitness)
- Subscriptions: Netflix, Spotify, Hulu, Apple.com/bill, Adobe, Zoom, Notion, ANTHROPIC *API, recurring SaaS
- Transfer: Zelle, Venmo, account-to-account transfers, savings transfers. Do NOT use Transfer for credit card autopay.
- Other: truly unrecognizable merchants only. When in doubt, pick the most likely category above.

Pick the closest subcategory from the list for that category. If nothing fits, use the category name itself (e.g. "Other" for Other).

Examples:
{"id":"tx1","category":"Groceries","subcategory":"Supermarket"}
{"id":"tx2","category":"Dining","subcategory":"Food Delivery"}
{"id":"tx3","category":"Transport","subcategory":"Gas Station"}
{"id":"tx4","category":"Travel","subcategory":"Hotel"}
{"id":"tx5","category":"Subscriptions","subcategory":"Software/SaaS"}
{"id":"tx6","category":"Income","subcategory":"Payroll"}
{"id":"tx7","category":"Housing","subcategory":"Rent/Mortgage"}
{"id":"tx8","category":"Dining","subcategory":"Coffee Shop"}

IMPORTANT: Respond ONLY with a valid JSON array. No markdown, no explanation, no code fences. Each element: {"id": "...", "category": "...", "subcategory": "..."}`

const BATCH_SIZE = 50
const CONCURRENCY = 5

const VALID_CATEGORIES = new Set<string>(CATEGORIES)

/** Map fuzzy/variant category names Claude sometimes returns to our canonical set */
const CATEGORY_ALIASES: Record<string, string> = {
  // Groceries
  grocery: 'Groceries', supermarket: 'Groceries', 'grocery store': 'Groceries',
  'warehouse grocery': 'Groceries', 'grocery delivery': 'Groceries',
  food: 'Groceries',  // generic "Food" → Groceries as the safer default
  'food & drink': 'Groceries', 'food and drink': 'Groceries',
  // Dining
  dining: 'Dining', restaurant: 'Dining', restaurants: 'Dining',
  'dining out': 'Dining', 'eating out': 'Dining',
  'coffee shop': 'Dining', 'coffee shops': 'Dining', coffee: 'Dining',
  'food delivery': 'Dining', takeout: 'Dining', takeaway: 'Dining',
  'fast food': 'Dining',
  // Transport
  gas: 'Transport', transportation: 'Transport', transit: 'Transport',
  rideshare: 'Transport', 'car insurance': 'Transport', parking: 'Transport',
  fuel: 'Transport', 'public transit': 'Transport',
  // Travel
  travel: 'Travel', hotel: 'Travel', hotels: 'Travel',
  airline: 'Travel', airlines: 'Travel', flight: 'Travel', flights: 'Travel',
  accommodation: 'Travel', lodging: 'Travel', vacation: 'Travel',
  // Shopping
  retail: 'Shopping', 'online shopping': 'Shopping', clothing: 'Shopping',
  electronics: 'Shopping', merchandise: 'Shopping', 'online retail': 'Shopping',
  // Entertainment
  entertainment: 'Entertainment', games: 'Entertainment', gaming: 'Entertainment',
  movies: 'Entertainment', concerts: 'Entertainment', sports: 'Entertainment',
  streaming: 'Entertainment', alcohol: 'Entertainment',
  // Health
  medical: 'Health', healthcare: 'Health', pharmacy: 'Health',
  fitness: 'Health', gym: 'Health', dental: 'Health',
  // Subscriptions
  subscription: 'Subscriptions', subscriptions: 'Subscriptions',
  'streaming services': 'Subscriptions', 'recurring services': 'Subscriptions',
  'ai api service': 'Subscriptions', saas: 'Subscriptions',
  // Housing
  housing: 'Housing', rent: 'Housing', mortgage: 'Housing',
  utilities: 'Housing', utility: 'Housing', insurance: 'Housing',
  'phone bill': 'Housing', 'utility bill': 'Housing', 'electric bill': 'Housing',
  // Income
  income: 'Income', salary: 'Income', payroll: 'Income',
  wages: 'Income', deposit: 'Income', 'side job': 'Income',
  // Transfer
  transfer: 'Transfer', transfers: 'Transfer',
  // Other
  miscellaneous: 'Other', misc: 'Other',
}

function normalizeCategory(raw: string): string {
  if (VALID_CATEGORIES.has(raw)) return raw
  const lower = raw.toLowerCase().trim()
  if (VALID_CATEGORIES.has(lower.charAt(0).toUpperCase() + lower.slice(1))) {
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }
  return CATEGORY_ALIASES[lower] ?? 'Other'
}

/** Clamp a Claude-returned subcategory to the taxonomy list for detailed mode.
 *  Returns the subcategory unchanged if it's already valid, falls back to
 *  the category name if it's unrecognized.
 *  @internal exported for testing */
export function normalizeSubcategory(category: string, subcategory: string): string {
  const allowed = SUBCATEGORY_TAXONOMY[category]
  if (!allowed) return subcategory          // unknown category — pass through
  if (allowed.includes(subcategory)) return subcategory
  // Case-insensitive match
  const lower = subcategory.toLowerCase()
  const match = allowed.find((s) => s.toLowerCase() === lower)
  if (match) return match
  // No match — fall back to category name as the "Other" stand-in
  return category
}

/** Parse and validate a batch response from Claude. Throws with a descriptive message on any issue. */
function parseBatchResponse(text: string, requestedIds: string[], mode = 'simple'): CategorizationResult[] {
  if (!text.trim()) {
    throw new Error('Claude returned an empty response for a categorization batch.')
  }

  // DEBUG: log raw response for first batch to diagnose categorization issues
  if (requestedIds[0]) {
    console.debug('[categorize] raw response (first 500 chars):', text.substring(0, 500))
  }

  let parsed: unknown
  try {
    // Strip markdown code fences if Claude wrapped the JSON (e.g. ```json ... ```)
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    parsed = JSON.parse(stripped)
  } catch {
    throw new Error(
      `Claude returned non-JSON for a categorization batch. Raw response: ${text.substring(0, 200)}`,
    )
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `Expected an array from Claude, got: ${typeof parsed}. Response: ${text.substring(0, 200)}`,
    )
  }

  const results: CategorizationResult[] = []
  const returnedIds = new Set<string>()

  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Batch item is not an object: ${JSON.stringify(item)}`)
    }
    const obj = item as Record<string, unknown>

    if (typeof obj['id'] !== 'string' || !obj['id']) {
      throw new Error(`Batch item missing string 'id': ${JSON.stringify(item)}`)
    }
    if (typeof obj['category'] === 'string') {
      obj['category'] = normalizeCategory(obj['category'])
    } else {
      obj['category'] = 'Other'
    }
    if (typeof obj['subcategory'] !== 'string') {
      obj['subcategory'] = ''
    }
    // In detailed mode, clamp subcategory to the fixed taxonomy
    if (mode === 'detailed') {
      obj['subcategory'] = normalizeSubcategory(
        obj['category'] as string,
        obj['subcategory'] as string,
      )
    }

    returnedIds.add(obj['id'] as string)
    results.push({
      id: obj['id'] as string,
      category: obj['category'] as string,
      subcategory: obj['subcategory'] as string,
    })
  }

  // DEBUG: log category distribution for this batch
  const dist: Record<string, number> = {}
  for (const r of results) dist[r.category] = (dist[r.category] ?? 0) + 1
  console.debug('[categorize] batch category distribution:', dist)

  // Warn about missing IDs — fill them in as 'Other' so no transaction is silently dropped
  for (const id of requestedIds) {
    if (!returnedIds.has(id)) {
      results.push({ id, category: 'Other', subcategory: '' })
    }
  }

  return results
}

export async function categorizeTransactions(
  transactions: Transaction[],
  apiKey: string,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
  /** 'simple' | 'detailed' — used as cache key discriminator */
  mode = 'simple',
): Promise<CategorizationResult[]> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  })

  const total = transactions.length
  const allResults: CategorizationResult[] = []
  let done = 0

  // Resolve cache hits upfront — only send misses to Claude
  const cacheMisses: Transaction[] = []
  for (const tx of transactions) {
    const cached = getCached(tx.description, tx.amount, tx.type, mode)
    if (cached) {
      allResults.push({ id: tx.id, ...cached })
      done++
    } else {
      cacheMisses.push(tx)
    }
  }
  onProgress?.(done, total)

  // Split misses into batches
  const batches: Transaction[][] = []
  for (let i = 0; i < cacheMisses.length; i += BATCH_SIZE) {
    batches.push(cacheMisses.slice(i, i + BATCH_SIZE))
  }

  const runBatch = async (batch: Transaction[]): Promise<CategorizationResult[]> => {
    if (signal?.aborted) throw new Error('Categorization cancelled.')
    const items = batch.map((tx) => ({ id: tx.id, description: tx.description, type: tx.type }))
    const requestedIds = batch.map((tx) => tx.id)
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: mode === 'detailed' ? DETAILED_SYSTEM_PROMPT : SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(items) }],
    })
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const results = parseBatchResponse(text, requestedIds, mode)
    // Write results to cache
    const txMap = new Map(batch.map((tx) => [tx.id, tx]))
    for (const r of results) {
      const tx = txMap.get(r.id)
      if (tx) setCached(tx.description, tx.amount, tx.type, mode, { category: r.category, subcategory: r.subcategory })
    }
    return results
  }

  // Run batches with bounded concurrency
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    if (signal?.aborted) throw new Error('Categorization cancelled.')
    const group = batches.slice(i, i + CONCURRENCY)
    const groupResults = await Promise.all(group.map(runBatch))
    for (const batchResults of groupResults) {
      allResults.push(...batchResults)
      done += batchResults.length
    }
    onProgress?.(Math.min(done, total), total)
  }

  return allResults
}
