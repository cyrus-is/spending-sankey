import type { Transaction } from '../lib/types'
import type { TaxResult, TaxArea } from '../lib/lenses/types'
import { TAX_AREAS } from '../lib/lenses/types'

interface TaxFlagPanelProps {
  transactions: Transaction[]
  taxResults: TaxResult[]
  taxOverrides: Record<string, TaxArea>
  onOverride: (id: string, taxArea: TaxArea) => void
}

export function TaxFlagPanel({ transactions, taxResults, taxOverrides, onOverride }: TaxFlagPanelProps) {
  const resultMap = new Map(taxResults.map((r) => [r.id, r]))

  const flagged = transactions.filter((tx) => {
    // Already manually resolved — don't show again
    if (taxOverrides[tx.id]) return false
    const result = resultMap.get(tx.id)
    return result?.ambiguous === true
  })

  if (flagged.length === 0) return null

  return (
    <div className="tax-flag-panel">
      <div className="tax-flag-panel__header">
        <span className="tax-flag-panel__title">
          Flagged transactions
        </span>
        <span className="tax-flag-panel__count">{flagged.length} need review</span>
      </div>
      <p className="tax-flag-panel__hint">
        These transactions could belong to multiple tax areas. Pick the right one for your situation.
      </p>
      <ul className="tax-flag-panel__list">
        {flagged.map((tx) => {
          const suggestion = resultMap.get(tx.id)?.taxArea ?? 'non-deductible'
          return (
            <li key={tx.id} className="tax-flag-item">
              <div className="tax-flag-item__info">
                <span className="tax-flag-item__desc">{tx.description}</span>
                <span className="tax-flag-item__amount">
                  ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="tax-flag-item__select-wrap">
                <select
                  className="tax-flag-item__select"
                  defaultValue={suggestion}
                  onChange={(e) => onOverride(tx.id, e.target.value as TaxArea)}
                  aria-label={`Tax area for ${tx.description}`}
                >
                  {TAX_AREAS.map((area) => (
                    <option key={area.id} value={area.id}>{area.label}</option>
                  ))}
                </select>
                <button
                  className="tax-flag-item__resolve"
                  onClick={() => onOverride(tx.id, suggestion)}
                  title="Accept suggestion"
                >
                  ✓
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
