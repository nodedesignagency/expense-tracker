import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { formatCompact, formatMoney } from '../lib/money'
import { color, radius, sp, type } from '../theme'

/*
 * Charts, in `react-native-svg`, which the app already depends on.
 *
 * The page these serve was rebuilt because the first cut was prose with a
 * number on top: three sentences in a box, three tiles of raw figures, and one
 * shape on the whole screen. The references the owner sent are the inverse —
 * a chart leads, and the words are a caption.
 */

/* ------------------------------------------------------------------ *
 * In against out, over time — the page's lead
 * ------------------------------------------------------------------ */

export interface FlowPoint {
  key: string
  label: string
  creditCents: number
  debitCents: number
}

/**
 * Paired bars per step: money in, money out, side by side.
 *
 * **Side by side rather than stacked.** Stacked, a month that earned and spent
 * heavily is the same height as one that did neither, and the gap between the
 * two — which is the whole point — cannot be seen at all.
 *
 * Only every `stride`th label is drawn. A month has 31 steps and seven labels
 * fit; printing all of them is a grey smear that reads as texture.
 */
export function FlowChart({
  points,
  height = sp(150),
  stride,
}: {
  points: FlowPoint[]
  height?: number
  stride?: number
}) {
  const peak = Math.max(1, ...points.flatMap((p) => [p.creditCents, p.debitCents]))
  const every = stride ?? Math.max(1, Math.ceil(points.length / 7))
  /* Gaps scale with the step count so a year does not become hairlines. */
  const gap = points.length > 16 ? sp(1.5) : sp(3)

  return (
    <View style={{ gap: sp(8) }}>
      <View style={[s.plot, { height }]}>
        {points.map((p) => (
          <View key={p.key} style={[s.step, { gap }]}>
            <Bar cents={p.creditCents} peak={peak} tint={color.credit} />
            <Bar cents={p.debitCents} peak={peak} tint={color.debit} />
          </View>
        ))}
      </View>
      <View style={s.axis}>
        {points.map((p, i) => (
          <View key={p.key} style={s.axisSlot}>
            <Text style={s.axisText}>{i % every === 0 ? p.label : ''}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function Bar({ cents, peak, tint }: { cents: number; peak: number; tint: string }) {
  /* A zero stays flat. A minimum height on nothing draws money that is not
   * there, which on a chart of a quiet month is most of the chart. */
  const pct = cents === 0 ? 0 : Math.max(3, (cents / peak) * 100)
  return (
    <View
      style={{
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        height: `${pct}%`,
        backgroundColor: tint,
        borderTopLeftRadius: sp(2),
        borderTopRightRadius: sp(2),
      }}
    />
  )
}

/* ------------------------------------------------------------------ *
 * A donut, and what it is made of
 * ------------------------------------------------------------------ */

export interface Slice {
  key: string
  name: string
  cents: number
  share: number
  count: number
}

/*
 * Enough hues to tell five slices apart, and a grey for whatever is left.
 * Deliberately not the ledger's own green and red: those two mean direction
 * everywhere else in this app, and a category wearing them would be read as
 * money coming in.
 */
const WEDGES = ['#5B8CFF', '#B58BFF', '#4FD1C5', '#FFB86B', '#FF7EB6']
const REST = 'rgba(255,255,255,0.16)'

/**
 * A ring with the headline in the middle and its parts listed beside it.
 *
 * The top five carry their own colour; everything after is summed into one
 * grey wedge, because a donut of eleven slices is a colour wheel and answers
 * nothing.
 *
 * Drawn with `strokeDasharray` on one circle per wedge rather than as arc
 * paths: no trigonometry to get wrong, and the rounding never leaves a seam.
 */
export function Donut({
  slices,
  centreLabel,
  centreValue,
  size = sp(132),
}: {
  slices: Slice[]
  centreLabel: string
  centreValue: string
  size?: number
}) {
  const top = slices.slice(0, WEDGES.length)
  const restCents = slices.slice(WEDGES.length).reduce((sum, x) => sum + x.cents, 0)
  const total = slices.reduce((sum, x) => sum + x.cents, 0)
  const parts = [
    ...top.map((x, i) => ({ ...x, tint: WEDGES[i] })),
    ...(restCents > 0
      ? [{
          key: '__rest',
          name: `${slices.length - top.length} more`,
          cents: restCents,
          share: total === 0 ? 0 : restCents / total,
          count: 0,
          tint: REST,
        }]
      : []),
  ]

  const stroke = size * 0.15
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  let offset = 0

  return (
    <View style={s.donutRow}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {parts.map((part) => {
            const length = part.share * circumference
            const el = (
              <Circle
                key={part.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={part.tint}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${length} ${circumference - length}`}
                /*
                 * The quarter turn starts the first wedge at twelve o'clock
                 * rather than at three, where an SVG circle begins.
                 *
                 * Done in the dash phase rather than with a `rotation` on a
                 * `<G>`: react-native-svg's web build turns that into a DOM
                 * `transform-origin`, which React rejects on every render.
                 * There is nothing to rotate this way.
                 */
                strokeDashoffset={circumference / 4 - offset}
              />
            )
            offset += length
            return el
          })}
        </Svg>
        <View style={s.donutCentre} pointerEvents="none">
          <Text style={s.donutValue} numberOfLines={1}>
            {centreValue}
          </Text>
          <Text style={s.donutLabel} numberOfLines={1}>
            {centreLabel}
          </Text>
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
            <Text style={s.legendShare}>{`${Math.round(part.share * 100)}%`}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ *
 * Small signals
 * ------------------------------------------------------------------ */

/** A figure with a bar under it — runway, and anything else measured against
 *  a comfortable amount rather than against a total. */
export function Meter({
  label,
  value,
  note,
  fill,
  tint,
}: {
  label: string
  value: string
  note: string
  /** 0 to 1. */
  fill: number
  tint: string
}) {
  return (
    <View style={{ gap: sp(8) }}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={[s.metaValue, { color: tint }]}>{value}</Text>
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
 * it is simply how the work arrives. Seeing eight of twelve lit is the thing
 * that makes it legible instead of alarming.
 */
export function Consistency({ months }: { months: { key: string; paid: boolean }[] }) {
  const lit = months.filter((m) => m.paid).length
  return (
    <View style={{ gap: sp(8) }}>
      <Text style={s.metaLabel}>Months with income</Text>
      <Text style={s.metaValue}>{`${lit} of ${months.length}`}</Text>
      <View style={s.blocks}>
        {months.map((m) => (
          <View
            key={m.key}
            style={[s.block, m.paid ? { backgroundColor: color.credit } : null]}
          />
        ))}
      </View>
    </View>
  )
}

/**
 * This period against your own trailing average, per category.
 *
 * The question a raw figure cannot answer: £400 on food is meaningless until
 * you know you usually spend £280.
 */
export function VsUsual({
  rows,
}: {
  rows: { key: string; name: string; nowCents: number; usualCents: number }[]
}) {
  const peak = Math.max(1, ...rows.flatMap((r) => [r.nowCents, r.usualCents]))
  return (
    <View style={{ gap: sp(12) }}>
      {rows.map((r) => {
        const over = r.nowCents > r.usualCents
        const diff = r.usualCents === 0 ? null : (r.nowCents - r.usualCents) / r.usualCents
        return (
          <View key={r.key} style={{ gap: sp(5) }}>
            <View style={s.vsHead}>
              <Text style={s.vsName} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={[s.vsDiff, { color: over ? color.debit : color.credit }]}>
                {diff === null
                  ? 'new'
                  : `${over ? '+' : ''}${Math.round(diff * 100)}%`}
              </Text>
            </View>
            {/* This period solid, the usual as a hairline behind it. */}
            <View style={s.vsTrack}>
              <View
                style={[
                  s.vsUsual,
                  { width: `${Math.max(1, (r.usualCents / peak) * 100)}%` },
                ]}
              />
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
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: sp(2) },
  step: { flexGrow: 1, flexShrink: 1, flexBasis: 0, flexDirection: 'row', alignItems: 'flex-end', height: '100%' },
  axis: { flexDirection: 'row' },
  axisSlot: { flexGrow: 1, flexShrink: 1, flexBasis: 0, alignItems: 'center' },
  axisText: { ...type.tooltip, color: color.textDim },

  donutRow: { flexDirection: 'row', alignItems: 'center', gap: sp(14) },
  donutCentre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  donutValue: { ...type.name, color: color.text },
  donutLabel: { ...type.tooltip, color: color.textDim },
  legend: { flexGrow: 1, flexShrink: 1, flexBasis: 0, gap: sp(8), minWidth: 0 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: sp(7) },
  swatch: { width: sp(8), height: sp(8), borderRadius: sp(2) },
  legendName: { ...type.tooltip, color: color.text, flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  legendValue: { ...type.tooltip, color: color.text },
  legendShare: { ...type.tooltip, color: color.textDim, width: sp(30), textAlign: 'right' },

  metaLabel: { ...type.chip, color: color.textDim },
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

export { radius }
