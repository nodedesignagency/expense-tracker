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

/* ------------------------------------------------------------------ *
 * Periods
 *
 * Insights was month-only. A freelancer's year is not: a quarter is what
 * many of them file on, and a year is the only window in which lumpy client
 * income stops looking like chaos. All three are the same shape — a range
 * with a label and a previous range to compare against — so nothing
 * downstream has to know which one it is looking at.
 * ------------------------------------------------------------------ */

export type Period = 'month' | 'quarter' | 'year'

export interface Range {
  /** Inclusive ISO bounds. */
  from: string
  to: string
  label: string
  /** How many months it spans, which is what the shape chart keys off. */
  months: number
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const iso = (y: number, m: number, d: number) =>
  `${y}-${`${m}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}`

/** Last day of a 1-indexed month, via the zeroth day of the next one. */
function lastDay(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

/**
 * The range an anchor date falls in, for the given period.
 *
 * Anchored on a *date* rather than carried as a cursor, so stepping and
 * switching period cannot disagree about where you are: switch from March to
 * quarters and you are in Q1, because March is.
 */
export function rangeOf(anchor: string, period: Period): Range {
  const [y, m] = anchor.split('-').map(Number)
  if (period === 'month') {
    return {
      from: iso(y, m, 1),
      to: iso(y, m, lastDay(y, m)),
      label: `${MONTH_NAMES[m - 1]} ${y}`,
      months: 1,
    }
  }
  if (period === 'quarter') {
    const q = Math.floor((m - 1) / 3)
    const first = q * 3 + 1
    return {
      from: iso(y, first, 1),
      to: iso(y, first + 2, lastDay(y, first + 2)),
      label: `Q${q + 1} ${y}`,
      months: 3,
    }
  }
  return { from: iso(y, 1, 1), to: iso(y, 12, 31), label: `${y}`, months: 12 }
}

/** The same period, `delta` steps away. */
export function stepPeriod(anchor: string, period: Period, delta: number): string {
  const [y, m] = anchor.split('-').map(Number)
  const jump = period === 'month' ? 1 : period === 'quarter' ? 3 : 12
  const d = new Date(y, m - 1 + delta * jump, 1)
  return iso(d.getFullYear(), d.getMonth() + 1, 1)
}

export function rowsInRange(rows: Transaction[], range: Range): Transaction[] {
  return rows.filter((row) => row.date >= range.from && row.date <= range.to)
}

/* ------------------------------------------------------------------ *
 * Breakdowns
 * ------------------------------------------------------------------ */

export interface NameSlice {
  name: string
  cents: number
  share: number
  count: number
}

/**
 * By counterparty rather than category.
 *
 * On the business ledger this is the question that matters — *who pays you* —
 * and a category breakdown cannot answer it: every client payment lands under
 * "Client" and the one name you need is averaged away.
 */
export function counterpartyBreakdown(
  rows: Transaction[],
  direction: 'credit' | 'debit',
): NameSlice[] {
  const sums = new Map<string, { cents: number; count: number }>()
  for (const row of rows) {
    if (row.direction !== direction) continue
    const at = sums.get(row.name) ?? { cents: 0, count: 0 }
    at.cents += row.amountCents
    at.count += 1
    sums.set(row.name, at)
  }
  const total = [...sums.values()].reduce((sum, e) => sum + e.cents, 0)
  return [...sums.entries()]
    .map(([name, e]) => ({
      name,
      cents: e.cents,
      count: e.count,
      share: total === 0 ? 0 : e.cents / total,
    }))
    .sort((a, b) => b.cents - a.cents)
}

export interface MonthBar {
  month: string
  label: string
  creditCents: number
  debitCents: number
}

/** One bar per month across a range — what the shape chart draws for a
 *  quarter or a year, where a bar per day would be unreadable. */
export function monthlySeries(rows: Transaction[], range: Range): MonthBar[] {
  const [y0, m0] = range.from.split('-').map(Number)
  const out: MonthBar[] = Array.from({ length: range.months }, (_, i) => {
    const d = new Date(y0, m0 - 1 + i, 1)
    return {
      month: `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}`,
      label: MONTH_NAMES[d.getMonth()],
      creditCents: 0,
      debitCents: 0,
    }
  })
  const index = new Map(out.map((bar, i) => [bar.month, i]))
  for (const row of rows) {
    const at = index.get(row.date.slice(0, 7))
    if (at === undefined) continue
    if (row.direction === 'credit') out[at].creditCents += row.amountCents
    else out[at].debitCents += row.amountCents
  }
  return out
}

/**
 * Percentage change, and whether it can be stated at all.
 *
 * Returns null when the earlier figure is zero: "up 100%" from nothing is
 * arithmetic, not information, and printing it is how a page starts lying.
 */
export function changeVs(now: number, before: number): number | null {
  if (before === 0) return null
  return (now - before) / before
}
