import { useCallback, useEffect, useMemo, useState } from 'react'
import { DropZone } from './components/DropZone'
import { RawTable } from './components/RawTable'
import { ApiKeyEntry } from './components/ApiKeyEntry'
import { SankeyChart } from './components/SankeyChart'
import { TransactionTable } from './components/TransactionTable'
import { DateFilter } from './components/DateFilter'
import type { DateRange } from './components/DateFilter'
import { getStoredApiKey, storeApiKey } from './lib/apiKey'
import { readCsvFile } from './lib/readCsv'
import { detectFormat, parseTransactions } from './lib/parser'
import { categorizeTransactions } from './lib/categorize'
import { buildSankeyData } from './lib/sankey'
import { detectTransfers } from './lib/transfers'
import type { LoadedFile, Transaction } from './lib/types'

let fileCounter = 0

type AppState = 'idle' | 'categorizing' | 'done'

function toDateStr(d: Date): string {
  return d.toISOString().substring(0, 10)
}

export function App() {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string>(() => getStoredApiKey())
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [appState, setAppState] = useState<AppState>('idle')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>({ start: '', end: '' })

  // All transactions across all files
  const allTransactions: Transaction[] = files.flatMap((f) => f.transactions)

  // Date bounds
  const { minDate, maxDate } = useMemo(() => {
    if (allTransactions.length === 0) return { minDate: '', maxDate: '' }
    const dates = allTransactions.map((tx) => tx.date.getTime())
    return {
      minDate: toDateStr(new Date(Math.min(...dates))),
      maxDate: toDateStr(new Date(Math.max(...dates))),
    }
  }, [allTransactions])

  // Initialize date range to all data when first transactions load
  useEffect(() => {
    if (minDate && maxDate && !dateRange.start) {
      setDateRange({ start: minDate, end: maxDate })
    }
  }, [minDate, maxDate, dateRange.start])

  // Filtered transactions based on date range
  const filteredTransactions = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return allTransactions
    const start = new Date(dateRange.start).getTime()
    const end = new Date(dateRange.end + 'T23:59:59').getTime()
    return allTransactions.filter(
      (tx) => tx.date.getTime() >= start && tx.date.getTime() <= end,
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTransactions.length, overrides, dateRange])

  // Check for categorized transactions (any with non-default category from Claude)
  const hasCategorized = allTransactions.some((tx) => tx.subcategory !== '')

  const handleApiKey = useCallback((key: string) => {
    setApiKey(key)
    storeApiKey(key)
  }, [])

  const handleFiles = useCallback(async (newFiles: File[]) => {
    setError(null)
    try {
      const loaded = await Promise.all(
        newFiles.map(async (f): Promise<LoadedFile> => {
          const { headers, rows } = await readCsvFile(f)
          let transactions: Transaction[] = []
          try {
            const mapping = detectFormat(headers, rows)
            transactions = parseTransactions(f.name, rows, mapping)
          } catch {
            // format detection failed — show raw table, will use Claude for detection
          }
          return {
            id: `file-${++fileCounter}`,
            name: f.name,
            rawHeaders: headers,
            rawRows: rows,
            transactions,
          }
        }),
      )
      setFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name))
        const fresh = loaded.filter((f) => !existingNames.has(f.name))
        const next = [...prev, ...fresh]

        // Run transfer detection across all loaded files
        const allTx = next.flatMap((f) => f.transactions)
        const transferIds = detectTransfers(allTx)
        if (transferIds.size === 0) return next

        return next.map((file) => ({
          ...file,
          transactions: file.transactions.map((tx) =>
            transferIds.has(tx.id) ? { ...tx, category: 'Transfer' } : tx,
          ),
        }))
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read file')
    }
  }, [])

  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const handleOverride = useCallback((id: string, category: string) => {
    setOverrides((prev) => ({ ...prev, [id]: category }))
  }, [])

  const handleCategorize = useCallback(async () => {
    if (!apiKey || allTransactions.length === 0) return
    setError(null)
    setAppState('categorizing')
    setProgress({ done: 0, total: allTransactions.length })

    try {
      const results = await categorizeTransactions(
        allTransactions,
        apiKey,
        (done, total) => setProgress({ done, total }),
      )

      const resultMap = new Map(results.map((r) => [r.id, r]))

      setFiles((prev) =>
        prev.map((file) => ({
          ...file,
          transactions: file.transactions.map((tx) => {
            const result = resultMap.get(tx.id)
            if (!result) return tx
            return { ...tx, category: result.category, subcategory: result.subcategory }
          }),
        })),
      )
      setAppState('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Categorization failed')
      setAppState('idle')
    } finally {
      setProgress(null)
    }
  }, [apiKey, allTransactions])

  // Reset to idle when files change
  useEffect(() => {
    if (appState === 'done') setAppState('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length])

  const showCategorizeBtn =
    allTransactions.length > 0 && apiKey && !hasCategorized && appState !== 'categorizing'

  const sankeyData = useMemo(
    () => (hasCategorized ? buildSankeyData(filteredTransactions, overrides) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasCategorized, filteredTransactions.length, overrides, dateRange],
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>Spending Sankey</h1>
        <p className="tagline">Drag-drop your bank CSVs, see where your money goes.</p>
      </header>

      <main className="app-main">
        <ApiKeyEntry onKey={handleApiKey} hasKey={!!apiKey} />

        <DropZone onFiles={handleFiles} disabled={appState === 'categorizing'} />

        {error && <div className="error-banner">{error}</div>}

        {allTransactions.length > 0 && (
          <div className="file-summary">
            <span>{files.length} file{files.length !== 1 ? 's' : ''} loaded</span>
            <span className="file-summary__sep">·</span>
            <span>{allTransactions.length} transactions total</span>
            {hasCategorized && filteredTransactions.length !== allTransactions.length && (
              <>
                <span className="file-summary__sep">·</span>
                <span>{filteredTransactions.length} in range</span>
              </>
            )}
          </div>
        )}

        {showCategorizeBtn && (
          <button className="categorize-btn" onClick={handleCategorize}>
            Categorize with Claude ({allTransactions.length} transactions)
          </button>
        )}

        {appState === 'categorizing' && progress && (
          <div className="progress-bar-wrap">
            <div
              className="progress-bar"
              style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
            />
            <span className="progress-label">
              Categorizing… {progress.done}/{progress.total}
            </span>
          </div>
        )}

        {hasCategorized && minDate && (
          <DateFilter
            range={dateRange}
            minDate={minDate}
            maxDate={maxDate}
            onChange={setDateRange}
          />
        )}

        {sankeyData && <SankeyChart data={sankeyData} />}

        {hasCategorized ? (
          <TransactionTable
            transactions={filteredTransactions}
            overrides={overrides}
            onOverride={handleOverride}
          />
        ) : (
          <RawTable files={files} onRemove={handleRemove} />
        )}
      </main>
    </div>
  )
}
