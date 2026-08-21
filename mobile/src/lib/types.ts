export type Scope = 'business' | 'personal'

export type Direction = 'credit' | 'debit'

/*
 * The ones that ship. A category is not closed any more — the composer can
 * make one — so the union is widened with `string & {}`, which still offers
 * these for completion while accepting whatever the user types.
 */
export const BUILTIN_CATEGORIES = [
  'Salary',
  'Client',
  'Tools',
  'Software',
  'Travel',
  'Food',
  'Rent',
  'Health',
  'Shopping',
  'Transfer',
] as const

export type BuiltinCategory = (typeof BUILTIN_CATEGORIES)[number]
export type Category = BuiltinCategory | (string & {})

/** Payment rail the entry moved over — shown as "Debited by {method}". */
export type Method = 'Wise' | 'Credit Card' | 'Bank Transfer' | 'Apple Pay' | 'PayPal' | 'Cash'

export type BrandKey =
  | 'wise'
  | 'claude'
  | 'stripe'
  | 'figma'
  | 'spotify'
  | 'amazon'
  | 'uber'
  | 'generic'

export interface Transaction {
  id: string
  /** Counterparty — a person or a company. */
  name: string
  brand: BrandKey
  scope: Scope
  direction: Direction
  /** Always positive, in minor units (cents) to keep arithmetic exact. */
  amountCents: number
  /** Running account balance after the entry settled, in cents. */
  balanceCents: number
  category: Category
  method: Method
  /** ISO local date, `YYYY-MM-DD`. */
  date: string
  /** 24h local time, `HH:MM`. */
  time: string
  note?: string
}

export interface Totals {
  creditCents: number
  debitCents: number
  netCents: number
  count: number
}
