import type { Transaction } from './types'

/** Match transactions that are likely transfers between own accounts.
 * Strategy:
 * 1. Flag by specific transfer-service keywords only (not generic "transfer" or "payment")
 * 2. Flag credit card autopay / payment rows by exact bank-issued phrases
 * 3. For multi-file uploads, match debit+credit pairs with same amount ± 1% within 3 days
 *
 * Intentionally NOT matching bare "payment" or "autopay" — too broad and would flag real
 * expenses (e.g. "PAYMENT TO DENTIST", "INSURANCE AUTOPAY"). Only exact bank phrases below.
 */
export function detectTransfers(transactions: Transaction[]): Set<string> {
  const transferIds = new Set<string>()

  // Phase 1: unambiguous transfer-service keywords only
  const TRANSFER_PATTERNS = [
    /\bzelle\b/i,
    /\bvenmo\b/i,
    /cashapp|cash\s+app/i,
    /\bpaypal\s+transfer/i,              // "PayPal Transfer" — not "PayPal *MERCHANT"
    /online\s+transfer/i,
    /account\s+transfer/i,
    /internal\s+transfer/i,
    /ach\s+transfer/i,
    /wire\s+transfer/i,
    /funds\s+transfer/i,
    /transfer\s+(from|to)\b/i,           // "Transfer from Checking", "Transfer to Savings"
    /\bxfer\b/i,
    // Credit card autopay / bill-pay — exact phrases banks use on the card statement side
    /autopay\s+payment/i,                // "AUTOPAY PAYMENT - THANK YOU" (Amex)
    /payment\s+thank\s+you/i,            // "PAYMENT THANK YOU" (BofA, Chase)
    /credit\s+card\s+payment/i,          // generic CC payment line on checking side
    /\bautopay\b.*\bcredit\b/i,          // "AUTOPAY CREDIT" variations
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
