import { StyleSheet, Text, View } from 'react-native'
import { formatMoney } from '../lib/money'
import type { Totals } from '../lib/types'
import { color, figureSize, fill, metric, radius, rim, sp, type } from '../theme'
import { Glass } from './Glass'
import { Mascot, type Arrival } from './Mascot'
import { TickChip } from './TickChip'

interface BalanceCardProps {
  netCents: number
  totals: Totals
  monthLabel: string
  /** Bumped when an entry lands, so the mascot can react to it. */
  arrival?: Arrival
}

/* Frame: 345 x 189, padding 18, inner gap 16, legend gap 10. */
const CARD_W = 345
const CARD_H = 189
const PAD = 18

/*
 * Where the bubble sits, and how wide it is — declared once, because the
 * figure's column is *derived* from them below. They had drifted: the bubble
 * was widened from 82 to 96 and the reserved column was not, so the bubble
 * had been overlapping the figure by 14 ever since.
 *
 * Moved right and up from the frame's 54/26 on the owner's note that the two
 * were cluttering each other. Right frees room for the figure, since the
 * bubble's left edge comes with it.
 */
const BUBBLE_RIGHT = 38
const BUBBLE_TOP = 10
const BUBBLE_W = 96

/** What the bubble leaves the figure, in frame units. */
const FIGURE_W = CARD_W - PAD * 2 - (BUBBLE_RIGHT + BUBBLE_W - PAD)

const FIGURE_MAX = 40
/* Nine digits and a sign still clear this; below it the figure reads weak. */
const FIGURE_MIN = 24

function quipFor(totals: Totals, net: number): string {
  if (net > 50_000_00) return 'Holy moly, you are cooking this month'
  if (net > 0) return 'Comfortably in the black this month'
  if (totals.debitCents > totals.creditCents) return 'Spending is outpacing income'
  return 'Keeping your head above water'
}

export function BalanceCard({ netCents, totals, monthLabel, arrival }: BalanceCardProps) {
  const net = formatMoney(netCents)

  return (
    <Glass
      rim={rim.card}
      fill={fill.card}
      radius={radius.card}
      w={CARD_W}
      h={CARD_H}
      style={s.card}
      innerStyle={s.inner}
      accessibilityLabel={`Net balance, ${monthLabel}`}
    >
      <View style={s.body}>
        <View style={s.head}>
          <Text style={s.label}>Net Balance</Text>
          <Text style={[s.amount, { fontSize: sp(figureSize(net, FIGURE_W, FIGURE_MAX, FIGURE_MIN)) }]} numberOfLines={1}>
            {net}
          </Text>
        </View>

        <View style={s.legend}>
          {/* Whole strings rather than label + value, so this card reads
              exactly as the frame draws it. Insights splits them instead. */}
          <TickChip kind="credit" value={`Credit: ${formatMoney(totals.creditCents)}`} />
          <TickChip kind="debit" value={`Debit: ${formatMoney(totals.debitCents)}`} />
        </View>
      </View>

      <View style={s.bubble}>
        <Text style={s.bubbleText}>{quipFor(totals, netCents)}</Text>
        <View style={s.bubblePointer} />
      </View>

      <Mascot style={s.mascot} arrival={arrival} />
    </Glass>
  )
}

const s = StyleSheet.create({
  card: {
    marginTop: metric.rhythm,
    marginHorizontal: metric.gutter,
  },
  /*
   * A floor, not a fixed height: the content lands at 187 of the frame's 189,
   * which leaves nothing for a device whose text renders even slightly taller.
   * The surface has to clip to hold the mascot, so anything over the line is
   * lost rather than overflowing — the debit pill first.
   */
  inner: { padding: sp(PAD), minHeight: sp(CARD_H - 2) },
  body: { gap: sp(16), alignSelf: 'stretch' },
  /*
   * Reserve the bubble's column, derived from where the bubble actually is
   * rather than restated. Restated, it went stale the moment the bubble was
   * widened, and the two overlapped for every render after.
   */
  head: { gap: sp(8), marginRight: sp(BUBBLE_RIGHT + BUBBLE_W - PAD) },
  label: { ...type.label, color: color.textDim, textTransform: 'uppercase' },
  /* `fontSize` is set per render by `figureSize`, so it is not fixed here. */
  amount: { ...type.display, color: color.text },
  legend: { gap: sp(10), alignItems: 'flex-start' },
  /*
   * Anchored to the right edge, not the left. The frame is 345 wide and puts
   * the bubble at x=209 and the mascot at x=185 — offsets that only mean what
   * they should at that width. Measured from the right they hold anywhere: the
   * bubble ends 54 short of the edge, the mascot overhangs it by 36.
   */
  bubble: {
    position: 'absolute',
    right: sp(BUBBLE_RIGHT),
    top: sp(BUBBLE_TOP),
    width: sp(BUBBLE_W),
    paddingVertical: sp(6),
    paddingHorizontal: sp(8),
    borderRadius: sp(12),
    backgroundColor: color.tooltipBg,
    borderWidth: 1,
    borderColor: color.strokeTooltip,
    zIndex: 3,
  },
  bubbleText: { ...type.tooltip, color: color.text },
  /*
   * The frame's pointer is a clipped triangle. React Native has no clip-path,
   * so it is the standard borders trick: a zero-size box whose side borders are
   * transparent, leaving the top border showing as a downward point.
   */
  bubblePointer: {
    position: 'absolute',
    right: sp(8),
    bottom: sp(-9),
    width: 0,
    height: 0,
    borderLeftWidth: sp(8),
    borderRightWidth: sp(8),
    borderTopWidth: sp(9),
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: color.tooltipBg,
  },
  mascot: {
    position: 'absolute',
    right: sp(-36),
    top: sp(51),
    width: sp(196),
    height: sp(147),
    zIndex: 1,
  },
})
