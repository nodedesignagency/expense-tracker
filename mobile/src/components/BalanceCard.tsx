import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { formatMoney } from '../lib/money'
import type { Totals } from '../lib/types'
import { MASCOT_SRC } from '../assets/registry'
import { color, fill, lightAxis, metric, radius, rim, type } from '../theme'
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
  const { width } = useWindowDimensions()

  /*
   * This card is the one piece of the frame that cannot be made fluid. The
   * figure is set at 40 and needs 190 of the 191 the layout leaves it, and the
   * bubble and mascot are placed by absolute offset — so on any screen narrower
   * than the frame's 393 the figure runs under the bubble and the mascot lands
   * in the wrong place. Every internal measurement is scaled by how much
   * narrower the card actually is, which reproduces the design exactly, just
   * smaller. Wider screens stay at 1: this is a phone layout, and blowing the
   * figure up past 40 is not what it asks for.
   */
  const k = Math.min((width - metric.gutter * 2) / CARD_W, 1)
  const s = scaled(k)

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
          <Pill kind="credit" text={`Credit: ${formatMoney(totals.creditCents)}`} k={k} />
          <Pill kind="debit" text={`Debit: ${formatMoney(totals.debitCents)}`} k={k} />
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
function Pill({ kind, text, k }: { kind: 'credit' | 'debit'; text: string; k: number }) {
  const axis = lightAxis(102, 26)
  return (
    <LinearGradient
      colors={fill.chip}
      start={axis.start}
      end={axis.end}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6 * k,
        paddingHorizontal: 10 * k,
        borderLeftWidth: 2,
        borderLeftColor: kind === 'credit' ? color.credit : color.debit,
      }}
    >
      <Text style={{ ...type.chip, fontSize: 12 * k, color: color.text }}>{text}</Text>
    </LinearGradient>
  )
}

function scaled(k: number) {
  return StyleSheet.create({
    card: {
      marginTop: metric.rhythm,
      marginHorizontal: metric.gutter,
    },
    /*
     * A floor, not a fixed height: the content lands at 187 of the frame's 189,
     * which leaves nothing for a device whose text renders even slightly
     * taller. The surface has to clip to hold the mascot, so anything over the
     * line is lost rather than overflowing — the debit pill first.
     */
    inner: { padding: 18 * k, minHeight: (CARD_H - 2) * k },
    body: { gap: 16 * k, alignSelf: 'stretch' },
    /* Reserve the bubble's column: it ends 54 from the right and is 82 wide. */
    head: { gap: 8 * k, marginRight: (54 + 82 - 18) * k },
    label: { ...type.label, fontSize: 14 * k, color: color.textDim, textTransform: 'uppercase' },
    amount: { ...type.display, fontSize: 40 * k, color: color.text },
    legend: { gap: 10 * k, alignItems: 'flex-start' },
    /*
     * Anchored to the right edge, not the left. The frame is 345 wide and puts
     * the bubble at x=209 and the mascot at x=185 — offsets that only mean what
     * they should at that width. Measured from the right they hold anywhere:
     * the bubble ends 54 short of the edge, the mascot overhangs it by 36.
     */
    bubble: {
      position: 'absolute',
      right: 54 * k,
      top: 26 * k,
      width: 82 * k,
      paddingVertical: 6 * k,
      paddingHorizontal: 8 * k,
      borderRadius: 12 * k,
      backgroundColor: color.tooltipBg,
      borderWidth: 1,
      borderColor: color.strokeTooltip,
      zIndex: 3,
    },
    bubbleText: { ...type.tooltip, fontSize: 10 * k, lineHeight: 14 * k, color: color.text },
    /*
     * The frame's pointer is a clipped triangle. React Native has no clip-path,
     * so it is the standard borders trick: a zero-size box whose side borders
     * are transparent, leaving the top border showing as a downward point.
     */
    bubblePointer: {
      position: 'absolute',
      right: 8 * k,
      bottom: -9 * k,
      width: 0,
      height: 0,
      borderLeftWidth: 8 * k,
      borderRightWidth: 8 * k,
      borderTopWidth: 9 * k,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: color.tooltipBg,
    },
    mascot: {
      position: 'absolute',
      right: -36 * k,
      top: 51 * k,
      width: 196 * k,
      height: 147 * k,
      zIndex: 1,
    },
  })
}
