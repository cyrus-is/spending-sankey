import Anthropic from '@anthropic-ai/sdk'
import type { Transaction } from './types'

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

export async function categorizeTransactions(
  transactions: Transaction[],
  apiKey: string,
  onProgress?: (done: number, total: number) => void,
): Promise<CategorizationResult[]> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  })

  const results: CategorizationResult[] = []
  const total = transactions.length

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE)
    const items = batch.map((tx) => ({
      id: tx.id,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
    }))

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(items),
        },
      ],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text) as CategorizationResult[]
    results.push(...parsed)

    onProgress?.(Math.min(i + BATCH_SIZE, total), total)
  }

  return results
}

/** Use Claude to detect the column mapping for a CSV that our heuristics couldn't parse */
export async function detectFormatWithClaude(
  headers: string[],
  sampleRows: Record<string, string>[],
  apiKey: string,
): Promise<{ date: string; description: string; amount?: string; debit?: string; credit?: string }> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  })

  const prompt = `Here are the headers and first few rows of a bank CSV file. Identify which columns contain: date, description/merchant name, and amount (or separate debit/credit columns).

Headers: ${JSON.stringify(headers)}
Sample rows: ${JSON.stringify(sampleRows.slice(0, 3))}

Respond with JSON only: {"date": "column name", "description": "column name", "amount": "column name or null", "debit": "column name or null", "credit": "column name or null"}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(text) as { date: string; description: string; amount?: string; debit?: string; credit?: string }
}
