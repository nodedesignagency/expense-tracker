import { formatMoney } from '../lib/money'
import type { Totals } from '../lib/types'
import { Mascot } from './Mascot'
import './BalanceCard.css'

interface BalanceCardProps {
  netCents: number
  totals: Totals
  monthLabel: string
}

/**
 * Picks the mascot's line from where the account actually stands, so the quip
 * means something instead of being decoration.
 */
export function quipFor(totals: Totals, netCents: number): string {
  if (totals.count === 0) return 'Nothing logged yet this month'
  if (netCents <= 0) return 'You are under water this month'
  if (netCents >= 5_000_000) return 'Holy moly, you are cooking this month'
  if (netCents >= 1_000_000) return 'Steady month, you are well ahead'
  if (totals.debitCents > totals.creditCents) return 'Spending is outpacing income'
  return 'Keeping your head above water'
}

export function BalanceCard({ netCents, totals, monthLabel }: BalanceCardProps) {
  return (
    <section className="balance glass glass--card" aria-label={`Net balance, ${monthLabel}`}>
      <div className="balance__body">
        <p className="balance__label">Net Balance</p>
        <p className="balance__amount tnum">{formatMoney(netCents)}</p>

        <ul className="balance__legend">
          <li className="balance__pill" data-kind="credit">
            <span className="balance__bar" />
            Credit: <span className="tnum">{formatMoney(totals.creditCents)}</span>
          </li>
          <li className="balance__pill" data-kind="debit">
            <span className="balance__bar" />
            Debit: <span className="tnum">{formatMoney(totals.debitCents)}</span>
          </li>
        </ul>
      </div>

      <p className="balance__bubble">{quipFor(totals, netCents)}</p>

      <div className="balance__mascot">
        <Mascot size={118} />
      </div>
    </section>
  )
}
