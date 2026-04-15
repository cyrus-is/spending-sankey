/**
 * Shared merchant and income source normalization utilities.
 * Used by sankey.ts (tooltip vendor grouping) and recurring.ts / budget.ts
 * (recurring detection and budget generation).
 */

const MERCHANT_MAP: [RegExp, string][] = [
  [/wholefds|whole\s*foods/i, 'Whole Foods'],
  [/trader\s*joe/i, "Trader Joe's"],
  [/starbucks/i, 'Starbucks'],
  [/amazon(?!\.com\s*refund)/i, 'Amazon'],
  [/shell\s*oil|shell\s*service/i, 'Shell'],
  [/costco\s*gas/i, 'Costco Gas'],
  [/costco\s*whse|costco(?!\s*gas)/i, 'Costco'],
  [/netflix/i, 'Netflix'],
  [/spotify/i, 'Spotify'],
  [/target/i, 'Target'],
  [/cvs\s*pharmacy/i, 'CVS Pharmacy'],
  [/walgreens/i, 'Walgreens'],
  [/uber\s*eats/i, 'Uber Eats'],
  [/uber\s*\*?\s*trip|uber\*?\s*pending/i, 'Uber'],
  [/lyft/i, 'Lyft'],
  [/grubhub/i, 'GrubHub'],
  [/doordash/i, 'DoorDash'],
  [/instacart/i, 'Instacart'],
  [/chipotle/i, 'Chipotle'],
  [/sweetgreen/i, 'Sweetgreen'],
  [/equinox/i, 'Equinox'],
  [/planet\s*fitness/i, 'Planet Fitness'],
  [/delta\s*air/i, 'Delta Air Lines'],
  [/marriott/i, 'Marriott'],
  [/hilton/i, 'Hilton'],
  [/airbnb/i, 'Airbnb'],
  [/apple\s*store/i, 'Apple Store'],
  [/apple\.com/i, 'Apple.com'],
  [/at&t|att\*/i, 'AT&T'],
  [/pg&e/i, 'PG&E'],
  [/comcast/i, 'Comcast'],
  [/tesco/i, 'Tesco'],
  [/sainsbury/i, "Sainsbury's"],
  [/deliveroo/i, 'Deliveroo'],
  [/pret\s*a\s*manger/i, 'Pret A Manger'],
  [/costa\s*coffee/i, 'Costa Coffee'],
  [/notion/i, 'Notion'],
  [/zoom/i, 'Zoom'],
  [/anthropic/i, 'Anthropic API'],
]

/** Normalize a vendor description to a clean, groupable name. */
export function normalizeVendorName(description: string): string {
  let s = description
    .replace(/\*[A-Z0-9]+$/i, '')   // strip trailing order IDs like *8N3LQ7PK5
    .replace(/#\d+/g, '')           // strip store numbers like #123
    .replace(/\s{2,}/g, ' ')
    .trim()

  for (const [pattern, name] of MERCHANT_MAP) {
    if (pattern.test(s)) return name
  }

  // Trim long descriptions
  return s.length > 28 ? s.substring(0, 28) + '…' : s
}

/** Normalize an income source description to a clean label. */
export function normalizeSource(description: string): string {
  if (/payroll|salary|direct.dep|employer|ach.credit/i.test(description)) return 'Salary'
  if (/interest/i.test(description)) return 'Interest'
  if (/dividend/i.test(description)) return 'Dividends'
  if (/zelle|venmo|cashapp|paypal/i.test(description)) return 'Peer Transfer'
  if (/refund|return/i.test(description)) return 'Refunds'
  return description.length > 30 ? description.substring(0, 30) + '…' : description
}
