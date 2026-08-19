export type Scope = 'business' | 'personal'

export type Direction = 'credit' | 'debit'

export type Category =
  | 'Salary'
  | 'Tools'
  | 'Client'
  | 'Travel'
  | 'Food'
  | 'Rent'
  | 'Software'
  | 'Health'
  | 'Shopping'
  | 'Transfer'

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
