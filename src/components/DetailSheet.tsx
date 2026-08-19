import { formatDateHeading, formatTime } from '../lib/dates'
import { formatMoney, formatSigned } from '../lib/money'
import { useAppState, useDispatch } from '../store'
import { Avatar } from './Avatar'
import { TrashIcon } from './Icons'
import { Sheet } from './Sheet'
import './DetailSheet.css'

/** Read-only view of one entry, with a destructive action at the bottom. */
export function DetailSheet() {
  const { detailId, transactions } = useAppState()
  const dispatch = useDispatch()
  const entry = transactions.find((row) => row.id === detailId) ?? null

  return (
    <Sheet
      open={Boolean(entry)}
      title="Entry"
      onClose={() => dispatch({ type: 'openDetail', id: null })}
      footer={
        entry ? (
          <button
            className="detail__delete"
            onClick={() => dispatch({ type: 'deleteTransaction', id: entry.id })}
          >
            <TrashIcon size={18} />
            Delete entry
          </button>
        ) : null
      }
    >
      {entry ? (
        <div className="detail">
          <div className="detail__hero">
            <Avatar brand={entry.brand} name={entry.name} size={64} />
            <p className="detail__name">{entry.name}</p>
            <p className="detail__amount tnum" data-direction={entry.direction}>
              {formatSigned(entry.amountCents, entry.direction)}
            </p>
          </div>

          <dl className="detail__rows">
            <Row label="Date" value={formatDateHeading(entry.date)} />
            <Row label="Time" value={formatTime(entry.time)} />
            <Row label="Category" value={entry.category} />
            <Row label="Method" value={entry.method} />
            <Row label="Scope" value={entry.scope === 'business' ? 'Business' : 'Personal'} />
            <Row label="Balance after" value={formatMoney(entry.balanceCents)} />
            {entry.note ? <Row label="Note" value={entry.note} /> : null}
          </dl>
        </div>
      ) : null}
    </Sheet>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail__row">
      <dt>{label}</dt>
      <dd className="tnum">{value}</dd>
    </div>
  )
}
