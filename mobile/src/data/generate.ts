import { addDays, toISODate } from '../lib/dates'
import type { BrandKey, Category, Direction, Method, Scope, Transaction } from '../lib/types'

/**
 * Deterministic ledger generation.
 *
 * The app ships with a populated history so the balance card, the week strip
 * and the entry count all show something real. A seeded LCG keeps that history
 * byte-identical across reloads and across machines — no `Math.random`, so the
 * numbers in the UI are stable and testable.
 */
function lcg(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

interface Counterparty {
  name: string
  brand: BrandKey
  category: Category
  method: Method
  direction: Direction
  /** Inclusive amount range in whole dollars. */
  min: number
  max: number
  /** Relative likelihood of being drawn. */
  weight: number
  /**
   * Once a month, on a stable day, instead of drawn at random.
   *
   * Rent, subscriptions, insurance and the owner's draw do not happen by
   * chance — and drawn by weight they landed two and three times some months
   * and not at all in others. The insights page reported it: rent at 82% of
   * personal spend and "usually $4,383" against a $1,450 tenancy, which is
   * three rents a month.
   */
  monthly?: boolean
}

/*
 * A freelancer's business, not an agency's.
 *
 * The first book paid **two salaries and an office rent**, which is a company
 * with staff — and the insights page reported it faithfully: money out running
 * at twice money in, every month. What a freelancer actually looks like is a
 * handful of clients paying irregularly against a long tail of small
 * subscriptions, so income dwarfs costs and the month is decided by whether
 * the invoices landed.
 *
 * Weights are frequency, not size. The retainer is drawn often and is small;
 * a project invoice is drawn rarely and is large. That difference is what
 * makes the income lumpy rather than smooth, which is the whole texture of
 * freelance work and the thing the insights page exists to show.
 */
const BUSINESS_BOOK: Counterparty[] = [
  /* Income: one steady retainer, two irregular clients, and card takings. */
  { monthly: true, name: 'Northwind Studio', brand: 'stripe', category: 'Client', method: 'Bank Transfer', direction: 'credit', min: 3000, max: 3400, weight: 7 },
  { name: 'Kestrel Labs', brand: 'generic', category: 'Client', method: 'Wise', direction: 'credit', min: 1800, max: 6500, weight: 5 },
  { name: 'Vellum Press', brand: 'generic', category: 'Client', method: 'Bank Transfer', direction: 'credit', min: 600, max: 2400, weight: 4 },
  { name: 'Stripe Payout', brand: 'stripe', category: 'Client', method: 'Bank Transfer', direction: 'credit', min: 120, max: 900, weight: 5 },

  /* Costs: subscriptions, a desk, and the occasional trip. All small. */
  { name: 'Claude', brand: 'claude', category: 'Tools', method: 'Credit Card', direction: 'debit', min: 20, max: 100, weight: 6 },
  { monthly: true, name: 'Figma', brand: 'figma', category: 'Software', method: 'Credit Card', direction: 'debit', min: 15, max: 45, weight: 5 },
  { name: 'AWS', brand: 'generic', category: 'Software', method: 'Credit Card', direction: 'debit', min: 30, max: 180, weight: 5 },
  { monthly: true, name: 'Notion Labs', brand: 'generic', category: 'Software', method: 'Credit Card', direction: 'debit', min: 10, max: 24, weight: 4 },
  { monthly: true, name: 'Adobe', brand: 'generic', category: 'Software', method: 'Credit Card', direction: 'debit', min: 23, max: 60, weight: 4 },
  { monthly: true, name: 'Deskspace', brand: 'generic', category: 'Rent', method: 'Bank Transfer', direction: 'debit', min: 160, max: 220, weight: 4 },
  { name: 'Amazon Business', brand: 'amazon', category: 'Shopping', method: 'Credit Card', direction: 'debit', min: 18, max: 180, weight: 4 },
  { name: 'Uber Business', brand: 'uber', category: 'Travel', method: 'Apple Pay', direction: 'debit', min: 9, max: 60, weight: 4 },
  { name: 'Delta Air Lines', brand: 'generic', category: 'Travel', method: 'Credit Card', direction: 'debit', min: 180, max: 620, weight: 1 },
  { monthly: true, name: 'Freelancer Cover', brand: 'generic', category: 'Health', method: 'Credit Card', direction: 'debit', min: 88, max: 120, weight: 3 },
  /*
   * Paying yourself. Without it the business ledger showed a burn of about a
   * thousand a month against a five-figure balance, and runway came out at
   * fifty-nine months — arithmetically right and useless, because the largest
   * regular thing leaving the account was missing.
   */
  { monthly: true, name: 'Owner Draw', brand: 'wise', category: 'Salary', method: 'Wise', direction: 'debit', min: 1800, max: 2400, weight: 5 },
]

/*
 * The same person's own money: a draw from the business, rent, food, and the
 * small stuff. Costs sit a little under income, so the personal ledger drifts
 * upward slowly rather than swinging.
 */
const PERSONAL_BOOK: Counterparty[] = [
  { monthly: true, name: 'From Business', brand: 'wise', category: 'Transfer', method: 'Bank Transfer', direction: 'credit', min: 3200, max: 3800, weight: 6 },
  { name: 'Side Project', brand: 'stripe', category: 'Client', method: 'PayPal', direction: 'credit', min: 120, max: 900, weight: 2 },

  { monthly: true, name: 'Landlord 9th St', brand: 'generic', category: 'Rent', method: 'Bank Transfer', direction: 'debit', min: 1400, max: 1500, weight: 3 },
  { name: 'Whole Foods', brand: 'generic', category: 'Food', method: 'Apple Pay', direction: 'debit', min: 22, max: 140, weight: 9 },
  { name: 'Blue Bottle', brand: 'generic', category: 'Food', method: 'Apple Pay', direction: 'debit', min: 4, max: 14, weight: 8 },
  { name: 'Sunday Market', brand: 'generic', category: 'Food', method: 'Cash', direction: 'debit', min: 8, max: 45, weight: 5 },
  { name: 'Amazon', brand: 'amazon', category: 'Shopping', method: 'Credit Card', direction: 'debit', min: 12, max: 180, weight: 6 },
  { name: 'Uber', brand: 'uber', category: 'Travel', method: 'Apple Pay', direction: 'debit', min: 8, max: 40, weight: 6 },
  { monthly: true, name: 'Spotify', brand: 'spotify', category: 'Software', method: 'Credit Card', direction: 'debit', min: 11, max: 13, weight: 3 },
  { monthly: true, name: 'Equinox', brand: 'generic', category: 'Health', method: 'Credit Card', direction: 'debit', min: 68, max: 68, weight: 3 },
  { name: 'Delta Air Lines', brand: 'generic', category: 'Travel', method: 'Credit Card', direction: 'debit', min: 180, max: 520, weight: 1 },
]

function pickWeighted(book: Counterparty[], rand: () => number): Counterparty {
  const total = book.reduce((sum, entry) => sum + entry.weight, 0)
  let ticket = rand() * total
  for (const entry of book) {
    ticket -= entry.weight
    if (ticket <= 0) return entry
  }
  return book[book.length - 1]
}

/** Money looks authored, not random: round to the nearest dollar, often to $5. */
function drawAmountCents(party: Counterparty, rand: () => number): number {
  const dollars = party.min + rand() * (party.max - party.min)
  const rounded = dollars > 400 ? Math.round(dollars / 5) * 5 : Math.round(dollars)
  return Math.max(100, rounded * 100)
}

function drawTime(rand: () => number, [from, to]: [number, number]): string {
  const hour = from + Math.floor(rand() * Math.max(1, to - from))
  const minute = Math.floor(rand() * 12) * 5
  return `${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`
}

export interface GenerateOptions {
  scope: Scope
  seed: number
  /** First day of history, `YYYY-MM-DD`. */
  startDate: string
  /** Last day of history, inclusive. */
  endDate: string
  count: number
  /** Clamps drawn times to this window, as 24h hours. Defaults to 7am–9pm. */
  hours?: [number, number]
}

/**
 * Produces `count` entries spread over the date window, weighted so recent days
 * are a little busier than old ones. Output is sorted oldest first.
 */
export function generateTransactions({
  scope,
  seed,
  startDate,
  endDate,
  count,
  hours = [7, 21],
}: GenerateOptions): Transaction[] {
  const rand = lcg(seed)
  const all = scope === 'business' ? BUSINESS_BOOK : PERSONAL_BOOK
  /* The recurring ones are placed, not drawn; the rest fill in around them. */
  const book = all.filter((p) => !p.monthly)
  const recurring = all.filter((p) => p.monthly)
  // A single-day window is span 0, not 1 — clamping up to 1 let entries land
  // on the day after `endDate`.
  const span = Math.max(
    0,
    Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000),
  )

  const rows: Transaction[] = []

  /*
   * One row per recurring party per month in the window, on a day of the month
   * that is stable for that party — rent lands on the same day each month the
   * way rent does, rather than wandering.
   */
  const first = new Date(`${startDate}T00:00:00`)
  const last = new Date(`${endDate}T00:00:00`)
  for (const party of recurring) {
    const day = 1 + Math.floor(rand() * 27)
    const cursor = new Date(first.getFullYear(), first.getMonth(), 1)
    while (cursor <= last) {
      const when = new Date(cursor.getFullYear(), cursor.getMonth(), day)
      if (when >= first && when <= last) {
        rows.push({
          id: `${scope}-${seed}-m-${party.name}-${when.getMonth()}-${when.getFullYear()}`,
          name: party.name,
          brand: party.brand,
          scope,
          direction: party.direction,
          amountCents: drawAmountCents(party, rand),
          balanceCents: 0,
          category: party.category,
          method: party.method,
          date: toISODate(when),
          time: drawTime(rand, hours),
        })
      }
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  for (let i = 0; i < count; i += 1) {
    // Bias toward the recent end of the window: two draws, keep the larger.
    const t = Math.max(rand(), rand())
    const offset = Math.min(span, Math.floor(t * (span + 1)))
    const party = pickWeighted(book, rand)
    rows.push({
      id: `${scope}-${seed}-${i}`,
      name: party.name,
      brand: party.brand,
      scope,
      direction: party.direction,
      amountCents: drawAmountCents(party, rand),
      balanceCents: 0, // filled in by the running-balance pass in seed.ts
      category: party.category,
      method: party.method,
      date: addDays(startDate, offset),
      time: drawTime(rand, hours),
    })
  }

  return sortChronological(rows)
}

export function sortChronological(rows: Transaction[]): Transaction[] {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.time !== b.time) return a.time < b.time ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
}

export const TODAY_ISO = toISODate(new Date(2026, 4, 12))
