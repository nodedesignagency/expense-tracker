import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { PeriodBar } from '../components/PeriodBar'
import { PeriodShape } from '../components/PeriodShape'
import { businessLines, personalLines, type Line } from '../lib/insights'
import { formatMoney } from '../lib/money'
import {
  categoryBreakdown,
  changeVs,
  counterpartyBreakdown,
  filterLedger,
  rangeOf,
  rowsInRange,
  stepPeriod,
  totalsOf,
  type Period,
} from '../lib/selectors'
import { useAppState, useToday } from '../store'
import { capTrim, color, figureSize, metric, radius, sp, type } from '../theme'

/**
 * Insights.
 *
 * **The two ledgers ask different questions, so they get different pages.**
 * This app is for freelancers: on the business side the month is decided by
 * whether the invoices landed and who sent them, and what is owed on the
 * result. On the personal side it is decided by where the money went. A
 * single layout serving both meant showing a category breakdown of your own
 * spending where a client list was the thing worth knowing.
 *
 * What they share is the spine — the period, a headline figure, sentences
 * about it, and the shape of the period — and each fills the last block with
 * what its own question needs.
 *
 * **There is no health score.** It was considered and rejected: a score
 * compresses unrelated things into one number, nobody acts differently for
 * being told 83, and for a freelancer the things that decide health — unpaid
 * invoices, a client going quiet, a bill due — are exactly the things a
 * ledger cannot see. The sentences carry the same weight and can be checked.
 */
/* The gutter leaves this for the hero, in frame units. */
const HERO_W = 393 - 24 * 2
const HERO_MAX = 40
const HERO_MIN = 24

export function InsightsScreen() {
  const { transactions, scope, taxRate } = useAppState()
  const today = useToday()
  const [period, setPeriod] = useState<Period>('month')
  const [anchor, setAnchor] = useState(today)

  const rows = useMemo(() => filterLedger(transactions, { scope }), [transactions, scope])
  const range = useMemo(() => rangeOf(anchor, period), [anchor, period])
  const prev = useMemo(
    () => rangeOf(stepPeriod(anchor, period, -1), period),
    [anchor, period],
  )
  const inRange = useMemo(() => rowsInRange(rows, range), [rows, range])
  const inPrev = useMemo(() => rowsInRange(rows, prev), [rows, prev])
  const totals = useMemo(() => totalsOf(inRange), [inRange])
  const before = useMemo(() => totalsOf(inPrev), [inPrev])

  const business = scope === 'business'
  const lines = useMemo(
    () =>
      business ? businessLines(inRange, inPrev, range) : personalLines(inRange, inPrev, range),
    [business, inRange, inPrev, range],
  )

  /* The headline each ledger is actually judged on. */
  const heroCents = business ? totals.netCents : totals.debitCents
  const heroBefore = business ? before.netCents : before.debitCents
  const heroLabel = business ? 'Kept this period' : 'Spent this period'
  const heroText = formatMoney(heroCents)

  const atLatest = range.to >= today

  return (
    <View style={s.screen}>
      <PeriodBar
        period={period}
        label={range.label}
        atLatest={atLatest}
        onPeriod={setPeriod}
        onStep={(delta) => setAnchor(stepPeriod(anchor, period, delta))}
      />

      <View style={s.hero}>
        <Text style={s.heroLabel}>{heroLabel}</Text>
        <Text
          style={[
            s.heroFigure,
            { fontSize: sp(figureSize(heroText, HERO_W, HERO_MAX, HERO_MIN)) },
            { color: heroCents < 0 ? color.debit : color.text },
          ]}
          numberOfLines={1}
        >
          {heroText}
        </Text>
        <Delta now={heroCents} before={heroBefore} goodWhenUp={business} />
      </View>

      <View style={s.split}>
        <Tile label="In" cents={totals.creditCents} tint={color.credit} />
        <Tile label="Out" cents={totals.debitCents} tint={color.debit} />
        <Tile
          label={business ? 'Entries' : 'Net'}
          cents={business ? null : totals.netCents}
          count={business ? totals.count : undefined}
          tint={color.text}
        />
      </View>

      {lines.length ? (
        <View style={s.panel}>
          {lines.map((line) => (
            <Sentence key={line.key} line={line} />
          ))}
        </View>
      ) : null}

      {business ? <TaxCard incomeCents={totals.creditCents} rate={taxRate} /> : null}

      <PeriodShape rows={inRange} range={range} />

      {business ? (
        <Breakdown
          title="Who paid you"
          empty="No payments in this period."
          rows={counterpartyBreakdown(inRange, 'credit').slice(0, 6).map((slice) => ({
            key: slice.name,
            name: slice.name,
            cents: slice.cents,
            share: slice.share,
            count: slice.count,
          }))}
          tint={color.credit}
        />
      ) : (
        <Breakdown
          title="Where it went"
          empty="Nothing went out in this period."
          rows={categoryBreakdown(inRange, 'debit').slice(0, 6).map((slice) => ({
            key: slice.category,
            name: slice.category,
            cents: slice.cents,
            share: slice.share,
            count: slice.count,
          }))}
          tint={color.debit}
        />
      )}
    </View>
  )
}

/**
 * The change against the period before.
 *
 * **A percentage is only stated when both figures are positive.** A net that
 * crosses zero makes one meaningless: going from +156k to -52k is "down 133%",
 * which is arithmetically true and tells you nothing — it reads as a third
 * again rather than as a reversal. Where a percentage cannot be trusted the
 * absolute difference is shown instead, which always can be.
 *
 * Silent when there is nothing to compare against at all: "up 100% from
 * nothing" is arithmetic rather than information.
 */
function Delta({
  now,
  before,
  goodWhenUp,
}: {
  now: number
  before: number
  goodWhenUp: boolean
}) {
  if (before === 0 && now === 0) return null
  const diff = now - before
  if (Math.abs(diff) < 100) {
    return <Text style={s.deltaFlat}>no change on the period before</Text>
  }
  const up = diff > 0
  const good = up === goodWhenUp
  const pct = before > 0 && now > 0 ? changeVs(now, before) : null
  const body =
    pct !== null
      ? `${Math.abs(Math.round(pct * 100))}% on the period before`
      : `${formatMoney(Math.abs(diff), { forceWhole: true })} on the period before`
  return (
    <View
      style={[
        s.delta,
        { backgroundColor: good ? 'rgba(37,224,99,0.12)' : 'rgba(255,105,105,0.12)' },
      ]}
    >
      <Text style={[s.deltaText, { color: good ? color.credit : color.debit }]}>
        {`${up ? '↑' : '↓'} ${body}`}
      </Text>
    </View>
  )
}

function Sentence({ line }: { line: Line }) {
  return (
    <Text style={s.sentence}>
      {line.parts.map((part, i) => (
        <Text
          key={i}
          style={
            part.tint === 'credit'
              ? s.inCredit
              : part.tint === 'debit'
                ? s.inDebit
                : part.tint === 'strong'
                  ? s.inStrong
                  : null
          }
        >
          {part.text}
        </Text>
      ))}
    </Text>
  )
}

/**
 * What to put aside, and what is left after it.
 *
 * The one number a ledger cannot derive: what came in is not what is kept.
 * The rate lives in Settings because it is a standing fact about the person
 * rather than about the period being looked at.
 */
function TaxCard({ incomeCents, rate }: { incomeCents: number; rate: number }) {
  const setAside = Math.round(incomeCents * rate)
  return (
    <View style={[s.panel, s.tax]}>
      <View style={s.taxHead}>
        <Text style={s.panelTitle}>Set aside for tax</Text>
        <Text style={s.taxRate}>{`${Math.round(rate * 100)}%`}</Text>
      </View>
      {/* Whole pounds: cents on a figure you are going to move in one lump
        * is precision nobody acts on. */}
      <Text style={s.taxFigure}>{formatMoney(setAside, { forceWhole: true })}</Text>
      <Text style={s.taxNote}>
        {incomeCents === 0
          ? 'Nothing invoiced in this period, so nothing to reserve.'
          : `of the ${formatMoney(incomeCents)} you invoiced. Change the rate in Settings.`}
      </Text>
    </View>
  )
}

interface Slice {
  key: string
  name: string
  cents: number
  share: number
  count: number
}

function Breakdown({
  title,
  empty,
  rows,
  tint,
}: {
  title: string
  empty: string
  rows: Slice[]
  tint: string
}) {
  return (
    <View style={s.panel}>
      <Text style={s.panelTitle}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={s.quiet}>{empty}</Text>
      ) : (
        rows.map((slice) => (
          <View key={slice.key} style={s.slice}>
            <View style={s.sliceHead}>
              <Text style={s.sliceName} numberOfLines={1}>
                {slice.name}
              </Text>
              <Text style={s.sliceValue}>{formatMoney(slice.cents)}</Text>
            </View>
            <View style={s.track}>
              <View
                style={[
                  s.fill,
                  { width: `${Math.max(2, slice.share * 100)}%`, backgroundColor: tint },
                ]}
              />
            </View>
            <Text style={s.sliceMeta}>
              {`${Math.round(slice.share * 100)}% · ${slice.count} ${
                slice.count === 1 ? 'entry' : 'entries'
              }`}
            </Text>
          </View>
        ))
      )}
    </View>
  )
}

function Tile({
  label,
  cents,
  count,
  tint,
}: {
  label: string
  cents: number | null
  count?: number
  tint: string
}) {
  return (
    <View style={s.tile}>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={[s.tileValue, { color: tint }]} numberOfLines={1}>
        {cents === null ? `${count ?? 0}` : formatMoney(cents)}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { paddingHorizontal: metric.gutter, paddingTop: metric.rhythm, gap: sp(18) },

  hero: { gap: sp(8), alignItems: 'flex-start' },
  heroLabel: { ...type.label, color: color.textDim, textTransform: 'uppercase' },
  /* `fontSize` is set per render by `figureSize`, so it is not fixed here. */
  heroFigure: { ...type.display },
  delta: {
    paddingVertical: sp(5),
    paddingHorizontal: sp(10),
    borderRadius: radius.pill,
  },
  deltaText: { ...type.figure },
  deltaFlat: { ...type.figure, color: color.textDim },

  split: { flexDirection: 'row', gap: sp(10) },
  tile: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    gap: sp(6),
    paddingVertical: sp(12),
    paddingHorizontal: sp(12),
    borderRadius: radius.soft,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  tileLabel: { ...type.tooltip, color: color.textDim },
  tileValue: { ...type.amount },

  panel: {
    borderRadius: radius.soft,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    padding: sp(16),
    gap: sp(12),
  },
  panelTitle: { ...type.chip, color: color.textDim },
  quiet: { ...type.figure, color: color.textDim },

  /* The sentences. Prose is dim so the figures inside it carry the line. */
  sentence: { ...type.label, color: color.textDim, lineHeight: sp(21) },
  inCredit: { color: color.credit, fontFamily: undefined },
  inDebit: { color: color.debit },
  inStrong: { color: color.text },

  tax: { gap: sp(6) },
  taxHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taxRate: { ...type.chip, color: color.text },
  taxFigure: { ...type.display, fontSize: sp(30), ...capTrim(sp(30)), color: color.text },
  taxNote: { ...type.figure, color: color.textDim },

  slice: { gap: sp(6) },
  sliceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp(10) },
  sliceName: { ...type.chip, color: color.text, flexShrink: 1 },
  sliceValue: { ...type.amount, color: color.text },
  track: {
    height: sp(6),
    borderRadius: sp(3),
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: sp(3) },
  sliceMeta: { ...type.tooltip, color: color.textDim },
})
