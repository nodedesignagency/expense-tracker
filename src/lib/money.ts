/** Money helpers. Everything is cents in, string out — no floats in the domain. */

const WHOLE = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const PRECISE = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formats cents as USD. Round sums render without decimals (`$69,786`) the way
 * the design shows them; anything with cents keeps both digits.
 */
export function formatMoney(cents: number, opts: { forceWhole?: boolean } = {}): string {
  const value = cents / 100
  const isWhole = cents % 100 === 0
  return isWhole || opts.forceWhole ? WHOLE.format(value) : PRECISE.format(value)
}

/** Signed amount for a ledger row: `-$2,000` for debits, `$2,000` for credits. */
export function formatSigned(cents: number, direction: 'credit' | 'debit'): string {
  const body = formatMoney(Math.abs(cents))
  return direction === 'debit' ? `-${body}` : body
}

/** Parses free-form user input ("2,000.50", "$2000") into cents. */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '')
  if (!cleaned || cleaned.split('.').length > 2) return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100)
}

/** Compact form for chart labels: `$12.4k`. */
export function formatCompact(cents: number): string {
  const value = Math.abs(cents) / 100
  if (value >= 1000) return `$${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`
  return `$${Math.round(value)}`
}
