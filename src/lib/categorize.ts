import Anthropic from '@anthropic-ai/sdk'
import type { Transaction } from './types'
import { CATEGORIES } from './types'

interface CategorizationResult {
  id: string
  category: string
  subcategory: string
}

const SYSTEM_PROMPT = `You are a personal finance categorization assistant. Your job is to categorize bank transactions.

For each transaction, assign exactly one of these categories:
- Income: salary, payroll, direct deposits, interest, dividends, refunds
- Housing: rent, mortgage, utilities, internet, insurance (home/renter's)
- Food: groceries, restaurants, coffee shops, food delivery
- Transport: gas stations, parking, rideshare, public transit, car insurance, auto payments
- Shopping: retail stores, Amazon, clothing, electronics, online shopping
- Entertainment: streaming services (unless subscription), games, movies, concerts, sports
- Health: pharmacy, doctors, dentists, gym, health insurance
- Subscriptions: recurring monthly/annual services (Netflix, Spotify, Adobe, etc.)
- Transfer: transfers between accounts, payments to credit cards, Zelle, Venmo (person-to-person)
- Other: anything that doesn't fit

Also provide a short subcategory (1-3 words) for more specificity. Examples:
- Food / Groceries
- Transport / Gas
- Subscriptions / Streaming
- Income / Payroll

Respond ONLY with a JSON array, no other text. Each element: {"id": "...", "category": "...", "subcategory": "..."}`

const BATCH_SIZE = 50

const VALID_CATEGORIES = new Set<string>(CATEGORIES)

/** Parse and validate a batch response from Claude. Throws with a descriptive message on any issue. */
function parseBatchResponse(text: string, requestedIds: string[]): CategorizationResult[] {
  if (!text.trim()) {
    throw new Error('Claude returned an empty response for a categorization batch.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
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
    if (typeof obj['category'] !== 'string' || !VALID_CATEGORIES.has(obj['category'])) {
      // Use 'Other' rather than crashing on unknown category — Claude may hallucinate new ones
      obj['category'] = 'Other'
    }
    if (typeof obj['subcategory'] !== 'string') {
      obj['subcategory'] = ''
    }

    returnedIds.add(obj['id'] as string)
    results.push({
      id: obj['id'] as string,
      category: obj['category'] as string,
      subcategory: obj['subcategory'] as string,
    })
  }

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
): Promise<CategorizationResult[]> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  })

  const total = transactions.length
  // Collect all batch results before returning — caller applies atomically
  const allResults: CategorizationResult[] = []

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    if (signal?.aborted) {
      throw new Error('Categorization cancelled.')
    }

    const batch = transactions.slice(i, i + BATCH_SIZE)
    const items = batch.map((tx) => ({
      id: tx.id,
      description: tx.description,
      type: tx.type,
    }))
    const requestedIds = batch.map((tx) => tx.id)

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(items) }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const batchResults = parseBatchResponse(text, requestedIds)
    allResults.push(...batchResults)

    onProgress?.(Math.min(i + batch.length, total), total)
  }

  return allResults
}
