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
}

const BUSINESS_BOOK: Counterparty[] = [
  { name: 'J. Jonah Jameson', brand: 'wise', category: 'Salary', method: 'Wise', direction: 'debit', min: 1800, max: 2600, weight: 5 },
  { name: 'Daily Bugle Media', brand: 'generic', category: 'Client', method: 'Bank Transfer', direction: 'credit', min: 3200, max: 9800, weight: 7 },
  { name: 'Oscorp Industries', brand: 'generic', category: 'Client', method: 'Wise', direction: 'credit', min: 2400, max: 12000, weight: 6 },
  { name: 'Stark Retainer', brand: 'stripe', category: 'Client', method: 'Bank Transfer', direction: 'credit', min: 4000, max: 15000, weight: 5 },
  { name: 'Claude', brand: 'claude', category: 'Tools', method: 'Credit Card', direction: 'debit', min: 40, max: 300, weight: 6 },
  { name: 'Figma', brand: 'figma', category: 'Software', method: 'Credit Card', direction: 'debit', min: 45, max: 180, weight: 4 },
  { name: 'Stripe Payout', brand: 'stripe', category: 'Client', method: 'Bank Transfer', direction: 'credit', min: 900, max: 6400, weight: 6 },
  { name: 'Amazon Business', brand: 'amazon', category: 'Shopping', method: 'Credit Card', direction: 'debit', min: 60, max: 1400, weight: 5 },
  { name: 'WeWork Studio', brand: 'generic', category: 'Rent', method: 'Bank Transfer', direction: 'debit', min: 2100, max: 4200, weight: 3 },
  { name: 'Uber Business', brand: 'uber', category: 'Travel', method: 'Apple Pay', direction: 'debit', min: 18, max: 240, weight: 5 },
  { name: 'Delta Air Lines', brand: 'generic', category: 'Travel', method: 'Credit Card', direction: 'debit', min: 320, max: 1900, weight: 3 },
  { name: 'M. Watson', brand: 'wise', category: 'Salary', method: 'Wise', direction: 'debit', min: 1200, max: 5200, weight: 5 },
  { name: 'AWS', brand: 'generic', category: 'Software', method: 'Credit Card', direction: 'debit', min: 180, max: 2400, weight: 5 },
  { name: 'Notion Labs', brand: 'generic', category: 'Software', method: 'Credit Card', direction: 'debit', min: 24, max: 160, weight: 3 },
  { name: 'Katz Deli', brand: 'generic', category: 'Food', method: 'Credit Card', direction: 'debit', min: 40, max: 420, weight: 4 },
  { name: 'Vault Transfer', brand: 'generic', category: 'Transfer', method: 'Bank Transfer', direction: 'credit', min: 500, max: 3000, weight: 2 },
]

const PERSONAL_BOOK: Counterparty[] = [
  { name: 'Monthly Payroll', brand: 'wise', category: 'Salary', method: 'Bank Transfer', direction: 'credit', min: 4200, max: 5600, weight: 4 },
  { name: 'Whole Foods', brand: 'generic', category: 'Food', method: 'Apple Pay', direction: 'debit', min: 22, max: 240, weight: 9 },
  { name: 'Spotify', brand: 'spotify', category: 'Software', method: 'Credit Card', direction: 'debit', min: 11, max: 19, weight: 3 },
  { name: 'Landlord 9th St', brand: 'generic', category: 'Rent', method: 'Bank Transfer', direction: 'debit', min: 1850, max: 2200, weight: 3 },
  { name: 'Uber', brand: 'uber', category: 'Travel', method: 'Apple Pay', direction: 'debit', min: 9, max: 88, weight: 7 },
  { name: 'Amazon', brand: 'amazon', category: 'Shopping', method: 'Credit Card', direction: 'debit', min: 15, max: 460, weight: 7 },
  { name: 'Blue Bottle', brand: 'generic', category: 'Food', method: 'Apple Pay', direction: 'debit', min: 5, max: 24, weight: 8 },
  { name: 'Equinox', brand: 'generic', category: 'Health', method: 'Credit Card', direction: 'debit', min: 68, max: 260, weight: 3 },
  { name: 'Mom', brand: 'generic', category: 'Transfer', method: 'PayPal', direction: 'credit', min: 40, max: 400, weight: 2 },
  { name: 'Sunday Market', brand: 'generic', category: 'Food', method: 'Cash', direction: 'debit', min: 8, max: 70, weight: 5 },
  { name: 'Delta Air Lines', brand: 'generic', category: 'Travel', method: 'Credit Card', direction: 'debit', min: 180, max: 940, weight: 2 },
  { name: 'Side Project', brand: 'stripe', category: 'Client', method: 'PayPal', direction: 'credit', min: 120, max: 1800, weight: 3 },
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
  const book = scope === 'business' ? BUSINESS_BOOK : PERSONAL_BOOK
  // A single-day window is span 0, not 1 — clamping up to 1 let entries land
  // on the day after `endDate`.
  const span = Math.max(
    0,
    Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000),
  )

  const rows: Transaction[] = []
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
