import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { dailySeries, daysInMonth, monthlySeries, type Range } from '../lib/selectors'
import type { Transaction } from '../lib/types'
import { formatCompact } from '../lib/money'
import { color, radius, sp, type } from '../theme'

interface Props {
  rows: Transaction[]
  range: Range
}

/**
 * The shape of the period at a glance.
 *
 * A month draws as a **calendar**, because that is how a month is actually
 * held in the head — the owner asked for this and was right: you can see
 * "everything landed in the last week" instantly, and no bar chart says that.
 * A quarter or a year draws as one bar per month, because a bar per day across
 * a year is 365 lines a millimetre apart, which is texture rather than
 * information.
 *
 * Same block, two granularities, chosen by what is being read.
 */
export function PeriodShape({ rows, range }: Props) {
  if (range.months === 1) return <DayGrid rows={rows} range={range} />
  return <MonthBars rows={rows} range={range} />
}

/* ---- one month, as a calendar ---- */

const CELL = sp(34)
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function DayGrid({ rows, range }: Props) {
  const month = range.from.slice(0, 7)
  const series = useMemo(
    () => dailySeries(rows, month, daysInMonth(range.from)),
    [rows, month, range.from],
  )
  /* Every day is read against the busiest one, so a quiet month does not
   * light up as though it were a heavy one. */
  const peak = Math.max(1, ...series.map((d) => Math.max(d.creditCents, d.debitCents)))
  const lead = new Date(range.from.replace(/-/g, '/')).getDay()

  return (
    <View style={s.panel}>
      <Text style={s.panelTitle}>The month</Text>

      <View style={s.week}>
        {WEEKDAYS.map((d, i) => (
          <View key={`${d}${i}`} style={s.cell}>
            <Text style={s.weekText}>{d}</Text>
          </View>
        ))}
      </View>

      <View style={s.grid}>
        {Array.from({ length: lead }, (_, i) => (
          <View key={`lead${i}`} style={s.cell} />
        ))}
        {series.map((day, i) => {
          const net = day.creditCents - day.debitCents
          const busiest = Math.max(day.creditCents, day.debitCents)
          const quiet = busiest === 0
          /*
           * Strength by size, hue by direction. A day that took more than it
           * paid reads green, one that paid more reads red, and a day with
           * nothing on it is left as an outline rather than a colour, so the
           * empty days are legible as empty.
           */
          const strength = quiet ? 0 : 0.18 + 0.62 * Math.min(1, busiest / peak)
          const tint = net >= 0 ? '37,224,99' : '255,105,105'
          return (
            <View key={day.date} style={s.cell}>
              <View
                style={[
                  s.disc,
                  quiet
                    ? s.discQuiet
                    : { backgroundColor: `rgba(${tint},${strength.toFixed(2)})` },
                ]}
              >
                <Text style={[s.dayNum, quiet ? s.dayNumQuiet : null]}>{i + 1}</Text>
              </View>
            </View>
          )
        })}
      </View>

      <View style={s.legend}>
        <View style={[s.key, { backgroundColor: 'rgba(37,224,99,0.62)' }]} />
        <Text style={s.legendText}>came out ahead</Text>
        <View style={[s.key, { backgroundColor: 'rgba(255,105,105,0.62)' }]} />
        <Text style={s.legendText}>paid out more</Text>
        <Text style={s.legendPeak}>busiest day {formatCompact(peak)}</Text>
      </View>
    </View>
  )
}

/* ---- a quarter or a year, as one bar per month ---- */

function MonthBars({ rows, range }: Props) {
  const bars = useMemo(() => monthlySeries(rows, range), [rows, range])
  const peak = Math.max(1, ...bars.map((b) => Math.max(b.creditCents, b.debitCents)))

  return (
    <View style={s.panel}>
      <Text style={s.panelTitle}>Month by month</Text>
      <View style={s.bars}>
        {bars.map((bar) => (
          <View key={bar.month} style={s.barCol}>
            <View style={s.barStack}>
              {/* In and out side by side, not stacked: stacked, a big month
                * and a bad month are the same height. */}
              <View
                style={[
                  s.bar,
                  {
                    height: `${(bar.creditCents / peak) * 100}%`,
                    backgroundColor: color.credit,
                  },
                ]}
              />
              <View
                style={[
                  s.bar,
                  {
                    height: `${(bar.debitCents / peak) * 100}%`,
                    backgroundColor: color.debit,
                  },
                ]}
              />
            </View>
            <Text style={s.barLabel}>{bar.label}</Text>
          </View>
        ))}
      </View>
      <Text style={s.legendPeak}>busiest month {formatCompact(peak)}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  panel: {
    borderRadius: radius.soft,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    padding: sp(16),
    gap: sp(12),
  },
  panelTitle: { ...type.chip, color: color.textDim },

  week: { flexDirection: 'row', flexWrap: 'wrap' },
  weekText: { ...type.weekday, color: color.textDim },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sp(3),
  },
  disc: {
    width: CELL,
    height: CELL,
    borderRadius: CELL / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discQuiet: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  dayNum: { ...type.figure, color: color.text },
  dayNumQuiet: { color: color.textDim },

  legend: { flexDirection: 'row', alignItems: 'center', gap: sp(6), flexWrap: 'wrap' },
  key: { width: sp(8), height: sp(8), borderRadius: sp(4) },
  legendText: { ...type.tooltip, color: color.textDim, marginRight: sp(6) },
  legendPeak: { ...type.tooltip, color: color.textDim, marginLeft: 'auto' },

  bars: { flexDirection: 'row', height: sp(120), alignItems: 'flex-end', gap: sp(6) },
  barCol: { flexGrow: 1, flexShrink: 1, flexBasis: 0, alignItems: 'center', gap: sp(6) },
  barStack: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: sp(2),
    alignSelf: 'stretch',
  },
  bar: { width: sp(7), borderRadius: sp(3.5), minHeight: sp(2) },
  barLabel: { ...type.tooltip, color: color.textDim },
})
