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
 * Picks the mascot's line from how the month is actually going, so the quip
 * means something instead of being decoration.
 */
export function quipFor(totals: Totals): string {
  if (totals.count === 0) return 'Nothing logged yet this month'
  const { creditCents, debitCents } = totals
  if (creditCents === 0) return 'All spend and no income yet'
  const ratio = debitCents / creditCents
  if (ratio < 0.6) return 'Holy moly, you are cooking this month'
  if (ratio < 1) return 'Steady month, you are still ahead'
  if (ratio < 1.5) return 'Spending is outpacing income'
  return 'Careful, this month runs hot'
}

export function BalanceCard({ netCents, totals, monthLabel }: BalanceCardProps) {
  return (
    <section className="balance glass" aria-label={`Net balance, ${monthLabel}`}>
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

      <p className="balance__bubble">{quipFor(totals)}</p>

      <div className="balance__mascot">
        <Mascot size={118} />
      </div>
    </section>
  )
}
