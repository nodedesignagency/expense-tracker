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
      <button className="txn glass" onClick={() => onOpen?.(transaction.id)}>
        <div className="txn__top">
          <Avatar brand={brand} name={name} size={50} />
          <div className="txn__identity">
            <span className="txn__name">{name}</span>
            <span className="txn__rail">
              {railLabel} {method}
            </span>
          </div>
          <div className="txn__figures">
            <span className="txn__amount tnum" data-direction={direction}>
              {formatSigned(amountCents, direction)}
            </span>
            <span className="txn__balance tnum">Balance: {formatMoney(balanceCents)}</span>
          </div>
        </div>

        <div className="txn__meta">
          <span className="txn__chip">{category}</span>
          <span className="txn__time">{formatTime(time)}</span>
        </div>
      </button>
    </li>
  )
}
