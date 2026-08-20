import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
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
import { color, metric, radius, type } from '../theme'

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
  const series = useMemo(() => dailySeries(rows, month, daysInMonth(`${month}-01`)), [rows, month])
  const peak = Math.max(1, ...series.map((day) => Math.max(day.creditCents, day.debitCents)))
  const atLatest = month >= today.slice(0, 7)

  return (
    <View style={s.screen}>
      <View style={s.head}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeftIcon size={20} color={color.text} />
        </Pressable>
        <Text style={s.title}>{formatMonthYear(`${month}-01`)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={atLatest}
          onPress={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRightIcon size={20} color={atLatest ? color.textDim : color.text} />
        </Pressable>
      </View>

      <View style={s.totals}>
        <Stat label="In" value={formatMoney(totals.creditCents)} tint={color.credit} />
        <Stat label="Out" value={formatMoney(totals.debitCents)} tint={color.debit} />
        <Stat label="Net" value={formatMoney(totals.netCents)} tint={color.text} />
      </View>

      <View style={s.panel}>
        <Text style={s.panelTitle}>Daily flow</Text>
        <View
          style={s.chart}
          accessibilityRole="image"
          accessibilityLabel={`Daily money in and out for ${month}`}
        >
          {series.map((day) => (
            <View key={day.date} style={s.col}>
              {day.creditCents > 0 ? (
                <View
                  style={[
                    s.bar,
                    { height: `${(day.creditCents / peak) * 100}%`, backgroundColor: color.credit },
                  ]}
                />
              ) : null}
              {day.debitCents > 0 ? (
                <View
                  style={[
                    s.bar,
                    { height: `${(day.debitCents / peak) * 100}%`, backgroundColor: color.debit },
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>
        <View style={s.axis}>
          <Text style={s.axisText}>1</Text>
          <Text style={s.axisText}>{Math.ceil(series.length / 2)}</Text>
          <Text style={s.axisText}>{series.length}</Text>
        </View>
        <Text style={s.peak}>Peak day {formatCompact(peak)}</Text>
      </View>

      <View style={s.panel}>
        <Text style={s.panelTitle}>Where it went</Text>
        {spend.length === 0 ? (
          <Text style={s.peak}>No spend recorded this month.</Text>
        ) : (
          spend.map((slice) => (
            <View key={slice.category} style={s.row}>
              <View style={s.rowHead}>
                <Text style={s.rowName}>{slice.category}</Text>
                <Text style={s.rowValue}>{formatMoney(slice.cents)}</Text>
              </View>
              <View style={s.track}>
                <View style={[s.fill, { width: `${slice.share * 100}%` }]} />
              </View>
              <Text style={s.rowMeta}>
                {`${Math.round(slice.share * 100)}% · ${slice.count} ${
                  slice.count === 1 ? 'entry' : 'entries'
                }`}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  )
}

function Stat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color: tint }]}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { paddingHorizontal: metric.gutter, paddingTop: metric.rhythm },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  title: { ...type.title, fontSize: 20, color: color.text },
  totals: { flexDirection: 'row', gap: 12, marginTop: 12 },
  stat: { flex: 1, gap: 6 },
  statLabel: { ...type.label, color: color.text, textTransform: 'uppercase' },
  statValue: { fontFamily: type.amount.fontFamily, fontSize: 18 },
  panel: { marginTop: 36 },
  panelTitle: { ...type.title, color: color.text, marginBottom: 20 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 140,
  },
  col: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1, height: '100%' },
  bar: { flex: 1, borderRadius: 1, minHeight: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisText: { ...type.figure, color: color.text },
  peak: { ...type.figure, color: color.textDim, marginTop: 12 },
  row: { marginBottom: 20 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { ...type.name, color: color.text },
  rowValue: { ...type.name, color: color.text },
  track: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 10,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.debit },
  rowMeta: { ...type.figure, color: color.textDim, marginTop: 8 },
})
