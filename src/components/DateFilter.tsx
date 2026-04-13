import type { ChangeEvent } from 'react'

export interface DateRange {
  start: string  // YYYY-MM-DD
  end: string    // YYYY-MM-DD
}

interface DateFilterProps {
  range: DateRange
  minDate: string
  maxDate: string
  onChange: (range: DateRange) => void
}

export function DateFilter({ range, minDate, maxDate, onChange }: DateFilterProps) {
  const handleStart = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...range, start: e.target.value })
  }

  const handleEnd = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...range, end: e.target.value })
  }

  const setThisMonth = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
    onChange({
      start: `${y}-${m}-01`,
      end: `${y}-${m}-${lastDay}`,
    })
  }

  const setLast3Months = () => {
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - 3)
    onChange({
      start: start.toISOString().substring(0, 10),
      end: end.toISOString().substring(0, 10),
    })
  }

  const setAll = () => {
    onChange({ start: minDate, end: maxDate })
  }

  return (
    <div className="date-filter">
      <div className="date-filter__inputs">
        <label>
          <span className="date-filter__label">From</span>
          <input
            type="date"
            value={range.start}
            min={minDate}
            max={range.end || maxDate}
            onChange={handleStart}
            className="date-filter__input"
          />
        </label>
        <span className="date-filter__sep">–</span>
        <label>
          <span className="date-filter__label">To</span>
          <input
            type="date"
            value={range.end}
            min={range.start || minDate}
            max={maxDate}
            onChange={handleEnd}
            className="date-filter__input"
          />
        </label>
      </div>
      <div className="date-filter__shortcuts">
        <button className="date-filter__btn" onClick={setThisMonth}>This month</button>
        <button className="date-filter__btn" onClick={setLast3Months}>Last 3 months</button>
        <button className="date-filter__btn" onClick={setAll}>All time</button>
      </div>
    </div>
  )
}
