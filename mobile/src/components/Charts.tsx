import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg'
import { formatCompact, formatMoney } from '../lib/money'
import { color, sp, type } from '../theme'

/*
 * Charts, in `react-native-svg`, which the app already depends on.
 *
 * Rebuilt twice. The first cut was prose with a number on top. The second was
 * chart-led but drew them in a palette and a material belonging to no part of
 * this app — a blue-purple-teal donut, hairline bars, flat grey panels — and
 * the owner read the result, correctly, as generic.
 *
 * The rule now: **nothing here introduces a colour the app does not already
 * own.** Green is money in, red is money out, `#FF5458` is the accent, and a
 * breakdown ramps away from whichever of those it is made of.
 */

/* Unique ids for the SVG defs. Two of a chart on one screen must not share a
 * gradient, and react-native-svg resolves these globally. */
let seq = 0

/* ------------------------------------------------------------------ *
 * The hero: two arcs, in against out
 * ------------------------------------------------------------------ */

/* Frame units. The hole they leave has to hold the period's figure. */
const RING = 202
const STROKE = 8
const GAP = 11
/** Room around the ring for the glow to fall off in, so it is never clipped. */
const GLOW_PAD = 44

/*
 * The arcs are gauges, not rings: they sweep 270deg with the gap at the foot.
 *
 * A full circle was the first attempt and it was wrong twice over. The larger
 * of the two always closed, so the shape that carried the headline was a solid
 * band saying nothing — and closed, at any weight, it reads as a border drawn
 * round the figure rather than as a measure of it. An arc with a visible
 * beginning and end is legible as a quantity even at a glance.
 */
const SWEEP = 0.75
/** Bottom-left, so 270deg of sweep ends bottom-right and the gap is centred. */
const START_DEG = 135

/**
 * Money in and money out as two concentric arcs, with the headline inside.
 *
 * **Both arcs are drawn against the same peak**, so the larger of the two
 * completes the circle and the smaller reads as its true fraction of it. That
 * comparison is the whole point: an outer ring most of the way round with a
 * short inner one is a good month, at a glance, with no figure read at all.
 *
 * A pie of in-against-out was the obvious alternative and says nothing — two
 * wedges always fill the same circle however the month went.
 *
 * The glow behind is the one piece of pure decoration on the page, and it is
 * still tied to the data: each side's opacity tracks its own share, so a month
 * that barely spent barely reddens.
 */
export function Radial({
  creditCents,
  debitCents,
  children,
}: {
  creditCents: number
  debitCents: number
  children?: ReactNode
}) {
  const size = sp(RING)
  const stroke = sp(STROKE)
  const pad = sp(GLOW_PAD)
  const outerR = (size - stroke) / 2
  const innerR = outerR - stroke - sp(GAP)

  const peak = Math.max(creditCents, debitCents, 1)
  const inShare = Math.min(1, creditCents / peak)
  const outShare = Math.min(1, debitCents / peak)

  const glow = size + pad * 2
  const mid = glow / 2
  const id = `ring${(seq += 1)}`

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        /* The arcs stop at 45deg either side of the foot, so the bottom
         * eighth of the box is always empty. Pull the next thing up into it
         * rather than leaving a hole under the gauge. */
        marginBottom: -sp(RING * 0.11),
      }}
    >
      <View style={[StyleSheet.absoluteFillObject, { margin: -pad }]} pointerEvents="none">
        <Svg width={glow} height={glow}>
          <Defs>
            <Wash id={`${id}in`} tint={color.credit} share={inShare} />
            <Wash id={`${id}out`} tint={color.debit} share={outShare} />
          </Defs>
          {/* Centred outside the ring and glowing inward, so neither wash
            * lands in the hole and greys the figure. */}
          <Circle cx={mid + size * 0.30} cy={mid - size * 0.26} r={size * 0.58} fill={`url(#${id}in)`} />
          <Circle cx={mid - size * 0.26} cy={mid + size * 0.30} r={size * 0.52} fill={`url(#${id}out)`} />
        </Svg>
      </View>

      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Along the sweep: full at the arc's foot, half by its head. Every
            * other surface in this app is a gradient at a stated angle; a flat
            * band of saturated green was the one thing on the page that looked
            * painted on rather than lit. */}
          <LinearGradient id={`${id}arcIn`} gradientUnits="userSpaceOnUse" x1={0} y1={size} x2={size} y2={0}>
            <Stop offset="0" stopColor={color.credit} stopOpacity={1} />
            <Stop offset="1" stopColor={color.credit} stopOpacity={0.5} />
          </LinearGradient>
          <LinearGradient id={`${id}arcOut`} gradientUnits="userSpaceOnUse" x1={0} y1={size} x2={size} y2={0}>
            <Stop offset="0" stopColor={color.debit} stopOpacity={1} />
            <Stop offset="1" stopColor={color.debit} stopOpacity={0.5} />
          </LinearGradient>
        </Defs>
        <Arc cx={size / 2} cy={size / 2} r={outerR} stroke={stroke} tint={`url(#${id}arcIn)`} share={inShare} />
        <Arc cx={size / 2} cy={size / 2} r={innerR} stroke={stroke} tint={`url(#${id}arcOut)`} share={outShare} />
      </Svg>

      <View style={s.hole}>{children}</View>
    </View>
  )
}

/** A soft round wash, strongest where its own side of the ledger is. */
function Wash({ id, tint, share }: { id: string; tint: string; share: number }) {
  return (
    <RadialGradient id={id} cx="50%" cy="50%" r="50%">
      <Stop offset="0" stopColor={tint} stopOpacity={0.10 + 0.20 * share} />
      <Stop offset="0.55" stopColor={tint} stopOpacity={0.05 + 0.10 * share} />
      <Stop offset="1" stopColor={tint} stopOpacity={0} />
    </RadialGradient>
  )
}

/**
 * One gauge arc on its own track.
 *
 * The rotation is done in the dash phase, not with a `rotation` on a `<G>`:
 * react-native-svg's web build turns that into a DOM `transform-origin` and
 * React rejects it on every render. An SVG circle's path begins at three
 * o'clock and runs clockwise, so a dash starting `deg` round from there wants
 * an offset of `c * (1 - deg / 360)`.
 */
function Arc({
  cx,
  cy,
  r,
  stroke,
  tint,
  share,
}: {
  cx: number
  cy: number
  r: number
  stroke: number
  tint: string
  share: number
}) {
  const c = 2 * Math.PI * r
  const offset = c * (1 - START_DEG / 360)
  const span = SWEEP * c
  const lit = Math.max(0, Math.min(1, share)) * span
  return (
    <>
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${span} ${c - span}`}
        strokeDashoffset={offset}
      />
      {lit > 0 ? (
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={tint}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${lit} ${c - lit}`}
          strokeDashoffset={offset}
        />
      ) : null}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * In against out, over time
 * ------------------------------------------------------------------ */

export interface FlowPoint {
  key: string
  label: string
  creditCents: number
  debitCents: number
}

/**
 * Mirrored columns: money in grows up from the line, money out grows down.
 *
 * **Both sides share one scale**, so the heights are comparable across the
 * axis and not only along it. Split scales would draw a $50 day and a $5,000
 * day the same height on opposite sides, which is the one thing a reader will
 * assume is not happening.
 *
 * It replaces paired bars, which at 31 steps were two hairlines per day and
 * unreadable — and which collapsed entirely on the owner's device the moment
 * one entry was an order of magnitude larger than the rest. A single tall
 * column against a floor of short ones is the honest picture of that month;
 * what was wrong was that the short ones rounded away to nothing.
 */
export function FlowChart({
  points,
  height = sp(148),
}: {
  points: FlowPoint[]
  height?: number
}) {
  const peakIn = Math.max(0, ...points.map((p) => p.creditCents))
  const peakOut = Math.max(0, ...points.map((p) => p.debitCents))
  const every = Math.max(1, Math.ceil(points.length / 7))
  const gap = points.length > 16 ? sp(2.5) : sp(5)

  /*
   * **Each half gets the share of the height its own peak is worth**, and
   * scales to that peak inside it. The two work out to the same points per
   * cent — a bar of v in the top is `v/peakIn * (peakIn/total) * H`, which is
   * `v/total * H`, and the bottom reduces the same way — so the sides stay
   * comparable across the axis while neither is left mostly empty. Splitting
   * the height evenly, a month that earned ten times what it spent drew the
   * whole bottom half blank.
   *
   * When one side has nothing at all there is nothing to compare, so the empty
   * side is simply floored to keep the axis off the edge.
   */
  const total = peakIn + peakOut
  const upFrac = total === 0 ? 0.5 : peakIn === 0 ? 0.12 : peakOut === 0 ? 0.88 : peakIn / total

  return (
    <View style={{ gap: sp(6) }}>
      <View style={[s.plot, { height, gap }]}>
        {/* The axis the two sides are measured from, behind the columns. */}
        <View style={[s.zero, { top: `${upFrac * 100}%` }]} pointerEvents="none" />
        {points.map((p) => (
          <View key={p.key} style={s.col}>
            <View style={[s.up, { flexGrow: upFrac }]}>
              <Column cents={p.creditCents} peak={peakIn} tint={color.credit} up />
            </View>
            <View style={[s.down, { flexGrow: 1 - upFrac }]}>
              <Column cents={p.debitCents} peak={peakOut} tint={color.debit} />
            </View>
          </View>
        ))}
      </View>

      {/*
        * Labels are positioned on their column and allowed to overflow it.
        * Laid out *inside* an equal share of the row they wrapped to two
        * lines on the owner's phone — 31 slots across 313 is 10pt, and "16"
        * needs 14. A fixed box centred on the column cannot wrap.
        */}
      <View style={s.axis}>
        {points.map((p, i) =>
          i % every === 0 ? (
            <View
              key={p.key}
              style={[s.tick, { left: `${((i + 0.5) / points.length) * 100}%` }]}
            >
              <Text style={s.tickText} numberOfLines={1}>
                {p.label}
              </Text>
            </View>
          ) : null,
        )}
      </View>
    </View>
  )
}

function Column({
  cents,
  peak,
  tint,
  up,
}: {
  cents: number
  peak: number
  tint: string
  up?: boolean
}) {
  /* A zero stays flat: a floor under nothing draws money that is not there,
   * which across a quiet month is most of the chart. A floor under something
   * is the opposite — it keeps a real day from rounding away beside a big
   * one. */
  if (cents === 0 || peak <= 0) return null
  const r = sp(3)
  return (
    <View
      style={[
        s.bar,
        {
          height: `${(cents / peak) * 100}%`,
          backgroundColor: tint,
          borderTopLeftRadius: up ? r : 0,
          borderTopRightRadius: up ? r : 0,
          borderBottomLeftRadius: up ? 0 : r,
          borderBottomRightRadius: up ? 0 : r,
        },
      ]}
    />
  )
}

/* ------------------------------------------------------------------ *
 * A breakdown, and what it is made of
 * ------------------------------------------------------------------ */

export interface Slice {
  key: string
  name: string
  cents: number
  share: number
  count: number
}

/*
 * Two ramps, each one colour lightened five times.
 *
 * The set before this was blue, purple, teal, orange and pink — five hues this
 * app uses nowhere, on the page that most needed to look like the rest of it.
 * The first replacement swept green through teal to blue, which had the same
 * fault at the far end.
 *
 * Tinting one hue instead keeps every wedge unmistakably the colour of what it
 * is made of. Direction is never ambiguous inside a breakdown — "who paid you"
 * is all credits and "where it went" is all debits — so the ring can wear the
 * ledger's own green or red and say which of the two it is before a word of it
 * has been read. Five steps of lightness tell apart at an 8pt swatch; five
 * steps of hue were only ever telling apart colours the app does not use.
 */
export const INCOME_RAMP = ['#25E063', '#5CE995', '#90F1B9', '#BFF7D6', '#E6FCF0'] as const
export const SPEND_RAMP = ['#FF6969', '#FF8F8F', '#FFB0B0', '#FFCDCD', '#FFE8E8'] as const

/**
 * The gap cut between wedges, in degrees.
 *
 * A ramp of one hue is the right palette for a breakdown and the wrong one for
 * abutting shapes: two adjacent steps of lightness have no edge between them,
 * and three payers of similar size read as one wedge. A gap gives every slice
 * a boundary the palette does not have to carry.
 */
const WEDGE_GAP = 3
const REST = 'rgba(255,255,255,0.16)'

/**
 * A ring with its parts listed beside it.
 *
 * The top five carry their own colour; everything after is one grey wedge,
 * because a ring of eleven colours is a colour wheel and answers nothing.
 */
export function Donut({
  slices,
  ramp,
  centreLabel,
  centreValue,
  size = sp(118),
}: {
  slices: Slice[]
  ramp: readonly string[]
  centreLabel: string
  centreValue: string
  size?: number
}) {
  const top = slices.slice(0, ramp.length)
  const restCents = slices.slice(ramp.length).reduce((sum, x) => sum + x.cents, 0)
  const total = slices.reduce((sum, x) => sum + x.cents, 0)
  const parts = [
    ...top.map((x, i) => ({ ...x, tint: ramp[i] })),
    ...(restCents > 0
      ? [
          {
            key: '__rest',
            name: `${slices.length - top.length} more`,
            cents: restCents,
            share: total === 0 ? 0 : restCents / total,
            count: 0,
            tint: REST,
          },
        ]
      : []),
  ]

  const stroke = size * 0.14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const gap = (WEDGE_GAP / 360) * c
  let offset = 0

  return (
    <View style={s.donutRow}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {parts.map((part) => {
            const span = part.share * c
            /* Never eat a slice whole: a 1% wedge keeps a hairline rather
             * than vanishing into the gap meant to separate it. */
            const length = Math.max(span * 0.35, span - gap)
            const el = (
              <Circle
                key={part.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={part.tint}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${length} ${c - length}`}
                strokeDashoffset={c / 4 - offset}
              />
            )
            offset += span
            return el
          })}
        </Svg>
        {/* Held to the hole rather than to the ring's box, so a long value
          * cannot run out under the wedges. */}
        <View style={s.donutCentre} pointerEvents="none">
          <View style={{ width: size - stroke * 2.4 }}>
            <Text style={s.donutValue} numberOfLines={1} adjustsFontSizeToFit>
              {centreValue}
            </Text>
            <Text style={s.donutLabel} numberOfLines={1}>
              {centreLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.legend}>
        {parts.map((part) => (
          <View key={part.key} style={s.legendRow}>
            <View style={[s.swatch, { backgroundColor: part.tint }]} />
            <Text style={s.legendName} numberOfLines={1}>
              {part.name}
            </Text>
            <Text style={s.legendValue}>{formatCompact(part.cents)}</Text>
            {/* A real payer next to a flat `0%` reads as a bug, not as a
              * rounding. Anything that is there at all says so. */}
            <Text style={s.legendShare}>
              {part.share > 0 && part.share < 0.005 ? '<1%' : `${Math.round(part.share * 100)}%`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ *
 * Small signals
 * ------------------------------------------------------------------ */

/** A figure with a bar under it — anything measured against a comfortable
 *  amount rather than against a total. */
export function Meter({
  value,
  note,
  fill,
  tint,
}: {
  value: string
  note: string
  /** 0 to 1. */
  fill: number
  tint: string
}) {
  return (
    <View style={{ gap: sp(9) }}>
      <Text style={[s.metaValue, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <View style={s.track}>
        <View
          style={[
            s.trackFill,
            { width: `${Math.max(2, Math.min(100, fill * 100))}%`, backgroundColor: tint },
          ]}
        />
      </View>
      <Text style={s.metaNote}>{note}</Text>
    </View>
  )
}

/**
 * Twelve blocks, one per month, lit where money came in.
 *
 * Freelance income is lumpy, and a run of empty months reads as a crisis when
 * it is simply how the work arrives. Seeing eight of twelve lit is what makes
 * it legible instead of alarming.
 */
export function Consistency({ months }: { months: { key: string; paid: boolean }[] }) {
  const lit = months.filter((m) => m.paid).length
  return (
    <View style={{ gap: sp(9) }}>
      <Text style={s.metaValue}>{`${lit} of ${months.length}`}</Text>
      <View style={s.blocks}>
        {months.map((m) => (
          <View key={m.key} style={[s.block, m.paid ? { backgroundColor: color.credit } : null]} />
        ))}
      </View>
      <Text style={s.metaNote}>months with money in</Text>
    </View>
  )
}

/**
 * This period against your own trailing average, per category.
 *
 * The question a raw figure cannot answer: $400 on food is meaningless until
 * you know you usually spend $280.
 */
export function VsUsual({
  rows,
}: {
  rows: { key: string; name: string; nowCents: number; usualCents: number }[]
}) {
  const peak = Math.max(1, ...rows.flatMap((r) => [r.nowCents, r.usualCents]))
  return (
    <View style={{ gap: sp(13) }}>
      {rows.map((r) => {
        const over = r.nowCents > r.usualCents
        const diff = r.usualCents === 0 ? null : (r.nowCents - r.usualCents) / r.usualCents
        return (
          <View key={r.key} style={{ gap: sp(6) }}>
            <View style={s.vsHead}>
              <Text style={s.vsName} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={[s.vsDiff, { color: over ? color.debit : color.credit }]}>
                {diff === null ? 'new' : `${over ? '+' : ''}${Math.round(diff * 100)}%`}
              </Text>
            </View>
            {/* This period solid, the usual as a wider hairline behind it. */}
            <View style={s.vsTrack}>
              <View style={[s.vsUsual, { width: `${Math.max(1, (r.usualCents / peak) * 100)}%` }]} />
              <View
                style={[
                  s.vsNow,
                  {
                    width: `${Math.max(1, (r.nowCents / peak) * 100)}%`,
                    backgroundColor: over ? color.debit : color.credit,
                  },
                ]}
              />
            </View>
            <Text style={s.vsNote}>
              {`${formatMoney(r.nowCents, { forceWhole: true })} · usually ${formatMoney(
                r.usualCents,
                { forceWhole: true },
              )}`}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  hole: { alignItems: 'center', justifyContent: 'center' },

  plot: { flexDirection: 'row', alignItems: 'stretch' },
  zero: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  col: { flexGrow: 1, flexShrink: 1, flexBasis: 0, alignItems: 'center' },
  up: { flexShrink: 1, flexBasis: 0, alignSelf: 'stretch', justifyContent: 'flex-end' },
  down: { flexShrink: 1, flexBasis: 0, alignSelf: 'stretch', justifyContent: 'flex-start' },
  bar: { alignSelf: 'center', width: '100%', maxWidth: sp(26), minHeight: sp(2.5) },

  axis: { height: sp(15) },
  tick: { position: 'absolute', top: 0, width: sp(40), marginLeft: sp(-20), alignItems: 'center' },
  tickText: { ...type.tooltip, color: color.textDim },

  donutRow: { flexDirection: 'row', alignItems: 'center', gap: sp(13) },
  donutCentre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  donutValue: { ...type.name, color: color.text, textAlign: 'center' },
  donutLabel: { ...type.tooltip, color: color.textDim, textAlign: 'center' },
  legend: { flexGrow: 1, flexShrink: 1, flexBasis: 0, gap: sp(9), minWidth: 0 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: sp(6) },
  swatch: { width: sp(8), height: sp(8), borderRadius: sp(2) },
  legendName: { ...type.tooltip, color: color.text, flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  legendValue: { ...type.tooltip, color: color.text },
  legendShare: { ...type.tooltip, color: color.textDim, width: sp(26), textAlign: 'right' },

  metaValue: { ...type.display, fontSize: sp(26), color: color.text },
  metaNote: { ...type.tooltip, color: color.textDim },
  track: { height: sp(6), borderRadius: sp(3), backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: sp(3) },

  blocks: { flexDirection: 'row', gap: sp(4) },
  block: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    height: sp(22),
    borderRadius: sp(3),
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  vsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp(8) },
  vsName: { ...type.chip, color: color.text, flexShrink: 1 },
  vsDiff: { ...type.tooltip },
  vsTrack: { height: sp(10), justifyContent: 'center' },
  vsUsual: {
    position: 'absolute',
    height: sp(10),
    borderRadius: sp(5),
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  vsNow: { height: sp(5), borderRadius: sp(2.5) },
  vsNote: { ...type.tooltip, color: color.textDim },
})
