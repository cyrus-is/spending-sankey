import type { Transaction } from './types'

export interface SankeyNode {
  id: string
  label: string
  value: number
  color: string
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
  Food: '#f6ad55',
  Transport: '#76e4f7',
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
): SankeyData {
  // Apply overrides
  const txns = transactions.map((tx) => ({
    ...tx,
    category: overrides[tx.id] ?? tx.category,
  }))

  // Filter out transfers
  const nonTransfer = txns.filter((tx) => tx.category !== 'Transfer')

  // Separate income and expenses
  const incomeTransactions = nonTransfer.filter((tx) => tx.type === 'credit')
  const expenseTransactions = nonTransfer.filter((tx) => tx.type === 'debit')

  const totalIncome = incomeTransactions.reduce((s, tx) => s + tx.amount, 0)
  const totalExpenses = expenseTransactions.reduce((s, tx) => s + tx.amount, 0)

  // Group income by description (source), merge small ones into "Other Income"
  const incomeBySource = new Map<string, number>()
  for (const tx of incomeTransactions) {
    const source = normalizeSource(tx.description)
    incomeBySource.set(source, (incomeBySource.get(source) ?? 0) + tx.amount)
  }

  // Merge income sources < 5% of total into "Other Income"
  const threshold = totalIncome * 0.05
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

  // Group expenses by category
  const expenseByCategory = new Map<string, number>()
  for (const tx of expenseTransactions) {
    expenseByCategory.set(tx.category, (expenseByCategory.get(tx.category) ?? 0) + tx.amount)
  }

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

  // Expense category nodes (right side)
  for (const [category, amount] of expenseByCategory) {
    const nodeId = `cat:${category}`
    nodes.push({
      id: nodeId,
      label: category,
      value: amount,
      color: CATEGORY_COLORS[category] ?? '#a0aec0',
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
