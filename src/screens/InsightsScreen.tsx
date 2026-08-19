import { useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '../components/Icons'
import { formatMonthYear } from '../lib/dates'
import { formatCompact, formatMoney } from '../lib/money'
import {
  categoryBreakdown,
  dailySeries,
  daysInMonth,
  filterLedger,
  monthTotals,
} from '../lib/selectors'
import { useAppState, useToday } from '../store'
import './InsightsScreen.css'

function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split('-').map(Number)
  const next = new Date(year, index - 1 + delta, 1)
  return `${next.getFullYear()}-${`${next.getMonth() + 1}`.padStart(2, '0')}`
}

export function InsightsScreen() {
  const { transactions, scope } = useAppState()
  const today = useToday()
  const [month, setMonth] = useState(today.slice(0, 7))

  const rows = useMemo(() => filterLedger(transactions, { scope }), [transactions, scope])
  const totals = useMemo(() => monthTotals(rows, month), [rows, month])
  const monthRows = useMemo(() => rows.filter((row) => row.date.startsWith(month)), [rows, month])
  const spend = useMemo(() => categoryBreakdown(monthRows, 'debit'), [monthRows])
  const series = useMemo(
    () => dailySeries(rows, month, daysInMonth(`${month}-01`)),
    [rows, month],
  )
  const peak = Math.max(1, ...series.map((day) => Math.max(day.creditCents, day.debitCents)))

  return (
    <div className="insights">
      <header className="insights__head">
        <button aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeftIcon size={20} />
        </button>
        <h1>{formatMonthYear(`${month}-01`)}</h1>
        <button
          aria-label="Next month"
          disabled={month >= today.slice(0, 7)}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRightIcon size={20} />
        </button>
      </header>

      <div className="insights__totals">
        <article className="stat" data-kind="credit">
          <p className="stat__label">In</p>
          <p className="stat__value tnum">{formatMoney(totals.creditCents)}</p>
        </article>
        <article className="stat" data-kind="debit">
          <p className="stat__label">Out</p>
          <p className="stat__value tnum">{formatMoney(totals.debitCents)}</p>
        </article>
        <article className="stat" data-kind="net">
          <p className="stat__label">Net</p>
          <p className="stat__value tnum">{formatMoney(totals.netCents)}</p>
        </article>
      </div>

      <section className="panel">
        <h2 className="panel__title">Daily flow</h2>
        <div className="chart" role="img" aria-label={`Daily money in and out for ${month}`}>
          {series.map((day) => (
            <div key={day.date} className="chart__col" title={day.date}>
              {day.creditCents > 0 ? (
                <span
                  className="chart__bar chart__bar--credit"
                  style={{ height: `${(day.creditCents / peak) * 100}%` }}
                />
              ) : null}
              {day.debitCents > 0 ? (
                <span
                  className="chart__bar chart__bar--debit"
                  style={{ height: `${(day.debitCents / peak) * 100}%` }}
                />
              ) : null}
            </div>
          ))}
        </div>
        <div className="chart__axis">
          <span>1</span>
          <span>{Math.ceil(series.length / 2)}</span>
          <span>{series.length}</span>
        </div>
        <p className="chart__peak">Peak day {formatCompact(peak)}</p>
      </section>

      <section className="panel">
        <h2 className="panel__title">Where it went</h2>
        {spend.length === 0 ? (
          <p className="panel__empty">No spend recorded this month.</p>
        ) : (
          <ul className="breakdown">
            {spend.map((slice) => (
              <li key={slice.category} className="breakdown__row">
                <div className="breakdown__head">
                  <span className="breakdown__name">{slice.category}</span>
                  <span className="breakdown__value tnum">{formatMoney(slice.cents)}</span>
                </div>
                <div className="breakdown__track">
                  <span className="breakdown__fill" style={{ width: `${slice.share * 100}%` }} />
                </div>
                <span className="breakdown__meta">
                  {Math.round(slice.share * 100)}% · {slice.count}{' '}
                  {slice.count === 1 ? 'entry' : 'entries'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
