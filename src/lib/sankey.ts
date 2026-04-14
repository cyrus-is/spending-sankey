import type { Transaction } from './types'

export interface VendorTotal {
  name: string
  amount: number
}

export interface SankeyNode {
  id: string
  label: string
  value: number
  color: string
  /** Top vendors by spend — populated for expense category nodes only */
  topVendors?: VendorTotal[]
}

export interface SankeyLink {
  source: string
  target: string
  value: number
}

export interface SankeyData {
  nodes: SankeyNode[]
  links: SankeyLink[]
  totalIncome: number
  totalExpenses: number
}

const CATEGORY_COLORS: Record<string, string> = {
  Income: '#68d391',
  Housing: '#fc8181',
  Groceries: '#f6ad55',
  Dining: '#f9a74b',
  Transport: '#76e4f7',
  Travel: '#4fd1c7',
  Shopping: '#b794f4',
  Entertainment: '#fbb6ce',
  Health: '#90cdf4',
  Subscriptions: '#fed7aa',
  Other: '#a0aec0',
}

const INCOME_COLOR = '#68d391'

export function buildSankeyData(
  transactions: Transaction[],
  overrides: Record<string, string>,
  /** Income sources below this fraction of total are merged into "Other Income". Default 0.02 (2%). */
  mergeThreshold = 0.02,
): SankeyData {
  // Apply overrides
  const txns = transactions.map((tx) => ({
    ...tx,
    category: overrides[tx.id] ?? tx.category,
  }))

  // Filter out transfers
  const nonTransfer = txns.filter((tx) => tx.category !== 'Transfer')

  // Categories that, when assigned to a credit transaction, signal a refund/return
  // rather than true income. Claude assigns these when it recognises the merchant.
  const EXPENSE_CATEGORIES = new Set([
    'Groceries', 'Dining', 'Housing', 'Transport', 'Travel',
    'Shopping', 'Entertainment', 'Health', 'Subscriptions',
  ])

  // Separate income and expenses; credits with an expense category are refunds
  const refundTransactions = nonTransfer.filter(
    (tx) => tx.type === 'credit' && EXPENSE_CATEGORIES.has(tx.category),
  )
  const incomeTransactions = nonTransfer.filter(
    (tx) => tx.type === 'credit' && !EXPENSE_CATEGORIES.has(tx.category),
  )
  const expenseTransactions = nonTransfer.filter((tx) => tx.type === 'debit')

  const totalIncome = incomeTransactions.reduce((s, tx) => s + tx.amount, 0)

  // Group income by source label, merging small ones into "Other Income"
  const incomeBySource = new Map<string, number>()
  for (const tx of incomeTransactions) {
    const source = normalizeSource(tx.description)
    incomeBySource.set(source, (incomeBySource.get(source) ?? 0) + tx.amount)
  }

  // Merge income sources below mergeThreshold into "Other Income"
  const threshold = totalIncome * mergeThreshold
  const mergedIncome = new Map<string, number>()
  let otherIncome = 0
  for (const [source, amount] of incomeBySource) {
    if (amount < threshold && incomeBySource.size > 3) {
      otherIncome += amount
    } else {
      mergedIncome.set(source, amount)
    }
  }
  if (otherIncome > 0) mergedIncome.set('Other Income', otherIncome)

  // Group expenses by category, and track vendor totals within each category
  const expenseByCategory = new Map<string, number>()
  const vendorsByCategory = new Map<string, Map<string, number>>()
  for (const tx of expenseTransactions) {
    expenseByCategory.set(tx.category, (expenseByCategory.get(tx.category) ?? 0) + tx.amount)
    if (!vendorsByCategory.has(tx.category)) vendorsByCategory.set(tx.category, new Map())
    const vendorName = normalizeVendorName(tx.description)
    const vendors = vendorsByCategory.get(tx.category)!
    vendors.set(vendorName, (vendors.get(vendorName) ?? 0) + tx.amount)
  }

  // Net refunds against their expense category (and vendor totals)
  for (const tx of refundTransactions) {
    const cat = tx.category
    expenseByCategory.set(cat, (expenseByCategory.get(cat) ?? 0) - tx.amount)
    if (!vendorsByCategory.has(cat)) vendorsByCategory.set(cat, new Map())
    const vendorName = normalizeVendorName(tx.description)
    const vendors = vendorsByCategory.get(cat)!
    vendors.set(vendorName, (vendors.get(vendorName) ?? 0) - tx.amount)
  }

  const totalExpenses = [...expenseByCategory.values()]
    .filter((v) => v > 0)
    .reduce((s, v) => s + v, 0)

  // Build nodes
  const nodes: SankeyNode[] = []
  const links: SankeyLink[] = []

  // Central "Spending" node that all income flows through
  nodes.push({
    id: 'spending',
    label: 'Spending',
    value: Math.min(totalIncome, totalExpenses),
    color: '#4a5568',
  })

  // Income source nodes (left side)
  for (const [source, amount] of mergedIncome) {
    const nodeId = `income:${source}`
    nodes.push({
      id: nodeId,
      label: source,
      value: amount,
      color: INCOME_COLOR,
    })
    links.push({
      source: nodeId,
      target: 'spending',
      value: amount,
    })
  }

  // Expense category nodes (right side); skip categories fully neutralized by refunds
  for (const [category, amount] of expenseByCategory) {
    if (amount <= 0) continue
    const nodeId = `cat:${category}`
    const vendorMap = vendorsByCategory.get(category)
    const topVendors = vendorMap
      ? [...vendorMap.entries()]
          .filter(([, amt]) => amt > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, amt]) => ({ name, amount: amt }))
      : []
    nodes.push({
      id: nodeId,
      label: category,
      value: amount,
      color: CATEGORY_COLORS[category] ?? '#a0aec0',
      topVendors,
    })
    links.push({
      source: 'spending',
      target: nodeId,
      value: amount,
    })
  }

  // If income > expenses, add "Savings" node
  if (totalIncome > totalExpenses && totalIncome > 0) {
    const savings = totalIncome - totalExpenses
    nodes.push({
      id: 'cat:Savings',
      label: 'Savings',
      value: savings,
      color: '#68d391',
    })
    links.push({
      source: 'spending',
      target: 'cat:Savings',
      value: savings,
    })
  }

  return { nodes, links, totalIncome, totalExpenses }
}

/** Normalize a vendor description to a clean, groupable name */
function normalizeVendorName(description: string): string {
  let s = description
    .replace(/\*[A-Z0-9]+$/i, '')      // strip trailing order IDs like *8N3LQ7PK5
    .replace(/#\d+/g, '')              // strip store numbers like #123
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Well-known merchant normalizations
  const MERCHANT_MAP: [RegExp, string][] = [
    [/wholefds|whole\s*foods/i, 'Whole Foods'],
    [/trader\s*joe/i, 'Trader Joe\'s'],
    [/starbucks/i, 'Starbucks'],
    [/amazon(?!\.com\s*refund)/i, 'Amazon'],
    [/shell\s*oil|shell\s*service/i, 'Shell'],
    [/costco\s*gas/i, 'Costco Gas'],
    [/costco\s*whse|costco(?!\s*gas)/i, 'Costco'],
    [/netflix/i, 'Netflix'],
    [/spotify/i, 'Spotify'],
    [/target/i, 'Target'],
    [/cvs\s*pharmacy/i, 'CVS Pharmacy'],
    [/walgreens/i, 'Walgreens'],
    [/uber\s*eats/i, 'Uber Eats'],
    [/uber\s*\*?\s*trip|uber\*?\s*pending/i, 'Uber'],
    [/lyft/i, 'Lyft'],
    [/grubhub/i, 'GrubHub'],
    [/doordash/i, 'DoorDash'],
    [/instacart/i, 'Instacart'],
    [/chipotle/i, 'Chipotle'],
    [/sweetgreen/i, 'Sweetgreen'],
    [/equinox/i, 'Equinox'],
    [/planet\s*fitness/i, 'Planet Fitness'],
    [/delta\s*air/i, 'Delta Air Lines'],
    [/marriott/i, 'Marriott'],
    [/hilton/i, 'Hilton'],
    [/airbnb/i, 'Airbnb'],
    [/apple\s*store/i, 'Apple Store'],
    [/apple\.com/i, 'Apple.com'],
    [/at&t|att\*/i, 'AT&T'],
    [/pg&e/i, 'PG&E'],
    [/comcast/i, 'Comcast'],
    [/tesco/i, 'Tesco'],
    [/sainsbury/i, 'Sainsbury\'s'],
    [/deliveroo/i, 'Deliveroo'],
    [/pret\s*a\s*manger/i, 'Pret A Manger'],
    [/costa\s*coffee/i, 'Costa Coffee'],
    [/notion/i, 'Notion'],
    [/zoom/i, 'Zoom'],
    [/anthropic/i, 'Anthropic API'],
  ]

  for (const [pattern, name] of MERCHANT_MAP) {
    if (pattern.test(s)) return name
  }

  // Trim long descriptions
  return s.length > 28 ? s.substring(0, 28) + '…' : s
}

/** Normalize income source description to a clean label */
function normalizeSource(description: string): string {
  const s = description.toUpperCase()
  if (/payroll|salary|direct.dep|employer|ach.credit/i.test(s)) return 'Salary'
  if (/interest/i.test(s)) return 'Interest'
  if (/dividend/i.test(s)) return 'Dividends'
  if (/zelle|venmo|cashapp|paypal/i.test(s)) return 'Peer Transfer'
  if (/refund|return/i.test(s)) return 'Refunds'
  // Truncate long descriptions
  return description.length > 30 ? description.substring(0, 30) + '…' : description
}
