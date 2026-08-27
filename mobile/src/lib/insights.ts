/**
 * Sentences about a period, derived from the ledger.
 *
 * This is the hook image 2 gets from a "financial health score", without the
 * false precision. A score compresses several unrelated things into one
 * number, and the compression is where the meaning goes: told 83, nobody does
 * anything differently. A sentence names the thing that moved, and every
 * figure in it can be checked against the ledger it came from.
 *
 * Deterministic, not generated. Nothing here can be wrong in a way the data
 * is not already wrong.
 */
import { formatMoney } from './money'
import { changeVs, counterpartyBreakdown, type Range } from './selectors'
import { categoryBreakdown, totalsOf } from './selectors'
import type { Transaction } from './types'

/** A figure worth colouring sits in its own part; prose is untinted. */
export interface Part {
  text: string
  tint?: 'credit' | 'debit' | 'strong'
}

export interface Line {
  key: string
  parts: Part[]
}

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)

/** `up 24%` / `down 12%`, or null when there is nothing to compare against. */
function movement(now: number, before: number): { word: string; pct: string } | null {
  const change = changeVs(now, before)
  if (change === null || Math.abs(change) < 0.005) return null
  return {
    word: change > 0 ? 'up' : 'down',
    pct: `${Math.abs(Math.round(change * 100))}%`,
  }
}

/**
 * The business ledger: did the work pay, who paid for it, what did it cost.
 *
 * Deliberately led by income rather than spend. A freelancer's outgoings are
 * mostly small and predictable; the question that decides the month is
 * whether the invoices landed.
 */
export function businessLines(
  rows: Transaction[],
  before: Transaction[],
  range: Range,
): Line[] {
  const now = totalsOf(rows)
  const then = totalsOf(before)
  const lines: Line[] = []
  const credits = rows.filter((r) => r.direction === 'credit')

  if (credits.length === 0) {
    lines.push({
      key: 'none',
      parts: [{ text: `Nothing came in during ${range.label}.` }],
    })
  } else {
    const move = movement(now.creditCents, then.creditCents)
    lines.push({
      key: 'in',
      parts: [
        { text: 'You invoiced ' },
        { text: formatMoney(now.creditCents), tint: 'credit' },
        { text: ` across ${credits.length} ${plural(credits.length, 'payment')}` },
        ...(move
          ? ([
              { text: ', ' },
              { text: `${move.word} ${move.pct}`, tint: move.word === 'up' ? 'credit' : 'debit' },
              { text: ' on the period before.' },
            ] as Part[])
          : ([{ text: '.' }] as Part[])),
      ],
    })

    /* Who pays you, which a category breakdown cannot answer: every client
     * payment files under "Client" and the one name you need is averaged out. */
    const top = counterpartyBreakdown(rows, 'credit')[0]
    if (top && counterpartyBreakdown(rows, 'credit').length > 1) {
      lines.push({
        key: 'client',
        parts: [
          { text: `${top.name} was your largest payer at ` },
          { text: formatMoney(top.cents), tint: 'strong' },
          { text: `, ${Math.round(top.share * 100)}% of everything that came in.` },
        ],
      })
    }
  }

  if (now.debitCents > 0) {
    const cost = categoryBreakdown(rows, 'debit')[0]
    const share = now.creditCents > 0 ? Math.round((now.debitCents / now.creditCents) * 100) : null
    lines.push({
      key: 'out',
      parts: [
        { text: 'Running the business cost ' },
        { text: formatMoney(now.debitCents), tint: 'debit' },
        ...(share !== null ? [{ text: `, ${share}% of what you brought in` }] : []),
        ...(cost ? [{ text: `, most of it on ${cost.category}` }] : []),
        { text: '.' },
      ],
    })
  }

  return lines
}

/**
 * The personal ledger: where it went, and whether that is normal for you.
 */
export function personalLines(
  rows: Transaction[],
  before: Transaction[],
  range: Range,
): Line[] {
  const now = totalsOf(rows)
  const then = totalsOf(before)
  const lines: Line[] = []
  const debits = rows.filter((r) => r.direction === 'debit')

  if (debits.length === 0) {
    lines.push({
      key: 'none',
      parts: [{ text: `Nothing went out during ${range.label}.` }],
    })
    return lines
  }

  const move = movement(now.debitCents, then.debitCents)
  lines.push({
    key: 'out',
    parts: [
      { text: 'You spent ' },
      { text: formatMoney(now.debitCents), tint: 'debit' },
      { text: ` across ${debits.length} ${plural(debits.length, 'entry', 'entries')}` },
      ...(move
        ? ([
            { text: ', ' },
            /* Spending less is the good direction, so the colours invert. */
            { text: `${move.word} ${move.pct}`, tint: move.word === 'up' ? 'debit' : 'credit' },
            { text: ' on the period before.' },
          ] as Part[])
        : ([{ text: '.' }] as Part[])),
    ],
  })

  const top = categoryBreakdown(rows, 'debit')[0]
  if (top) {
    lines.push({
      key: 'cat',
      parts: [
        { text: `${top.category} took the most at ` },
        { text: formatMoney(top.cents), tint: 'strong' },
        { text: `, ${Math.round(top.share * 100)}% of the total.` },
      ],
    })
  }

  const biggest = [...debits].sort((a, b) => b.amountCents - a.amountCents)[0]
  if (biggest && debits.length > 1) {
    lines.push({
      key: 'big',
      parts: [
        { text: 'The single largest was ' },
        { text: formatMoney(biggest.amountCents), tint: 'strong' },
        { text: ` to ${biggest.name}.` },
      ],
    })
  }

  if (now.creditCents > 0) {
    const kept = now.creditCents - now.debitCents
    lines.push({
      key: 'kept',
      parts: [
        { text: kept >= 0 ? 'You kept ' : 'You went over by ' },
        { text: formatMoney(Math.abs(kept)), tint: kept >= 0 ? 'credit' : 'debit' },
        { text: ' of what came in.' },
      ],
    })
  }

  return lines
}
