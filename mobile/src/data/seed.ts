import { addDays, compareIsoDesc } from '../lib/dates'
import type { Scope, Transaction } from '../lib/types'
import { generateTransactions, sortChronological, TODAY_ISO } from './generate'

/**
 * Reference figures from the product design. The generated ledger is calibrated
 * to land on them exactly so the balance card reads the way the design does:
 * a $69,786 net position, with $45,786 in and $97,664 out across May 2026.
 */
export const REFERENCE = {
  netBalanceCents: 6_978_600,
  monthCreditCents: 4_578_600,
  monthDebitCents: 9_766_400,
  month: '2026-05',
  entryCount: 290,
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
    id: 'hero-2-claude',
    name: 'Claude',
    brand: 'claude',
    scope: 'business',
    direction: 'credit',
    amountCents: 200_000,
    balanceCents: 0,
    category: 'Tools',
    method: 'Credit Card',
    date: TODAY_ISO,
    time: '08:20',
    note: 'Annual plan refund',
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
