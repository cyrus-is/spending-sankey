import type { Transaction } from '../lib/types'
import { CATEGORIES } from '../lib/types'

interface TransactionTableProps {
  transactions: Transaction[]
  overrides: Record<string, string>
  onOverride: (id: string, category: string) => void
}

export function TransactionTable({ transactions, overrides, onOverride }: TransactionTableProps) {
  if (transactions.length === 0) return null

  const sorted = [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <div className="tx-table-wrap">
      <div className="tx-table-header">
        <h2>Transactions</h2>
        <span className="tx-table-count">{transactions.length} transactions</span>
      </div>
      <div className="tx-table-scroll">
        <table className="tx-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Type</th>
              <th>Category</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((tx) => {
              const cat = overrides[tx.id] ?? tx.category
              return (
                <tr key={tx.id} className={tx.type === 'credit' ? 'tx-row--credit' : ''}>
                  <td className="tx-date">{tx.date.toLocaleDateString()}</td>
                  <td className="tx-desc">{tx.description}</td>
                  <td className={`tx-amount tx-amount--${tx.type}`}>
                    {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
                  </td>
                  <td>{tx.type}</td>
                  <td>
                    <select
                      value={cat}
                      onChange={(e) => onOverride(tx.id, e.target.value)}
                      className="tx-category-select"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    {tx.subcategory && <span className="tx-subcategory"> · {tx.subcategory}</span>}
                  </td>
                  <td className="tx-source">{tx.sourceFile}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
