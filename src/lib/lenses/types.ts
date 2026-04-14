export type LensId = 'spending' | 'tax-us' | 'essentials'

export type TaxArea =
  | 'schedule-a'
  | 'schedule-c'
  | 'schedule-se'
  | 'form-2441'
  | 'hsa-medical'
  | 'non-deductible'

export const TAX_AREAS: { id: TaxArea; label: string; color: string }[] = [
  { id: 'schedule-a',    label: 'Schedule A',    color: '#90cdf4' },
  { id: 'schedule-c',    label: 'Schedule C',    color: '#b794f4' },
  { id: 'schedule-se',   label: 'Schedule SE',   color: '#68d391' },
  { id: 'form-2441',     label: 'Form 2441',     color: '#fbb6ce' },
  { id: 'hsa-medical',   label: 'HSA / Medical', color: '#fc8181' },
  { id: 'non-deductible',label: 'Non-Deductible',color: '#4a5568' },
]

export interface TaxResult {
  id: string
  taxArea: TaxArea
  /** Claude flagged this as ambiguous — could plausibly belong to multiple tax areas */
  ambiguous: boolean
}

export type EssentialsBucket = 'fixed-essential' | 'variable-essential' | 'discretionary'

export const ESSENTIALS_BUCKETS: { id: EssentialsBucket; label: string; color: string }[] = [
  { id: 'fixed-essential',    label: 'Fixed Essential',    color: '#90cdf4' },
  { id: 'variable-essential', label: 'Variable Essential', color: '#68d391' },
  { id: 'discretionary',      label: 'Discretionary',      color: '#f6ad55' },
]
