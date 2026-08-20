import { formatTime } from '../lib/dates'
import { formatMoney, formatSigned } from '../lib/money'
import type { Transaction } from '../lib/types'
import { Avatar } from './Avatar'
import './TransactionCard.css'

interface Props {
  transaction: Transaction
  onOpen?: (id: string) => void
}

export function TransactionCard({ transaction, onOpen }: Props) {
  const { name, brand, direction, amountCents, balanceCents, category, method, time } = transaction
  const railLabel = direction === 'debit' ? 'Debited by' : 'Credited by'

  return (
    <li>
      <button className="txn card card--entry glass" onClick={() => onOpen?.(transaction.id)}>
        <div className="txn__top">
          <span className="txn__who">
            <Avatar brand={brand} name={name} size={44} />
            <span className="txn__identity">
              <span className="txn__name">{name}</span>
              <span className="txn__rail">
                {railLabel} {method}
              </span>
            </span>
          </span>

          <span className="txn__figures">
            <span className="txn__amount tnum" data-direction={direction}>
              {formatSigned(amountCents, direction)}
            </span>
            <span className="txn__balance tnum">Balance: {formatMoney(balanceCents)}</span>
          </span>
        </div>

        <span className="txn__rule" aria-hidden="true" />

        <div className="txn__meta">
          <span className="txn__chip chip">{category}</span>
          <span className="txn__time">{formatTime(time)}</span>
        </div>
      </button>
    </li>
  )
}
