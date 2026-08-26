import { useMemo, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BalanceCard } from '../components/BalanceCard'
import { FilterBar } from '../components/FilterBar'
import { TransactionCard } from '../components/TransactionCard'
import { WeekStrip } from '../components/WeekStrip'
import { formatDateHeading, formatMonthYear } from '../lib/dates'
import type { Transaction } from '../lib/types'
import { filterLedger, groupByDate, monthTotals, netBalanceCents } from '../lib/selectors'
import { useAppState, useDispatch, useToday } from '../store'
import type { Arrival } from '../components/Mascot'
import { color, metric, type } from '../theme'

/**
 * Whether a debit is big enough to be worth a reaction.
 *
 * "Bigger than your usual" rather than a fixed figure: a round number is wrong
 * for a quiet month and wrong for a heavy one, and what actually feels notable
 * is an entry out of step with how this person normally spends. Twice the mean
 * debit of the same scope in the same month clears the routine ones.
 *
 * Under three debits to compare against there is no usual yet, so everything
 * counts — better an eager pig than a silent one on a fresh ledger.
 */
function isBigDebit(entry: Transaction, ledger: Transaction[]): boolean {
  const month = entry.date.slice(0, 7)
  const peers = ledger.filter(
    (row) =>
      row.id !== entry.id &&
      row.direction === 'debit' &&
      row.scope === entry.scope &&
      row.date.slice(0, 7) === month,
  )
  if (peers.length < 3) return true
  const mean = peers.reduce((sum, row) => sum + row.amountCents, 0) / peers.length
  return entry.amountCents >= mean * 2
}

/**
 * Bumps a nonce whenever an id appears in the ledger that was not there before.
 *
 * Refs rather than state, and computed during render rather than in an effect:
 * the mascot is handed the result on the same commit the entry arrives on, so
 * its reaction and the new row appear together. An effect would land a frame
 * later and the two would separate.
 *
 * A credit always cheers. A debit only reacts when it is out of the ordinary —
 * otherwise he would wince at every coffee, which is how a character stops
 * being worth watching. That reaction has no clip right now; see below.
 */
function useArrival(rows: Transaction[], ready: boolean): Arrival | undefined {
  const known = useRef<Set<string> | null>(null)
  const armed = useRef(false)
  const last = useRef<Arrival | undefined>(undefined)

  const ids = rows.map((row) => row.id)
  /*
   * Nothing counts as an arrival until the stored ledger has been read back.
   * Until then the set is simply kept current: the seed lands first, then
   * hydration replaces it wholesale, and every entry from a previous session
   * arrives at once. Reacting to that had the mascot celebrating a day-old
   * entry a second after launch — which the driver caught as a cheer nobody
   * had asked for.
   */
  if (!ready || !armed.current) {
    known.current = new Set(ids)
    armed.current = ready
    return last.current
  }
  /* Non-null past the guard above, and narrowed once rather than at each use. */
  const seen = known.current ?? new Set(ids)

  const fresh = rows.find((row) => !seen.has(row.id))
  if (fresh) {
    /*
     * Only credits react at the moment. The covers-his-eyes clip was
     * withdrawn — Kling's take merges his trotters into his cheeks and does
     * not read as hiding — so a big debit deliberately does nothing until a
     * better one is generated. Both debit branches are therefore `null` on
     * purpose: the threshold is the part that was decided and is kept intact,
     * and only the artwork is missing.
     */
    const react: Arrival['kind'] | null =
      fresh.direction === 'credit' ? 'cheer' : isBigDebit(fresh, rows) ? null : null
    known.current = new Set(ids)
    if (react) last.current = { nonce: (last.current?.nonce ?? 0) + 1, kind: react }
  } else if (ids.length !== seen.size) {
    /* A delete. Nothing to react to, but the set must not go stale. */
    known.current = new Set(ids)
  }
  return last.current
}

const RULE: readonly [string, string, string] = [
  'rgba(255,255,255,0)',
  'rgba(255,255,255,0.12)',
  'rgba(255,255,255,0)',
]

export function HomeScreen() {
  const { transactions, scope, selectedDate, query, categories, ready } = useAppState()
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

  /*
   * Whether an entry just *landed*, which is not the same as which row is
   * newest. The ledger re-sorts and re-filters on every scope switch, day
   * pick and search keystroke, so watching the top row would have the mascot
   * react to a filter change. Watching the full ledger's ids means only a
   * genuine arrival counts — and the id it finds carries the direction, so an
   * entry backdated into the middle of the list still reacts as itself.
   */
  const arrival = useArrival(transactions, ready)

  return (
    <View>
      <WeekStrip />
      <BalanceCard
        netCents={net}
        totals={totals}
        monthLabel={formatMonthYear(`${month}-01`)}
        arrival={arrival}
      />
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
