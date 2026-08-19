import type { Category, Scope, Totals, Transaction } from './types'

export interface LedgerFilter {
  scope: Scope
  /** Free-text match against counterparty, category and method. */
  query?: string
  /** When set, only entries in these categories survive. */
  categories?: Category[]
  /** When set, only entries on this exact day survive. */
  date?: string
}

export function filterLedger(rows: Transaction[], filter: LedgerFilter): Transaction[] {
  const needle = filter.query?.trim().toLowerCase()
  const categories = filter.categories?.length ? new Set(filter.categories) : null

  return rows.filter((row) => {
    if (row.scope !== filter.scope) return false
    if (filter.date && row.date !== filter.date) return false
    if (categories && !categories.has(row.category)) return false
    if (needle) {
      const haystack = `${row.name} ${row.category} ${row.method} ${row.note ?? ''}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })
}

/** Credit / debit / net across whatever slice is handed in. */
export function totalsOf(rows: Transaction[]): Totals {
  let creditCents = 0
  let debitCents = 0
  for (const row of rows) {
    if (row.direction === 'credit') creditCents += row.amountCents
    else debitCents += row.amountCents
  }
  return { creditCents, debitCents, netCents: creditCents - debitCents, count: rows.length }
}

/** Totals for one `YYYY-MM` month. */
export function monthTotals(rows: Transaction[], month: string): Totals {
  return totalsOf(rows.filter((row) => row.date.startsWith(month)))
}

/**
 * The account position after the most recent settled entry. Entries carry a
 * running balance, so this is a lookup rather than a re-summation.
 */
export function netBalanceCents(rows: Transaction[], scope: Scope, asOf: string): number {
  let latest: Transaction | null = null
  for (const row of rows) {
    if (row.scope !== scope || row.date > asOf) continue
    if (!latest || row.date > latest.date || (row.date === latest.date && row.time >= latest.time)) {
      latest = row
    }
  }
  return latest?.balanceCents ?? 0
}

export interface DayGroup {
  date: string
  rows: Transaction[]
  totals: Totals
}

/** Groups entries into day sections, newest day first, newest entry first. */
export function groupByDate(rows: Transaction[]): DayGroup[] {
  const buckets = new Map<string, Transaction[]>()
  for (const row of rows) {
    const bucket = buckets.get(row.date)
    if (bucket) bucket.push(row)
    else buckets.set(row.date, [row])
  }

  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, group]) => ({
      date,
      rows: [...group].sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0)),
      totals: totalsOf(group),
    }))
}

export interface CategorySlice {
  category: Category
  cents: number
  share: number
  count: number
}

/** Spend (or income) per category, largest first, with each share of the total. */
export function categoryBreakdown(
  rows: Transaction[],
  direction: 'credit' | 'debit',
): CategorySlice[] {
  const sums = new Map<Category, { cents: number; count: number }>()
  for (const row of rows) {
    if (row.direction !== direction) continue
    const entry = sums.get(row.category) ?? { cents: 0, count: 0 }
    entry.cents += row.amountCents
    entry.count += 1
    sums.set(row.category, entry)
  }

  const total = [...sums.values()].reduce((sum, entry) => sum + entry.cents, 0)
  return [...sums.entries()]
    .map(([category, entry]) => ({
      category,
      cents: entry.cents,
      count: entry.count,
      share: total === 0 ? 0 : entry.cents / total,
    }))
    .sort((a, b) => b.cents - a.cents)
}

export interface DayBar {
  date: string
  creditCents: number
  debitCents: number
}

/** One bar per day of the given month — the shape the insights chart wants. */
export function dailySeries(rows: Transaction[], month: string, days: number): DayBar[] {
  const series: DayBar[] = Array.from({ length: days }, (_, i) => ({
    date: `${month}-${`${i + 1}`.padStart(2, '0')}`,
    creditCents: 0,
    debitCents: 0,
  }))

  for (const row of rows) {
    if (!row.date.startsWith(month)) continue
    const index = Number(row.date.slice(8, 10)) - 1
    if (index < 0 || index >= series.length) continue
    if (row.direction === 'credit') series[index].creditCents += row.amountCents
    else series[index].debitCents += row.amountCents
  }

  return series
}

/** Days in the month a `YYYY-MM-DD` string falls in. */
export function daysInMonth(iso: string): number {
  const [year, month] = iso.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}
