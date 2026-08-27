import { addDays, compareIsoDesc } from '../lib/dates'
import type { Scope, Transaction } from '../lib/types'
import { generateTransactions, sortChronological, TODAY_ISO } from './generate'

/**
 * What the ledger is calibrated to land on.
 *
 * **The net position is still the design's**, because it is the hero figure on
 * the balance card and the one number the frame is read for. The month's flows
 * are not any more: the frame's $45,786 in against $97,664 out is an agency
 * spending twice what it earns, and calibration was forcing that shape onto
 * every generated month — the insights page then reported it faithfully and
 * looked broken. A freelancer's month is the other way round, by a lot.
 *
 * Change these and the whole history rescales; nothing else needs touching.
 */
export const REFERENCE = {
  netBalanceCents: 6_978_600,
  /** A good month: three invoices in, subscriptions and a desk out. */
  monthCreditCents: 1_284_000,
  /*
   * Room for the authored $2,000 draw **and** a month of subscriptions.
   * Set to 214,000 it left $140 for everything that was not the draw, because
   * calibration scales only the generated rows and the authored ones come off
   * the target first — so May's costs came out as rounding error.
   */
  monthDebitCents: 272_000,
  month: '2026-05',
  /*
   * Fewer than before. A freelancer's business ledger is a handful of invoices
   * and a tail of small subscriptions, not sixty entries a month — and the
   * count is what made the old one read as a company.
   */
  entryCount: 124,
} as const

const PERSONAL_NET_CENTS = 1_248_000

/** Generated entries that share the current day with the authored pair. */
const TODAY_FILL = 3

/** Two authored entries so the current day matches the design frame exactly. */
const HERO_ROWS: Transaction[] = [
  {
    id: 'hero-1-jameson',
    name: 'J. Jonah Jameson',
    brand: 'wise',
    scope: 'business',
    direction: 'debit',
    amountCents: 200_000,
    balanceCents: 0,
    category: 'Salary',
    method: 'Wise',
    date: TODAY_ISO,
    time: '08:20',
    note: 'May retainer, paid out',
  },
  {
    /*
     * A client payment, not a refund from a tool vendor.
     *
     * This was a $2,000 credit from Claude filed under Tools, which made a
     * subscription the largest payer on the insights page — 16% of everything
     * that came in, from a company you pay. The frame wants one in and one out
     * on the current day; it does not care who.
     */
    id: 'hero-2-northwind',
    name: 'Northwind Studio',
    brand: 'stripe',
    scope: 'business',
    direction: 'credit',
    amountCents: 200_000,
    balanceCents: 0,
    category: 'Client',
    method: 'Bank Transfer',
    date: TODAY_ISO,
    time: '08:20',
    note: 'May retainer',
  },
]

/**
 * Rescales one month's entries so their totals hit the reference figures while
 * keeping every amount a whole number of dollars. Entries are scaled
 * proportionally, then the rounding residual lands on the largest one.
 */
function calibrateMonth(rows: Transaction[], month: string, targets: Record<string, number>): void {
  for (const direction of ['credit', 'debit'] as const) {
    const target = targets[direction]
    const group = rows.filter(
      (row) => row.date.startsWith(month) && row.direction === direction && !row.id.startsWith('hero-'),
    )
    if (group.length === 0) continue

    const heroTotal = rows
      .filter((row) => row.date.startsWith(month) && row.direction === direction && row.id.startsWith('hero-'))
      .reduce((sum, row) => sum + row.amountCents, 0)

    const adjustable = target - heroTotal
    const current = group.reduce((sum, row) => sum + row.amountCents, 0)
    const factor = adjustable / current

    for (const row of group) {
      row.amountCents = Math.max(100, Math.round((row.amountCents * factor) / 100) * 100)
    }

    const drift = adjustable - group.reduce((sum, row) => sum + row.amountCents, 0)
    const largest = group.reduce((a, b) => (a.amountCents >= b.amountCents ? a : b))
    largest.amountCents = Math.max(100, largest.amountCents + drift)
  }
}

/** Walks the ledger forward and stamps the account balance after each entry. */
function applyRunningBalance(rows: Transaction[], targetNetCents: number): void {
  const delta = (row: Transaction) => (row.direction === 'credit' ? row.amountCents : -row.amountCents)
  const settled = rows.filter((row) => row.date <= TODAY_ISO)
  const opening = targetNetCents - settled.reduce((sum, row) => sum + delta(row), 0)

  let balance = opening
  for (const row of rows) {
    balance += delta(row)
    row.balanceCents = balance
  }
}

function buildScope(scope: Scope): Transaction[] {
  const isBusiness = scope === 'business'
  const generated = generateTransactions({
    scope,
    seed: isBusiness ? 20260512 : 990512,
    startDate: '2026-01-02',
    // Business history stops the day before, so the current day is exactly the
    // two authored entries — the pair the design frame shows.
    endDate: isBusiness ? addDays(TODAY_ISO, -1) : TODAY_ISO,
    count: isBusiness ? REFERENCE.entryCount - HERO_ROWS.length - TODAY_FILL : 186,
  })

  /*
   * A few more entries land on the current day, drawn before the authored pair
   * so those two still lead the list the way the frame shows them.
   */
  const todayRows = isBusiness
    ? generateTransactions({
        scope,
        seed: 5120260,
        startDate: TODAY_ISO,
        endDate: TODAY_ISO,
        count: TODAY_FILL,
        hours: [6, 8],
      })
    : []

  const rows = sortChronological(
    isBusiness ? [...generated, ...todayRows, ...HERO_ROWS] : generated,
  )

  if (isBusiness) {
    calibrateMonth(rows, REFERENCE.month, {
      credit: REFERENCE.monthCreditCents,
      debit: REFERENCE.monthDebitCents,
    })
  }

  applyRunningBalance(rows, isBusiness ? REFERENCE.netBalanceCents : PERSONAL_NET_CENTS)
  return rows
}

/** The full starting ledger, newest entry first — the order the UI reads it in. */
export function buildSeedLedger(): Transaction[] {
  const rows = [...buildScope('business'), ...buildScope('personal')]
  return rows.sort((a, b) => compareIsoDesc(a.date, b.date) || compareIsoDesc(a.time, b.time))
}

export { TODAY_ISO }
