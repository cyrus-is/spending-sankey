import type { BudgetComparisonResult } from '../lib/budget-types'

interface BudgetComparisonTableProps {
  result: BudgetComparisonResult
}

export function BudgetComparisonTable({ result }: BudgetComparisonTableProps) {
  const incomeLines = result.lines.filter((l) => l.section === 'income')
  const expenseLines = result.lines.filter((l) => l.section === 'expenses')

  function formatDiff(diff: number): string {
    const sign = diff > 0 ? '+' : ''
    return `${sign}$${Math.abs(diff).toFixed(2)}`
  }

  function diffClass(diff: number): string {
    if (diff === 0) return ''
    return diff > 0 ? 'comparison-diff--good' : 'comparison-diff--bad'
  }

  function percentLabel(pct: number): string {
    if (!isFinite(pct)) return '—'
    return `${pct}%`
  }

  return (
    <div className="comparison-table-wrap">
      <h3 className="budget-section-title">Income vs Budget</h3>
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Budgeted</th>
            <th>Actual</th>
            <th>Difference</th>
            <th>% of Budget</th>
          </tr>
        </thead>
        <tbody>
          {incomeLines.map((line, i) => (
            <tr key={i} className={`comparison-row ${line.actual > line.budgeted ? 'comparison-row--over-income' : ''}`}>
              <td>{line.category}</td>
              <td>${line.budgeted.toFixed(2)}</td>
              <td>${line.actual.toFixed(2)}</td>
              <td className={diffClass(line.difference)}>
                {formatDiff(line.difference)}
              </td>
              <td>{percentLabel(line.percentUsed)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="comparison-total-row">
            <td><strong>Total</strong></td>
            <td><strong>${result.totalBudgetedIncome.toFixed(2)}</strong></td>
            <td><strong>${result.totalActualIncome.toFixed(2)}</strong></td>
            <td className={result.totalActualIncome >= result.totalBudgetedIncome ? 'comparison-diff--good' : 'comparison-diff--bad'}>
              <strong>{result.totalActualIncome >= result.totalBudgetedIncome ? '+' : ''}${(result.totalActualIncome - result.totalBudgetedIncome).toFixed(2)}</strong>
            </td>
            <td />
          </tr>
        </tfoot>
      </table>

      <h3 className="budget-section-title">Expenses vs Budget</h3>
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Budgeted</th>
            <th>Actual</th>
            <th>Difference</th>
            <th>% of Budget</th>
          </tr>
        </thead>
        <tbody>
          {expenseLines.map((line, i) => {
            const overBudget = line.budgeted > 0 && line.actual > line.budgeted
            const noBudget = line.budgeted === 0
            return (
              <tr key={i} className={`comparison-row ${overBudget ? 'comparison-row--over-budget' : ''} ${noBudget ? 'comparison-row--unbudgeted' : ''}`}>
                <td>{line.category}</td>
                <td>{line.budgeted > 0 ? `$${line.budgeted.toFixed(2)}` : '—'}</td>
                <td>${line.actual.toFixed(2)}</td>
                <td className={diffClass(line.difference)}>
                  {line.budgeted > 0 ? formatDiff(line.difference) : '—'}
                </td>
                <td>{line.budgeted > 0 ? percentLabel(line.percentUsed) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="comparison-total-row">
            <td><strong>Total</strong></td>
            <td><strong>${result.totalBudgetedExpenses.toFixed(2)}</strong></td>
            <td><strong>${result.totalActualExpenses.toFixed(2)}</strong></td>
            <td className={result.totalActualExpenses <= result.totalBudgetedExpenses ? 'comparison-diff--good' : 'comparison-diff--bad'}>
              <strong>{result.totalBudgetedExpenses >= result.totalActualExpenses ? '+' : ''}${(result.totalBudgetedExpenses - result.totalActualExpenses).toFixed(2)}</strong>
            </td>
            <td />
          </tr>
        </tfoot>
      </table>

      <div className="comparison-net">
        <div className={`comparison-net-item ${result.netActual >= result.netBudgeted ? 'comparison-net-item--good' : 'comparison-net-item--warn'}`}>
          <span className="comparison-net-label">Actual Net</span>
          <span className="comparison-net-value">{result.netActual >= 0 ? '+' : ''}${result.netActual.toFixed(2)}</span>
        </div>
        <div className="comparison-net-item">
          <span className="comparison-net-label">Budgeted Net</span>
          <span className="comparison-net-value">{result.netBudgeted >= 0 ? '+' : ''}${result.netBudgeted.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
