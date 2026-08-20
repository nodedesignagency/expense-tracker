import { formatMoney } from '../lib/money'
import type { Totals } from '../lib/types'
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
    <section className="balance card" aria-label={`Net balance, ${monthLabel}`}>
      <div className="balance__body">
        <div className="balance__head">
          <p className="balance__label">Net Balance</p>
          <p className="balance__amount tnum">{formatMoney(netCents)}</p>
        </div>

        <ul className="balance__legend">
          <li className="balance__pill tnum" data-kind="credit">
            {`Credit: ${formatMoney(totals.creditCents)}`}
          </li>
          <li className="balance__pill tnum" data-kind="debit">
            {`Debit: ${formatMoney(totals.debitCents)}`}
          </li>
        </ul>
      </div>

      <p className="balance__bubble">{quipFor(totals, netCents)}</p>

      <div className="balance__mascot">
        <img src="/art/mascot.png" alt="Piggy, the app mascot, wearing a suit" />
      </div>
    </section>
  )
}
