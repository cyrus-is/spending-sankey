import type { LoadedFile } from '../lib/types'

interface RawTableProps {
  files: LoadedFile[]
  onRemove: (id: string) => void
}

export function RawTable({ files, onRemove }: RawTableProps) {
  if (files.length === 0) return null

  return (
    <div className="raw-table-section">
      {files.map((file) => (
        <div key={file.id} className="raw-table-card">
          <div className="raw-table-card__header">
            <div>
              <span className="raw-table-card__name">{file.name}</span>
              <span className="raw-table-card__count">{file.rawRows.length} rows</span>
            </div>
            <button
              className="raw-table-card__remove"
              onClick={() => onRemove(file.id)}
              aria-label={`Remove ${file.name}`}
            >
              ✕
            </button>
          </div>
          <div className="raw-table-scroll">
            <table className="raw-table">
              <thead>
                <tr>
                  {file.rawHeaders.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {file.rawRows.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {file.rawHeaders.map((h) => (
                      <td key={h}>{row[h] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {file.rawRows.length > 10 && (
              <p className="raw-table__more">… and {file.rawRows.length - 10} more rows</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
