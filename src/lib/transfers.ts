import type { Transaction } from './types'

/** Match transactions that are likely transfers between own accounts.
 * Strategy:
 * 1. Flag by specific transfer-service keywords only (not generic "transfer" or "payment")
 * 2. For multi-file uploads, match debit+credit pairs with same amount ± 1% within 3 days
 *
 * Intentionally NOT matching: "transfer", "payment to/from", "autopay", "bill pay" — these
 * are too broad and flag real expenses (e.g. "PAYMENT TO DENTIST", "AUTOPAY INSURANCE").
 */
export function detectTransfers(transactions: Transaction[]): Set<string> {
  const transferIds = new Set<string>()

  // Phase 1: unambiguous transfer-service keywords only
  const TRANSFER_PATTERNS = [
    /\bzelle\b/i,
    /\bvenmo\b/i,
    /cashapp|cash\s+app/i,
    /\bpaypal\s+transfer/i,       // "PayPal Transfer" — not "PayPal *MERCHANT"
    /online\s+transfer/i,
    /account\s+transfer/i,
    /internal\s+transfer/i,
    /ach\s+transfer/i,
    /wire\s+transfer/i,
    /funds\s+transfer/i,
    /transfer\s+(from|to)\b/i,    // "Transfer from Checking", "Transfer to Savings"
    /\bxfer\b/i,
  ]

  for (const tx of transactions) {
    if (TRANSFER_PATTERNS.some((p) => p.test(tx.description))) {
      transferIds.add(tx.id)
    }
  }

  // Phase 2: amount matching across files (same amount ± 1%, within 3 days, different files)
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
