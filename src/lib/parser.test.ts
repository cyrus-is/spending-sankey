import { describe, it, expect } from 'vitest'
import { detectFormat, parseDate, parseTransactions } from './parser'

// ─── detectFormat ────────────────────────────────────────────────────────────

describe('detectFormat', () => {
  it('detects Chase-style headers', () => {
    const headers = ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount', 'Memo']
    const mapping = detectFormat(headers, [])
    expect(mapping.date).toBe('Transaction Date')
    expect(mapping.description).toBe('Description')
    expect(mapping.amount).toBe('Amount')
  })

  it('detects BofA debit/credit columns', () => {
    const headers = ['Date', 'Description', 'Amount', 'Running Bal.']
    const mapping = detectFormat(headers, [])
    expect(mapping.date).toBe('Date')
    expect(mapping.description).toBe('Description')
    expect(mapping.amount).toBe('Amount')
  })

  it('detects separate Debit/Credit columns (credit union style)', () => {
    const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance']
    const mapping = detectFormat(headers, [])
    expect(mapping.date).toBe('Date')
    expect(mapping.description).toBe('Description')
    expect(mapping.debit).toBe('Debit')
    expect(mapping.credit).toBe('Credit')
  })

  it('detects Amex-style (Transaction Date, Description, Amount)', () => {
    const headers = ['Date', 'Reference', 'Amount', 'Extended Details', 'Appears On Your Statement As', 'Address', 'City/State', 'Zip Code', 'Country', 'Reference', 'Category']
    const mapping = detectFormat(headers, [])
    expect(mapping.date).toBe('Date')
    expect(mapping.amount).toBe('Amount')
  })

  it('throws when no date column found', () => {
    const headers = ['Foo', 'Bar', 'Amount']
    expect(() => detectFormat(headers, [])).toThrow('date column')
  })

  it('throws when no description column found', () => {
    const headers = ['Date', 'Amount']
    expect(() => detectFormat(headers, [])).toThrow('description column')
  })
})

// ─── parseDate ───────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('parses ISO format', () => {
    const d = parseDate('2024-03-15')
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(2) // March = 2
    expect(d.getDate()).toBe(15)
  })

  it('parses MM/DD/YYYY', () => {
    const d = parseDate('03/15/2024')
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(2)
    expect(d.getDate()).toBe(15)
  })

  it('parses MM/DD/YY', () => {
    const d = parseDate('03/15/24')
    expect(d.getFullYear()).toBe(2024)
  })

  it('parses natural date string', () => {
    const d = parseDate('Mar 15, 2024')
    expect(d.getFullYear()).toBe(2024)
  })

  it('throws on unparseable date', () => {
    expect(() => parseDate('not-a-date')).toThrow()
  })
})

// ─── parseTransactions ───────────────────────────────────────────────────────

describe('parseTransactions', () => {
  it('parses Chase-style transactions', () => {
    const rows = [
      { 'Transaction Date': '01/15/2024', Description: 'AMAZON.COM*2K7', Amount: '42.99', Type: 'Sale' },
      { 'Transaction Date': '01/14/2024', Description: 'DIRECT DEPOSIT EMPLOYER', Amount: '-3500.00', Type: 'Payment' },
    ]
    const mapping = detectFormat(
      ['Transaction Date', 'Description', 'Amount', 'Type'],
      rows,
    )
    const txns = parseTransactions('chase.csv', rows, mapping)
    expect(txns).toHaveLength(2)
    expect(txns[0].description).toBe('AMAZON.COM*2K7')
    expect(txns[0].amount).toBe(42.99)
    expect(txns[0].type).toBe('debit')
    // Negative amount in Chase = credit (payment)
    expect(txns[1].type).toBe('credit')
    expect(txns[1].amount).toBe(3500)
  })

  it('parses separate debit/credit columns', () => {
    const rows = [
      { Date: '2024-01-15', Description: 'Grocery Store', Debit: '87.54', Credit: '' },
      { Date: '2024-01-10', Description: 'Payroll', Debit: '', Credit: '2500.00' },
    ]
    const mapping = detectFormat(
      ['Date', 'Description', 'Debit', 'Credit'],
      rows,
    )
    const txns = parseTransactions('credit-union.csv', rows, mapping)
    expect(txns).toHaveLength(2)
    expect(txns[0].type).toBe('debit')
    expect(txns[0].amount).toBe(87.54)
    expect(txns[1].type).toBe('credit')
    expect(txns[1].amount).toBe(2500)
  })

  it('skips rows with missing date or description', () => {
    const rows = [
      { Date: '', Description: 'Valid', Amount: '10.00' },
      { Date: '2024-01-01', Description: '', Amount: '10.00' },
      { Date: '2024-01-01', Description: 'Valid', Amount: '10.00' },
    ]
    const mapping = detectFormat(['Date', 'Description', 'Amount'], rows)
    const txns = parseTransactions('test.csv', rows, mapping)
    expect(txns).toHaveLength(1)
  })

  it('handles amount with currency symbols and commas', () => {
    const rows = [
      { Date: '2024-01-01', Description: 'Rent', Amount: '$1,500.00' },
    ]
    const mapping = detectFormat(['Date', 'Description', 'Amount'], rows)
    const txns = parseTransactions('test.csv', rows, mapping)
    expect(txns[0].amount).toBe(1500)
  })

  it('handles parenthetical negative amounts', () => {
    const rows = [
      { Date: '2024-01-01', Description: 'Refund', Amount: '(25.00)' },
    ]
    const mapping = detectFormat(['Date', 'Description', 'Amount'], rows)
    const txns = parseTransactions('test.csv', rows, mapping)
    expect(txns[0].amount).toBe(25)
    expect(txns[0].type).toBe('credit')
  })
})
