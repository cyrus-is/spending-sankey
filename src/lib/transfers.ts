import type { Transaction } from './types'

/** Match transactions that are likely transfers between own accounts.
 * Strategy:
 * 1. Flag by description keywords (Zelle, Venmo, Transfer, etc.)
 * 2. For multi-file uploads, match debit+credit pairs with same amount ± 1% within 3 days
 */
export function detectTransfers(transactions: Transaction[]): Set<string> {
  const transferIds = new Set<string>()

  // Phase 1: keyword detection
  const TRANSFER_PATTERNS = [
    /transfer/i,
    /zelle/i,
    /venmo/i,
    /cashapp|cash app/i,
    /paypal/i,
    /payment to/i,
    /payment from/i,
    /online transfer/i,
    /account transfer/i,
    /internal transfer/i,
    /ach transfer/i,
    /wire transfer/i,
    /autopay/i,
    /bill pay/i,
  ]

  for (const tx of transactions) {
    if (TRANSFER_PATTERNS.some((p) => p.test(tx.description))) {
      transferIds.add(tx.id)
    }
  }

  // Phase 2: amount matching across files (same amount ± 1%, within 3 days, different files)
  // Only run if we have transactions from multiple source files
  const sourceFiles = new Set(transactions.map((tx) => tx.sourceFile))
  if (sourceFiles.size > 1) {
    const debits = transactions.filter((tx) => tx.type === 'debit' && !transferIds.has(tx.id))
    const credits = transactions.filter((tx) => tx.type === 'credit' && !transferIds.has(tx.id))

    for (const debit of debits) {
      for (const credit of credits) {
        if (debit.sourceFile === credit.sourceFile) continue

        const amountDiff = Math.abs(debit.amount - credit.amount) / debit.amount
        const daysDiff = Math.abs(debit.date.getTime() - credit.date.getTime()) / 86400000

        if (amountDiff <= 0.01 && daysDiff <= 3) {
          transferIds.add(debit.id)
          transferIds.add(credit.id)
        }
      }
    }
  }

  return transferIds
}
