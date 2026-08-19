import { useMemo } from 'react'
import { BalanceCard } from '../components/BalanceCard'
import { FilterBar } from '../components/FilterBar'
import { TransactionCard } from '../components/TransactionCard'
import { WeekStrip } from '../components/WeekStrip'
import { formatDateHeading, formatMonthYear } from '../lib/dates'
import { filterLedger, groupByDate, monthTotals, netBalanceCents } from '../lib/selectors'
import { useAppState, useDispatch, useToday } from '../store'
import './HomeScreen.css'

export function HomeScreen() {
  const { transactions, scope, selectedDate, query, categories } = useAppState()
  const dispatch = useDispatch()
  const today = useToday()

  const scopeRows = useMemo(
    () => filterLedger(transactions, { scope, query, categories }),
    [transactions, scope, query, categories],
  )

  const visible = useMemo(
    () => (selectedDate ? scopeRows.filter((row) => row.date === selectedDate) : scopeRows),
    [scopeRows, selectedDate],
  )

  const month = (selectedDate ?? today).slice(0, 7)
  const totals = useMemo(() => monthTotals(scopeRows, month), [scopeRows, month])
  const net = useMemo(() => netBalanceCents(transactions, scope, today), [transactions, scope, today])
  const groups = useMemo(() => groupByDate(visible), [visible])

  return (
    <>
      <WeekStrip />
      <BalanceCard netCents={net} totals={totals} monthLabel={formatMonthYear(`${month}-01`)} />
      <FilterBar />

      <div className="entrycount">
        <span className="entrycount__rule" data-side="left" />
        <span className="entrycount__text">
          Showing {scopeRows.length.toLocaleString('en-US')}{' '}
          {scopeRows.length === 1 ? 'Entry' : 'Entries'}
        </span>
        <span className="entrycount__rule" data-side="right" />
      </div>

      {groups.length === 0 ? (
        <p className="empty">
          Nothing here yet.
          {selectedDate ? ' Try another day, or clear the day filter.' : ' Add your first entry.'}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.date} className="daygroup">
            <h2 className="daygroup__heading">{formatDateHeading(group.date)}</h2>
            <ul className="daygroup__list">
              {group.rows.map((row) => (
                <TransactionCard
                  key={row.id}
                  transaction={row}
                  onOpen={(id) => dispatch({ type: 'openDetail', id })}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  )
}
