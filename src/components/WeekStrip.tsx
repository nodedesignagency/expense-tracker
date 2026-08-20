import { Fragment, useMemo } from 'react'
import { dayOfMonth, weekdayShort, weekOf } from '../lib/dates'
import { useAppState, useDispatch, useToday } from '../store'
import './WeekStrip.css'

/**
 * Sun–Sat day picker. Past and present days read as filled circles; days that
 * haven't happened yet are dashed outlines. Tapping the active day clears the
 * day filter so the full ledger comes back.
 */
export function WeekStrip() {
  const { weekAnchor, selectedDate } = useAppState()
  const dispatch = useDispatch()
  const today = useToday()
  const days = useMemo(() => weekOf(weekAnchor), [weekAnchor])

  return (
    <div className="weekstrip">
      {days.map((iso, index) => {
        const isSelected = iso === selectedDate
        const isFuture = iso > today
        return (
          <Fragment key={iso}>
            {index > 0 ? <span className="weekstrip__rule" aria-hidden="true" /> : null}
            <button
            className="weekstrip__day"
            data-selected={isSelected}
            data-future={isFuture}
            aria-pressed={isSelected}
            aria-label={`${weekdayShort(iso)} ${dayOfMonth(iso)}`}
            onClick={() => dispatch({ type: 'selectDate', date: isSelected ? null : iso })}
          >
            <span className="weekstrip__label">{weekdayShort(iso)}</span>
            <span className="weekstrip__circle surface glass tnum" data-no-rim={isFuture}>{dayOfMonth(iso)}</span>
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}
