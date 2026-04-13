import Papa from 'papaparse'

interface CsvReadResult {
  headers: string[]
  rows: Record<string, string>[]
}

export function readCsvFile(file: File): Promise<CsvReadResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields ?? []
        resolve({ headers, rows: results.data })
      },
      error(err) {
        reject(new Error(`Failed to parse ${file.name}: ${err.message}`))
      },
    })
  })
}
