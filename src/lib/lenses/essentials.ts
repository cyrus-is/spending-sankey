import type { Category } from '../types'
import type { EssentialsBucket } from './types'

const BUCKET_MAP: Record<Category, EssentialsBucket> = {
  Housing:       'fixed-essential',
  Subscriptions: 'fixed-essential',
  Health:        'fixed-essential',
  Groceries:     'variable-essential',
  Transport:     'variable-essential',
  Dining:        'discretionary',
  Entertainment: 'discretionary',
  Shopping:      'discretionary',
  Travel:        'discretionary',
  Other:         'discretionary',
  // Non-expense categories — should not appear on expense side but map safely
  Income:        'discretionary',
  Transfer:      'discretionary',
}

export function mapToEssentialsBucket(category: string): EssentialsBucket {
  return BUCKET_MAP[category as Category] ?? 'discretionary'
}
