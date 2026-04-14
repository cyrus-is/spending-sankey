import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DropZone } from './components/DropZone'
import { RawTable } from './components/RawTable'
import { ApiKeyEntry } from './components/ApiKeyEntry'
import { SankeyChart } from './components/SankeyChart'
import { TransactionTable } from './components/TransactionTable'
import { DateFilter } from './components/DateFilter'
import type { DateRange } from './components/DateFilter'
import { LensSwitcher } from './components/LensSwitcher'
import type { LensId, TaxResult, TaxArea } from './lib/lenses/types'
import { ESSENTIALS_BUCKETS, TAX_AREAS } from './lib/lenses/types'
import { mapToEssentialsBucket } from './lib/lenses/essentials'
import { taxCategorize } from './lib/lenses/tax-us'
import { TaxFlagPanel } from './components/TaxFlagPanel'
import { exportTaxCSV } from './lib/lenses/export'
import { getStoredApiKey, storeApiKey } from './lib/apiKey'
import { readCsvFile } from './lib/readCsv'
import { detectFormat, parseTransactions } from './lib/parser'
import { categorizeTransactions } from './lib/categorize'
import { buildSankeyData } from './lib/sankey'
import { detectTransfers } from './lib/transfers'
import type { LoadedFile } from './lib/types'

let fileCounter = 0

type AppState = 'idle' | 'loading' | 'categorizing' | 'done'

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
  const [mergeThreshold, setMergeThreshold] = useState(0.02)
  const [activeLens, setActiveLens] = useState<LensId>('spending')
  const [taxResults, setTaxResults] = useState<TaxResult[] | null>(null)
  const [taxProgress, setTaxProgress] = useState<{ done: number; total: number } | null>(null)
  const [taxOverrides, setTaxOverrides] = useState<Record<string, TaxArea>>({})
  const abortRef = useRef<AbortController | null>(null)

  // All transactions across all files — memoized so downstream memos get a stable reference
  // that updates whenever files (or their transaction categories) change
  const allTransactions = useMemo(
    () => files.flatMap((f) => f.transactions),
    [files],
  )

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
  }, [allTransactions, overrides, dateRange])

  // Check for categorized transactions (any with non-default category from Claude)
  const hasCategorized = allTransactions.some((tx) => tx.subcategory !== '')

  // Files where format detection failed (no transactions parsed)
  const parseFailedFiles = files.filter((f) => (f.rawRows?.length ?? 0) > 0 && f.transactions.length === 0)

  const handleApiKey = useCallback((key: string) => {
    setApiKey(key)
    storeApiKey(key)
  }, [])

  const handleFiles = useCallback(async (newFiles: File[]) => {
    setError(null)
    setAppState('loading')
    try {
      const loaded = await Promise.all(
        newFiles.map(async (f): Promise<LoadedFile> => {
          const { headers, rows } = await readCsvFile(f)
          try {
            const mapping = detectFormat(headers, rows)
            const transactions = parseTransactions(f.name, rows, mapping)
            // Parse succeeded — drop rawRows to free memory
            return {
              id: `file-${++fileCounter}`,
              name: f.name,
              rawHeaders: headers,
              transactions,
            }
          } catch {
            // Format detection failed — keep rawRows so RawTable can show them
            return {
              id: `file-${++fileCounter}`,
              name: f.name,
              rawHeaders: headers,
              rawRows: rows,
              transactions: [],
            }
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
    } finally {
      setAppState('idle')
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

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const results = await categorizeTransactions(
        allTransactions,
        apiKey,
        (done, total) => setProgress({ done, total }),
        controller.signal,
      )

      // All batches succeeded — apply atomically
      const resultMap = new Map(results.map((r) => [r.id, r]))

      setFiles((prev) =>
        prev.map((file) => ({
          ...file,
          transactions: file.transactions.map((tx) => {
            // Never overwrite transfer-detection results — those are authoritative
            if (tx.category === 'Transfer') return tx
            const result = resultMap.get(tx.id)
            if (!result) return tx
            return { ...tx, category: result.category, subcategory: result.subcategory }
          }),
        })),
      )
      setAppState('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Categorization failed'
      // Don't show "cancelled" as an error — it was intentional
      if (!controller.signal.aborted) {
        setError(msg)
      }
      setAppState('idle')
    } finally {
      setProgress(null)
      abortRef.current = null
    }
  }, [apiKey, allTransactions])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleLensChange = useCallback(async (lens: LensId) => {
    setActiveLens(lens)
    if (lens === 'tax-us' && !taxResults && apiKey && allTransactions.length > 0) {
      setError(null)
      setAppState('categorizing')
      setTaxProgress({ done: 0, total: allTransactions.length })
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const results = await taxCategorize(
          allTransactions,
          apiKey,
          (done, total) => setTaxProgress({ done, total }),
          controller.signal,
        )
        setTaxResults(results)
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Tax categorization failed')
        }
        setActiveLens('spending')
      } finally {
        setTaxProgress(null)
        setAppState('done')
        abortRef.current = null
      }
    }
  }, [taxResults, apiKey, allTransactions])

  // Reset to idle when files change
  useEffect(() => {
    if (appState === 'done') setAppState('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length])

  const showCategorizeBtn =
    allTransactions.length > 0 && apiKey && !hasCategorized && appState !== 'categorizing'

  const handleTaxOverride = useCallback((id: string, taxArea: TaxArea) => {
    setTaxOverrides((prev) => ({ ...prev, [id]: taxArea }))
  }, [])

  // Essentials lens: remap each tx's spending category to a bucket name
  const essentialsOverrides = useMemo(() => {
    if (activeLens !== 'essentials') return {}
    const result: Record<string, string> = {}
    for (const tx of filteredTransactions) {
      const spendingCategory = overrides[tx.id] ?? tx.category
      result[tx.id] = mapToEssentialsBucket(spendingCategory)
    }
    return result
  }, [activeLens, filteredTransactions, overrides])

  // Essentials bucket → color map (passed as extraNodeColors)
  const essentialsColors = useMemo(
    () => Object.fromEntries(ESSENTIALS_BUCKETS.map((b) => [b.id, b.color])),
    [],
  )

  // Tax area → color map
  const taxColors = useMemo(
    () => Object.fromEntries(TAX_AREAS.map((a) => [a.id, a.color])),
    [],
  )

  // Tax category map: tx.id → taxArea (API result + manual overrides)
  const taxCategoryMap = useMemo(() => {
    if (activeLens !== 'tax-us' || !taxResults) return {}
    const resultMap = new Map(taxResults.map((r) => [r.id, r]))
    const result: Record<string, string> = {}
    for (const tx of filteredTransactions) {
      // Manual override takes precedence over API result
      if (taxOverrides[tx.id]) {
        result[tx.id] = taxOverrides[tx.id]
      } else {
        const taxResult = resultMap.get(tx.id)
        if (taxResult) result[tx.id] = taxResult.taxArea
      }
    }
    return result
  }, [activeLens, taxResults, taxOverrides, filteredTransactions])

  const sankeyData = useMemo(() => {
    if (!hasCategorized) return null
    if (activeLens === 'essentials') {
      return buildSankeyData(filteredTransactions, essentialsOverrides, mergeThreshold, essentialsColors)
    }
    if (activeLens === 'tax-us' && taxResults) {
      const data = buildSankeyData(filteredTransactions, taxCategoryMap, mergeThreshold, taxColors)
      // Compute deductible vs non-deductible totals for the header
      const deductibleIds = new Set(['schedule-a', 'schedule-c', 'form-2441', 'hsa-medical'])
      let totalDeductible = 0
      let totalNonDeductible = 0
      for (const node of data.nodes) {
        if (node.id.startsWith('cat:')) {
          const area = node.id.slice(4)
          if (deductibleIds.has(area)) totalDeductible += node.value
          else if (area === 'non-deductible') totalNonDeductible += node.value
        }
      }
      return { ...data, totalDeductible, totalNonDeductible }
    }
    return buildSankeyData(filteredTransactions, overrides, mergeThreshold)
  }, [hasCategorized, activeLens, filteredTransactions, overrides, essentialsOverrides, essentialsColors, taxResults, taxCategoryMap, taxColors, mergeThreshold])

  const sankeyIsEmpty = sankeyData !== null && sankeyData.nodes.length <= 1

  return (
    <div className="app">
      <header className="app-header">
        <h1>Spending Sankey</h1>
        <p className="tagline">Drag-drop your bank CSVs, see where your money goes.</p>
      </header>

      <main className="app-main">
        <ApiKeyEntry onKey={handleApiKey} hasKey={!!apiKey} />

        <DropZone onFiles={handleFiles} disabled={appState === 'categorizing' || appState === 'loading'} />

        {appState === 'loading' && (
          <div className="loading-state">
            <span className="loading-spinner" />
            Reading files…
          </div>
        )}

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button className="error-banner__dismiss" onClick={() => setError(null)} aria-label="Dismiss">✕</button>
          </div>
        )}

        {parseFailedFiles.length > 0 && (
          <div className="warn-banner">
            <strong>Format detection failed</strong> for: {parseFailedFiles.map((f) => f.name).join(', ')}.
            {apiKey
              ? ' Categorize with Claude above to parse these files.'
              : ' Add a Claude API key above to auto-detect the format.'}
          </div>
        )}

        {allTransactions.length > 0 && (
          <div className="file-summary">
            <span>{files.length} file{files.length !== 1 ? 's' : ''} loaded</span>
            <span className="file-summary__sep">·</span>
            <span>{allTransactions.length} transactions</span>
            {hasCategorized && filteredTransactions.length !== allTransactions.length && (
              <>
                <span className="file-summary__sep">·</span>
                <span>{filteredTransactions.length} in range</span>
              </>
            )}
          </div>
        )}

        {showCategorizeBtn && (
          <div className="categorize-wrap">
            <button className="categorize-btn" onClick={handleCategorize}>
              Categorize with Claude
            </button>
            <p className="categorize-hint">
              Sends merchant names to Claude API to classify {allTransactions.length} transactions into spending categories.
              Amounts are never sent.
            </p>
          </div>
        )}

        {!apiKey && allTransactions.length > 0 && !hasCategorized && (
          <div className="warn-banner">
            No API key set. Add your Claude API key above to categorize transactions and see the Sankey diagram.
          </div>
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
            <button className="progress-cancel" onClick={handleCancel} aria-label="Cancel categorization">
              Cancel
            </button>
          </div>
        )}

        {appState === 'categorizing' && taxProgress && (
          <div className="progress-bar-wrap">
            <div
              className="progress-bar progress-bar--tax"
              style={{ width: `${Math.round((taxProgress.done / taxProgress.total) * 100)}%` }}
            />
            <span className="progress-label">
              Tax analysis… {taxProgress.done}/{taxProgress.total}
            </span>
            <button className="progress-cancel" onClick={handleCancel} aria-label="Cancel tax categorization">
              Cancel
            </button>
          </div>
        )}

        {hasCategorized && (
          <LensSwitcher
            active={activeLens}
            onChange={handleLensChange}
            taxReady={hasCategorized}
          />
        )}

        {hasCategorized && minDate && (
          <DateFilter
            range={dateRange}
            minDate={minDate}
            maxDate={maxDate}
            onChange={setDateRange}
          />
        )}

        {activeLens === 'tax-us' && appState === 'categorizing' && taxProgress && (
          <div className="lens-loading-state">
            <span className="loading-spinner" />
            Analyzing {taxProgress.total} transactions for tax areas…
          </div>
        )}

        {activeLens === 'tax-us' && !taxResults && appState !== 'categorizing' && hasCategorized && (
          <div className="empty-state">
            <p>Tax analysis failed. Check your API key and try again.</p>
          </div>
        )}

        {sankeyIsEmpty ? (
          <div className="empty-state">
            <p>No {activeLens === 'tax-us' ? 'deductible expenses' : 'income or expenses'} to display for this date range.</p>
            <p className="empty-state__hint">
              {activeLens === 'tax-us'
                ? 'Everything in this period was classified as Non-Deductible, or try expanding the date range.'
                : 'Try expanding the date range, or check that transfers aren\'t masking income/expenses.'}
            </p>
          </div>
        ) : (
          sankeyData && (
            <SankeyChart
              data={sankeyData}
              mergeThreshold={mergeThreshold}
              onMergeThresholdChange={setMergeThreshold}
            />
          )
        )}

        {activeLens === 'tax-us' && taxResults && (
          <>
            <div className="tax-export-wrap">
              <button
                className="tax-export-btn"
                onClick={() => exportTaxCSV(filteredTransactions, taxResults, taxOverrides)}
              >
                Export for CPA
              </button>
              <span className="tax-export-hint">
                CSV sorted by tax area — share with your accountant
              </span>
            </div>
            <TaxFlagPanel
              transactions={filteredTransactions}
              taxResults={taxResults}
              taxOverrides={taxOverrides}
              onOverride={handleTaxOverride}
            />
          </>
        )}

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
