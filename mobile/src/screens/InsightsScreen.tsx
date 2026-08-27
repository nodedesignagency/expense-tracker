import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Consistency, Donut, FlowChart, Meter, VsUsual } from '../components/Charts'
import { PeriodBar } from '../components/PeriodBar'
import { PeriodShape } from '../components/PeriodShape'
import { businessLines, personalLines, type Line } from '../lib/insights'
import { formatMoney } from '../lib/money'
import {
  categoryBreakdown,
  changeVs,
  counterpartyBreakdown,
  dailySeries,
  daysInMonth,
  filterLedger,
  monthlySeries,
  netBalanceCents,
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

  /* The lead chart. A month reads per day; anything longer reads per month —
   * 365 bars a millimetre apart is texture, not information. */
  const flow = useMemo(() => {
    if (range.months === 1) {
      return dailySeries(inRange, range.from.slice(0, 7), daysInMonth(range.from)).map(
        (d, i) => ({
          key: d.date,
          label: `${i + 1}`,
          creditCents: d.creditCents,
          debitCents: d.debitCents,
        }),
      )
    }
    return monthlySeries(inRange, range).map((m) => ({
      key: m.month,
      label: m.label,
      creditCents: m.creditCents,
      debitCents: m.debitCents,
    }))
  }, [inRange, range])

  /*
   * How long the money on hand covers the way it is currently going out.
   *
   * Averaged over six months rather than taken from this one: a freelancer's
   * quiet month would otherwise read as years of runway, and a heavy one as
   * days.
   */
  const runway = useMemo(() => {
    const balance = netBalanceCents(transactions, scope, today)
    const since = stepPeriod(today, 'month', -6)
    const recent = rows.filter((r) => r.date >= since && r.date <= today && r.direction === 'debit')
    const perMonth = recent.reduce((sum, r) => sum + r.amountCents, 0) / 6
    return { balance, perMonth, months: perMonth > 0 ? balance / perMonth : null }
  }, [transactions, rows, scope, today])

  /* Twelve months back from today, lit where anything came in. */
  const consistency = useMemo(() => {
    const paid = new Set(
      rows.filter((r) => r.direction === 'credit').map((r) => r.date.slice(0, 7)),
    )
    return Array.from({ length: 12 }, (_, i) => {
      const key = stepPeriod(today, 'month', i - 11).slice(0, 7)
      return { key, paid: paid.has(key) }
    })
  }, [rows, today])

  /* This period against the three before it, per category. */
  const vsUsual = useMemo(() => {
    const nowBy = categoryBreakdown(inRange, 'debit').slice(0, 4)
    const past = [1, 2, 3].map((back) => rowsInRange(rows, rangeOf(stepPeriod(anchor, period, -back), period)))
    return nowBy.map((slice) => {
      const totals = past.map(
        (set) =>
          set
            .filter((r) => r.direction === 'debit' && r.category === slice.category)
            .reduce((sum, r) => sum + r.amountCents, 0),
      )
      const seen = totals.filter((t) => t > 0)
      return {
        key: slice.category,
        name: slice.category,
        nowCents: slice.cents,
        usualCents: seen.length ? Math.round(seen.reduce((a, b) => a + b, 0) / seen.length) : 0,
      }
    })
  }, [inRange, rows, anchor, period])

  const clients = useMemo(() => counterpartyBreakdown(inRange, 'credit'), [inRange])
  const spend = useMemo(() => categoryBreakdown(inRange, 'debit'), [inRange])

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

      {/* The lead. A chart, not a paragraph — the first cut led with three
        * sentences in a box and the owner's word for it was text-heavy. */}
      <View style={s.panel}>
        <View style={s.flowHead}>
          <Legend tint={color.credit} label="In" value={formatMoney(totals.creditCents, { forceWhole: true })} />
          <Legend tint={color.debit} label="Out" value={formatMoney(totals.debitCents, { forceWhole: true })} />
        </View>
        <FlowChart points={flow} />
      </View>

      {/* One line, as a caption. Three was a wall. */}
      {lines.length ? <Sentence line={lines[0]} /> : null}

      <View style={s.panel}>
        <Text style={s.panelTitle}>{business ? 'Who paid you' : 'Where it went'}</Text>
        {(business ? clients : spend).length === 0 ? (
          <Text style={s.quiet}>
            {business ? 'No payments in this period.' : 'Nothing went out in this period.'}
          </Text>
        ) : (
          <Donut
            slices={
              business
                ? clients.map((c) => ({ key: c.name, name: c.name, cents: c.cents, share: c.share, count: c.count }))
                : spend.map((c) => ({ key: c.category, name: c.category, cents: c.cents, share: c.share, count: c.count }))
            }
            /* The centre carries the concentration, which costs no extra
             * space and is the signal a freelancer actually needs: most of
             * your income coming from one client is a risk, not a triumph. */
            centreValue={`${Math.round(((business ? clients : spend)[0]?.share ?? 0) * 100)}%`}
            /* Short enough to fit the hole. The name it refers to is the
             * first row of the legend, an inch to the right. */
            centreLabel={business ? 'top payer' : 'top category'}
          />
        )}
      </View>

      {business ? (
        <View style={s.panel}>
          <Meter
            label="Set aside for tax"
            value={formatMoney(Math.round(totals.creditCents * taxRate), { forceWhole: true })}
            fill={taxRate}
            tint={color.text}
            note={
              totals.creditCents === 0
                ? 'Nothing invoiced in this period.'
                : `${Math.round(taxRate * 100)}% of the ${formatMoney(totals.creditCents, {
                    forceWhole: true,
                  })} you invoiced. Change the rate in Settings.`
            }
          />
        </View>
      ) : null}

      <View style={s.pair}>
        <View style={[s.panel, s.half]}>
          <Meter
            label="Runway"
            /* A decimal is noise past ten months; nobody plans to 0.1 of one. */
            value={
              runway.months === null
                ? '—'
                : runway.months >= 10
                  ? `${Math.round(runway.months)} mo`
                  : `${runway.months.toFixed(1)} mo`
            }
            /* Six months is the comfortable mark, so the bar fills against it
             * rather than against a total that does not exist. */
            fill={runway.months === null ? 0 : runway.months / 6}
            tint={runway.months !== null && runway.months < 2 ? color.debit : color.credit}
            note={
              runway.months === null
                ? 'Nothing going out to measure against.'
                : `at ${formatMoney(Math.round(runway.perMonth), { forceWhole: true })} a month`
            }
          />
        </View>
        {business ? (
          <View style={[s.panel, s.half]}>
            <Consistency months={consistency} />
          </View>
        ) : null}
      </View>

      {!business && vsUsual.length ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>Against your usual</Text>
          <VsUsual rows={vsUsual} />
        </View>
      ) : null}

      <PeriodShape rows={inRange} range={range} />
    </View>
  )
}

function Legend({ tint, label, value }: { tint: string; label: string; value: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.swatch, { backgroundColor: tint }]} />
      <Text style={s.legendLabel}>{label}</Text>
      <Text style={s.legendValue}>{value}</Text>
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

  /* The chart's own key doubles as the period's totals, so a row of tiles
   * repeating them is not needed. It was, and it was filler. */
  flowHead: { flexDirection: 'row', gap: sp(16) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: sp(6) },
  swatch: { width: sp(8), height: sp(8), borderRadius: sp(2) },
  legendLabel: { ...type.tooltip, color: color.textDim },
  legendValue: { ...type.chip, color: color.text },

  pair: { flexDirection: 'row', gap: sp(10) },
  half: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },

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


})
