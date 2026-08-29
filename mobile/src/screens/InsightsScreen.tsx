import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  Consistency,
  Donut,
  FlowChart,
  INCOME_RAMP,
  Meter,
  Radial,
  SPEND_RAMP,
  VsUsual,
} from '../components/Charts'
import { Mascot } from '../components/Mascot'
import { Panel } from '../components/Panel'
import { PeriodBar } from '../components/PeriodBar'
import { PeriodShape } from '../components/PeriodShape'
import { TickChip } from '../components/TickChip'
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
import { color, figureSize, metric, radius, sp, type } from '../theme'

/**
 * Insights.
 *
 * **The two ledgers ask different questions, so they get different pages.**
 * This app is for freelancers: on the business side the month is decided by
 * whether the invoices landed and who sent them, and what is owed on the
 * result. On the personal side it is decided by where the money went.
 *
 * **The form is Home's, not a dashboard's.** Everything is a `Panel` — the
 * same glass, the same radius 32, the same rim — the totals are the same tick
 * chips the balance card uses, and the pig is here too. The version before
 * this one was right about the content and wrong about all of that: flat grey
 * cards, a palette from nowhere, six identical blocks in a column. It read as
 * a different app, which is exactly what the owner said.
 *
 * **There is no health score.** A score compresses unrelated things into one
 * number, nobody acts differently for being told 83, and for a freelancer the
 * things that decide health — unpaid invoices, a client going quiet — are the
 * things a ledger cannot see. The ring is a comparison, not a grade.
 */

/* What the ring's hole leaves the figure, in frame units. */
const HOLE_W = 120
const HERO_MAX = 34
const HERO_MIN = 15

export function InsightsScreen() {
  const { transactions, scope, taxRate } = useAppState()
  const today = useToday()
  const [period, setPeriod] = useState<Period>('month')
  const [anchor, setAnchor] = useState(today)

  const rows = useMemo(() => filterLedger(transactions, { scope }), [transactions, scope])
  const range = useMemo(() => rangeOf(anchor, period), [anchor, period])
  const prev = useMemo(() => rangeOf(stepPeriod(anchor, period, -1), period), [anchor, period])
  const inRange = useMemo(() => rowsInRange(rows, range), [rows, range])
  const inPrev = useMemo(() => rowsInRange(rows, prev), [rows, prev])
  const totals = useMemo(() => totalsOf(inRange), [inRange])
  const before = useMemo(() => totalsOf(inPrev), [inPrev])

  const business = scope === 'business'
  const lines = useMemo(
    () => (business ? businessLines(inRange, inPrev, range) : personalLines(inRange, inPrev, range)),
    [business, inRange, inPrev, range],
  )

  /* The headline each ledger is actually judged on. */
  const heroCents = business ? totals.netCents : totals.debitCents
  const heroBefore = business ? before.netCents : before.debitCents
  const heroText = formatMoney(heroCents, { forceWhole: true })

  /* The lead chart. A month reads per day; anything longer reads per month —
   * 365 columns a millimetre apart is texture, not information. */
  const flow = useMemo(() => {
    if (range.months === 1) {
      return dailySeries(inRange, range.from.slice(0, 7), daysInMonth(range.from)).map((d, i) => ({
        key: d.date,
        label: `${i + 1}`,
        creditCents: d.creditCents,
        debitCents: d.debitCents,
      }))
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
    const paid = new Set(rows.filter((r) => r.direction === 'credit').map((r) => r.date.slice(0, 7)))
    return Array.from({ length: 12 }, (_, i) => {
      const key = stepPeriod(today, 'month', i - 11).slice(0, 7)
      return { key, paid: paid.has(key) }
    })
  }, [rows, today])

  /* This period against the three before it, per category. */
  const vsUsual = useMemo(() => {
    const nowBy = categoryBreakdown(inRange, 'debit').slice(0, 4)
    const past = [1, 2, 3].map((back) =>
      rowsInRange(rows, rangeOf(stepPeriod(anchor, period, -back), period)),
    )
    return nowBy.map((slice) => {
      const sums = past.map((set) =>
        set
          .filter((r) => r.direction === 'debit' && r.category === slice.category)
          .reduce((sum, r) => sum + r.amountCents, 0),
      )
      const seen = sums.filter((t) => t > 0)
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
  const parts = business
    ? clients.map((c) => ({ key: c.name, name: c.name, cents: c.cents, share: c.share, count: c.count }))
    : spend.map((c) => ({ key: c.category, name: c.category, cents: c.cents, share: c.share, count: c.count }))

  return (
    <View style={s.screen}>
      <PeriodBar
        period={period}
        label={range.label}
        atLatest={range.to >= today}
        onPeriod={setPeriod}
        onStep={(delta) => setAnchor(stepPeriod(anchor, period, delta))}
      />

      {/*
        * The hero. Two arcs against one scale, the figure in the hole, and
        * the period's totals in the chips the balance card already uses.
        *
        * It is one block doing what four did before — headline, delta, chart
        * key and totals — which is most of why the page reads as a page now
        * and not as a list of panels.
        */}
      <Panel
        h={330}
        title={business ? 'Kept this period' : 'Spent this period'}
        aside={<Delta now={heroCents} before={heroBefore} label={prev.label} goodWhenUp={business} />}
      >
        <View style={s.ring}>
          <Radial creditCents={totals.creditCents} debitCents={totals.debitCents}>
            <Text
              style={[
                s.heroFigure,
                { fontSize: sp(figureSize(heroText, HOLE_W, HERO_MAX, HERO_MIN)) },
                heroCents < 0 ? { color: color.debit } : null,
              ]}
              numberOfLines={1}
            >
              {heroText}
            </Text>
          </Radial>
        </View>

        <View style={s.chips}>
          <TickChip kind="credit" label="In" value={formatMoney(totals.creditCents, { forceWhole: true })} />
          <TickChip kind="debit" label="Out" value={formatMoney(totals.debitCents, { forceWhole: true })} />
        </View>
      </Panel>

      {/*
        * The one sentence, said by the pig rather than printed in a box.
        *
        * The owner's complaint about the first two attempts was text — and a
        * paragraph in a panel is text however short it is. In his mouth it is
        * the app talking, it costs no new device (the bubble is the balance
        * card's), and it is the only pink on the page.
        */}
      {lines.length ? (
        <View style={s.say}>
          <Mascot style={s.sayPig} />
          <View style={s.sayBubble}>
            <View style={s.sayTail} />
            <Sentence line={lines[0]} />
          </View>
        </View>
      ) : null}

      <Panel
        title={range.months === 1 ? 'Day by day' : 'Month by month'}
        aside={<Text style={s.aside}>in above, out below</Text>}
      >
        <FlowChart points={flow} />
      </Panel>

      <Panel title={business ? 'Who paid you' : 'Where it went'} h={200}>
        {parts.length === 0 ? (
          <Text style={s.quiet}>
            {business ? 'No payments in this period.' : 'Nothing went out in this period.'}
          </Text>
        ) : (
          <Donut
            slices={parts}
            ramp={business ? INCOME_RAMP : SPEND_RAMP}
            /* The centre carries the concentration, which costs no extra space
             * and is the signal a freelancer actually needs: most of your
             * income coming from one client is a risk, not a triumph. */
            centreValue={`${Math.round((parts[0]?.share ?? 0) * 100)}%`}
            centreLabel={business ? 'top payer' : 'top category'}
          />
        )}
      </Panel>

      {business ? (
        <Panel title="Set aside for tax" h={140}>
          <Meter
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
        </Panel>
      ) : null}

      {/* Paired only where both halves belong to the same question. Income
        * consistency is a freelancer's business signal; on the personal
        * ledger there is no second thing to set beside runway, and half a
        * row of nothing is worse than a full one. */}
      <View style={s.pair}>
        <Panel title="Runway" w={business ? 167 : 345} h={150} style={s.half}>
          <Meter
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
                ? 'nothing going out to measure'
                : `at ${formatMoney(Math.round(runway.perMonth), { forceWhole: true })} a month`
            }
          />
        </Panel>
        {business ? (
          <Panel title="Months paid" w={167} h={150} style={s.half}>
            <Consistency months={consistency} />
          </Panel>
        ) : null}
      </View>

      {!business && vsUsual.length ? (
        <Panel title="Against your usual" h={220}>
          <VsUsual rows={vsUsual} />
        </Panel>
      ) : null}

      <PeriodShape rows={inRange} range={range} />
    </View>
  )
}

/**
 * The change against the period before.
 *
 * **A percentage is only stated when both figures are positive.** A net that
 * crosses zero makes one meaningless: going from +156k to -52k is "down 133%",
 * which is arithmetically true and reads as a third again rather than as a
 * reversal. Where a percentage cannot be trusted the absolute difference is
 * shown instead, which always can be.
 *
 * It names the period it is comparing against — `vs Apr 2026` — rather than
 * saying "the period before", which was six words to avoid one date.
 */
function Delta({
  now,
  before,
  label,
  goodWhenUp,
}: {
  now: number
  before: number
  label: string
  goodWhenUp: boolean
}) {
  if (before === 0 && now === 0) return null
  const diff = now - before
  if (Math.abs(diff) < 100) return <Text style={s.aside}>{`level with ${label}`}</Text>
  const up = diff > 0
  const good = up === goodWhenUp
  const pct = before > 0 && now > 0 ? changeVs(now, before) : null
  const body =
    pct !== null
      ? `${Math.abs(Math.round(pct * 100))}%`
      : formatMoney(Math.abs(diff), { forceWhole: true })
  return (
    <View
      style={[
        s.delta,
        { backgroundColor: good ? 'rgba(37,224,99,0.12)' : 'rgba(255,105,105,0.12)' },
      ]}
    >
      <Text style={[s.deltaText, { color: good ? color.credit : color.debit }]}>
        {`${up ? '↑' : '↓'} ${body} vs ${label}`}
      </Text>
    </View>
  )
}

/** The line, with its figures tinted inline so they carry it. */
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

/*
 * The pig's own geometry, in frame units, read off the sprite rather than
 * guessed: the sheet's window sits 31.5 in from the left of the box it is
 * given, so pulling the box left by that much puts his visible edge on the
 * gutter. The tile is 131.5 tall and he stands in the bottom four fifths of
 * it — the headroom above him is the space the cheer needs for his trotters.
 */
const PIG_INSET = 31.5
const PIG_W = 128.5
const PIG_H = 131.5

const s = StyleSheet.create({
  screen: { paddingHorizontal: metric.gutter, paddingTop: metric.rhythm, gap: sp(16) },

  ring: { alignItems: 'center', paddingVertical: sp(4) },
  /* `fontSize` is set per render by `figureSize`, so it is not fixed here. */
  heroFigure: { ...type.display, color: color.text, textAlign: 'center' },
  chips: { flexDirection: 'row', gap: sp(10) },

  delta: { paddingVertical: sp(5), paddingHorizontal: sp(10), borderRadius: radius.pill },
  deltaText: { ...type.figure },
  aside: { ...type.tooltip, color: color.textDim },

  /* Him and what he says, with no card around it — the page needs one row
   * that is not a panel, or the panels stop being the rhythm and become the
   * texture. */
  say: { flexDirection: 'row', alignItems: 'center', marginVertical: sp(-14) },
  sayPig: { width: sp(PIG_W + PIG_INSET), height: sp(PIG_H), marginLeft: sp(-PIG_INSET) },
  sayBubble: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    marginLeft: sp(4),
    paddingVertical: sp(10),
    paddingHorizontal: sp(12),
    borderRadius: sp(14),
    backgroundColor: color.tooltipBg,
    borderWidth: 1,
    borderColor: color.strokeTooltip,
  },
  /*
   * The balance card's pointer, turned to face left. Same borders trick: a
   * zero-size box whose top and bottom borders are transparent, leaving the
   * right one showing as a point aimed back at him.
   */
  sayTail: {
    position: 'absolute',
    left: sp(-9),
    top: '50%',
    marginTop: sp(-8),
    width: 0,
    height: 0,
    borderTopWidth: sp(8),
    borderBottomWidth: sp(8),
    borderRightWidth: sp(9),
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: color.tooltipBg,
  },
  sentence: { ...type.tooltip, color: color.textSoft, lineHeight: sp(18) },
  inCredit: { color: color.credit },
  inDebit: { color: color.debit },
  inStrong: { color: color.text },

  pair: { flexDirection: 'row', gap: sp(12) },
  half: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },

  quiet: { ...type.figure, color: color.textDim },
})
