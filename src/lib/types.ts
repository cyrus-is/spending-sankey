/** A single transaction normalized from any bank CSV */
export interface Transaction {
  id: string
  date: Date
  description: string
  amount: number      // positive = expense, negative = income (credit to account)
  type: 'debit' | 'credit'
  category: string
  subcategory: string
  sourceFile: string
}

/** A CSV file that has been loaded and parsed into raw rows */
export interface LoadedFile {
  id: string
  name: string
  rawHeaders: string[]
  /** Present only when format detection failed (shown in RawTable). Dropped after successful parse. */
  rawRows?: Record<string, string>[]
  transactions: Transaction[]
}

export type Category =
  | 'Income'
  | 'Housing'
  | 'Childcare'
  | 'Groceries'
  | 'Dining'
  | 'Transport'
  | 'Travel'
  | 'Shopping'
  | 'Entertainment'
  | 'Health'
  | 'Subscriptions'
  | 'Transfer'
  | 'Other'

export const CATEGORIES: Category[] = [
  'Income',
  'Housing',
  'Childcare',
  'Groceries',
  'Dining',
  'Transport',
  'Travel',
  'Shopping',
  'Entertainment',
  'Health',
  'Subscriptions',
  'Transfer',
  'Other',
]
