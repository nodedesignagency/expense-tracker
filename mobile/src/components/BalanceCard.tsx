import { Image, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { formatMoney } from '../lib/money'
import type { Totals } from '../lib/types'
import { MASCOT_SRC } from '../assets/registry'
import { axisFor, color, fill, metric, radius, rim, sp, type } from '../theme'
import { Glass } from './Glass'

interface BalanceCardProps {
  netCents: number
  totals: Totals
  monthLabel: string
}

/* Frame: 345 x 189, padding 18, inner gap 16, legend gap 10. */
const CARD_W = 345
const CARD_H = 189

function quipFor(totals: Totals, net: number): string {
  if (net > 50_000_00) return 'Holy moly, you are cooking this month'
  if (net > 0) return 'Comfortably in the black this month'
  if (totals.debitCents > totals.creditCents) return 'Spending is outpacing income'
  return 'Keeping your head above water'
}

export function BalanceCard({ netCents, totals, monthLabel }: BalanceCardProps) {
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
          <Text style={s.amount} numberOfLines={1}>
            {formatMoney(netCents)}
          </Text>
        </View>

        <View style={s.legend}>
          <Pill kind="credit" text={`Credit: ${formatMoney(totals.creditCents)}`} />
          <Pill kind="debit" text={`Debit: ${formatMoney(totals.debitCents)}`} />
        </View>
      </View>

      <View style={s.bubble}>
        <Text style={s.bubbleText}>{quipFor(totals, netCents)}</Text>
        <View style={s.bubblePointer} />
      </View>

      <Image source={MASCOT_SRC} style={s.mascot} resizeMode="contain" />
    </Glass>
  )
}

/** The legend pills are square — a 2px coloured edge on the left, no radius. */
function Pill({ kind, text }: { kind: 'credit' | 'debit'; text: string }) {
  const axis = axisFor(fill.chip.deg, 102, 26)
  return (
    <LinearGradient
      colors={fill.chip.colors}
      start={axis.start}
      end={axis.end}
      style={[s.pill, { borderLeftColor: kind === 'credit' ? color.credit : color.debit }]}
    >
      <Text style={s.pillText}>{text}</Text>
    </LinearGradient>
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
  inner: { padding: sp(18), minHeight: sp(CARD_H - 2) },
  body: { gap: sp(16), alignSelf: 'stretch' },
  /*
   * Reserve the bubble's column. It ends 54 from the right edge and is 82
   * wide, so it owns the last 136 of the card — 118 of the content box once
   * the padding is off. The figure is set at 40 and needs 190 of the 191 that
   * leaves it, which is tight by design and has nothing spare, so without this
   * the two simply overlap.
   */
  head: { gap: sp(8), marginRight: sp(54 + 82 - 18) },
  label: { ...type.label, color: color.textDim, textTransform: 'uppercase' },
  amount: { ...type.display, color: color.text },
  legend: { gap: sp(10), alignItems: 'flex-start' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sp(6),
    paddingHorizontal: sp(10),
    borderLeftWidth: sp(2),
  },
  pillText: { ...type.chip, color: color.text },
  /*
   * Anchored to the right edge, not the left. The frame is 345 wide and puts
   * the bubble at x=209 and the mascot at x=185 — offsets that only mean what
   * they should at that width. Measured from the right they hold anywhere: the
   * bubble ends 54 short of the edge, the mascot overhangs it by 36.
   */
  bubble: {
    position: 'absolute',
    right: sp(54),
    top: sp(26),
    width: sp(82),
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
