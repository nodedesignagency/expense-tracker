import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BalanceCard } from '../components/BalanceCard'
import { FilterBar } from '../components/FilterBar'
import { TransactionCard } from '../components/TransactionCard'
import { WeekStrip } from '../components/WeekStrip'
import { formatDateHeading, formatMonthYear } from '../lib/dates'
import { filterLedger, groupByDate, monthTotals, netBalanceCents } from '../lib/selectors'
import { useAppState, useDispatch, useToday } from '../store'
import { color, metric, type } from '../theme'

const RULE: readonly [string, string, string] = [
  'rgba(255,255,255,0)',
  'rgba(255,255,255,0.12)',
  'rgba(255,255,255,0)',
]

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
    <View>
      <WeekStrip />
      <BalanceCard netCents={net} totals={totals} monthLabel={formatMonthYear(`${month}-01`)} />
      <FilterBar />

      {/* Each half carries one side of the rule, so the pair reads as one line
          fading out toward both screen edges. */}
      <View style={s.count}>
        <LinearGradient colors={RULE} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.rule} />
        <Text style={s.countText}>
          {`Showing ${scopeRows.length.toLocaleString('en-US')} ${
            scopeRows.length === 1 ? 'Entry' : 'Entries'
          }`}
        </Text>
        <LinearGradient colors={RULE} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.rule} />
      </View>

      {groups.length === 0 ? (
        <Text style={s.empty}>
          {`Nothing here yet.${
            selectedDate ? ' Try another day, or clear the day filter.' : ' Add your first entry.'
          }`}
        </Text>
      ) : (
        groups.map((group) => (
          <View key={group.date} style={s.group}>
            <Text style={s.heading}>{formatDateHeading(group.date)}</Text>
            <View style={s.list}>
              {group.rows.map((row) => (
                <TransactionCard
                  key={row.id}
                  transaction={row}
                  onOpen={(id) => dispatch({ type: 'openDetail', id })}
                />
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  )
}

const s = StyleSheet.create({
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: metric.gutter,
    paddingTop: metric.rhythm,
  },
  rule: { flex: 1, height: 1 },
  countText: { ...type.label, color: color.textDim },
  group: { paddingHorizontal: metric.gutter },
  heading: { ...type.title, color: color.text, paddingTop: metric.rhythm },
  list: { gap: metric.rhythm, marginTop: metric.rhythm },
  empty: {
    paddingVertical: 40,
    paddingHorizontal: metric.gutter,
    textAlign: 'center',
    ...type.label,
    color: color.textDim,
  },
})
