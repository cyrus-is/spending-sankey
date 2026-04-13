import { useCallback, useState } from 'react'
import { DropZone } from './components/DropZone'
import { RawTable } from './components/RawTable'
import { readCsvFile } from './lib/readCsv'
import { detectFormat, parseTransactions } from './lib/parser'
import type { LoadedFile } from './lib/types'

let fileCounter = 0

export function App() {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleFiles = useCallback(async (newFiles: File[]) => {
    setError(null)
    try {
      const loaded = await Promise.all(
        newFiles.map(async (f): Promise<LoadedFile> => {
          const { headers, rows } = await readCsvFile(f)
          let transactions: import('./lib/types').Transaction[] = []
          try {
            const mapping = detectFormat(headers, rows)
            transactions = parseTransactions(f.name, rows, mapping)
          } catch {
            // format detection failed — show raw table, user can still see data
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
        // Deduplicate by filename
        const existingNames = new Set(prev.map((f) => f.name))
        const fresh = loaded.filter((f) => !existingNames.has(f.name))
        return [...prev, ...fresh]
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read file')
    }
  }, [])

  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Spending Sankey</h1>
        <p className="tagline">Drag-drop your bank CSVs, see where your money goes.</p>
      </header>
      <main className="app-main">
        <DropZone onFiles={handleFiles} />
        {error && <div className="error-banner">{error}</div>}
        <RawTable files={files} onRemove={handleRemove} />
      </main>
    </div>
  )
}
