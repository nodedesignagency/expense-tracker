import { describe, expect, it } from 'vitest'
import { buildSeedLedger, REFERENCE, TODAY_ISO } from '../data/seed'
import { formatDateHeading, formatTime, weekOf } from '../lib/dates'
import { formatMoney, formatSigned, parseAmountToCents } from '../lib/money'
import {
  categoryBreakdown,
  filterLedger,
  groupByDate,
  monthTotals,
  netBalanceCents,
  totalsOf,
} from '../lib/selectors'

const ledger = buildSeedLedger()

describe('money', () => {
  it('drops decimals on round amounts and keeps them otherwise', () => {
    expect(formatMoney(6_978_600)).toBe('$69,786')
    expect(formatMoney(199_950)).toBe('$1,999.50')
  })

  it('signs debits and leaves credits bare', () => {
    expect(formatSigned(200_000, 'debit')).toBe('-$2,000')
    expect(formatSigned(200_000, 'credit')).toBe('$2,000')
  })

  it('parses user input into cents and rejects junk', () => {
    expect(parseAmountToCents('2,000')).toBe(200_000)
    expect(parseAmountToCents('$12.34')).toBe(1234)
    expect(parseAmountToCents('0')).toBeNull()
    expect(parseAmountToCents('abc')).toBeNull()
    expect(parseAmountToCents('1.2.3')).toBeNull()
  })
})

describe('dates', () => {
  it('formats the section heading the way the design does', () => {
    expect(formatDateHeading('2026-05-12')).toBe('May 12th 2026')
    expect(formatDateHeading('2026-05-01')).toBe('May 1st 2026')
    expect(formatDateHeading('2026-05-23')).toBe('May 23rd 2026')
    expect(formatDateHeading('2026-05-11')).toBe('May 11th 2026')
  })

  it('renders 24h times as the design does', () => {
    expect(formatTime('08:20')).toBe('8:20 am')
    expect(formatTime('00:05')).toBe('12:05 am')
    expect(formatTime('13:00')).toBe('1:00 pm')
  })

  it('returns a Sunday-to-Saturday week containing the date', () => {
    const week = weekOf('2026-05-12')
    expect(week).toHaveLength(7)
    expect(week[0]).toBe('2026-05-10')
    expect(week[6]).toBe('2026-05-16')
    expect(week).toContain('2026-05-12')
  })
})

describe('seed ledger', () => {
  it('carries the designed number of business entries', () => {
    const business = filterLedger(ledger, { scope: 'business' })
    expect(business).toHaveLength(REFERENCE.entryCount)
  })

  it('hits the reference figures on the balance card', () => {
    const business = filterLedger(ledger, { scope: 'business' })
    const totals = monthTotals(business, REFERENCE.month)
    expect(totals.creditCents).toBe(REFERENCE.monthCreditCents)
    expect(totals.debitCents).toBe(REFERENCE.monthDebitCents)
    expect(netBalanceCents(ledger, 'business', TODAY_ISO)).toBe(REFERENCE.netBalanceCents)
  })

  it('is deterministic across builds', () => {
    const again = buildSeedLedger()
    expect(again.map((row) => `${row.id}:${row.amountCents}`)).toEqual(
      ledger.map((row) => `${row.id}:${row.amountCents}`),
    )
  })

  it('keeps every amount positive and every entry inside the window', () => {
    for (const row of ledger) {
      expect(row.amountCents).toBeGreaterThan(0)
      expect(row.date >= '2026-01-02').toBe(true)
      expect(row.date <= TODAY_ISO).toBe(true)
    }
  })

  it('runs balances forward consistently', () => {
    const business = filterLedger(ledger, { scope: 'business' })
      .slice()
      .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))

    for (let i = 1; i < business.length; i += 1) {
      const previous = business[i - 1]
      const current = business[i]
      const delta = current.direction === 'credit' ? current.amountCents : -current.amountCents
      expect(current.balanceCents).toBe(previous.balanceCents + delta)
    }
  })
})

describe('selectors', () => {
  it('filters by scope, query and category together', () => {
    const business = filterLedger(ledger, { scope: 'business' })
    expect(business.every((row) => row.scope === 'business')).toBe(true)

    const claude = filterLedger(ledger, { scope: 'business', query: 'claude' })
    expect(claude.length).toBeGreaterThan(0)
    expect(claude.every((row) => row.name.toLowerCase().includes('claude'))).toBe(true)

    const travel = filterLedger(ledger, { scope: 'business', categories: ['Travel'] })
    expect(travel.every((row) => row.category === 'Travel')).toBe(true)
  })

  it('filters to a single day', () => {
    const day = filterLedger(ledger, { scope: 'business', date: TODAY_ISO })
    expect(day.length).toBeGreaterThan(0)
    expect(day.every((row) => row.date === TODAY_ISO)).toBe(true)
  })

  it('totals credits, debits and the net between them', () => {
    const totals = totalsOf([
      { ...ledger[0], direction: 'credit', amountCents: 500 },
      { ...ledger[1], direction: 'debit', amountCents: 200 },
    ])
    expect(totals).toEqual({ creditCents: 500, debitCents: 200, netCents: 300, count: 2 })
  })

  it('groups days newest first with newest entries on top', () => {
    const groups = groupByDate(filterLedger(ledger, { scope: 'business' }))
    expect(groups[0].date).toBe(TODAY_ISO)
    for (let i = 1; i < groups.length; i += 1) {
      expect(groups[i - 1].date > groups[i].date).toBe(true)
    }
    for (const group of groups) {
      for (let i = 1; i < group.rows.length; i += 1) {
        expect(group.rows[i - 1].time >= group.rows[i].time).toBe(true)
      }
    }
  })

  it('breaks spend down by category with shares that add up', () => {
    const rows = filterLedger(ledger, { scope: 'business' }).filter((row) =>
      row.date.startsWith(REFERENCE.month),
    )
    const slices = categoryBreakdown(rows, 'debit')
    expect(slices.length).toBeGreaterThan(0)
    expect(slices.reduce((sum, slice) => sum + slice.cents, 0)).toBe(REFERENCE.monthDebitCents)
    expect(slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1, 6)
    for (let i = 1; i < slices.length; i += 1) {
      expect(slices[i - 1].cents >= slices[i].cents).toBe(true)
    }
  })
})
