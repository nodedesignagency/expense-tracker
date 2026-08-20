import { Image, StyleSheet, Text, View } from 'react-native'
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
  const pillAxis = lightAxis(102, 26)

  return (
    <Glass
      rim={rim.card}
      fill={fill.card}
      radius={radius.card}
      w={CARD_W}
      h={CARD_H}
      style={s.card}
      innerStyle={s.inner}
      stretch
      accessibilityLabel={`Net balance, ${monthLabel}`}
    >
      <View style={s.body}>
        <View style={s.head}>
          <Text style={s.label}>Net Balance</Text>
          <Text style={s.amount}>{formatMoney(netCents)}</Text>
        </View>

        <View style={s.legend}>
          <Pill kind="credit" text={`Credit: ${formatMoney(totals.creditCents)}`} axis={pillAxis} />
          <Pill kind="debit" text={`Debit: ${formatMoney(totals.debitCents)}`} axis={pillAxis} />
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

interface PillProps {
  kind: 'credit' | 'debit'
  text: string
  axis: ReturnType<typeof lightAxis>
}

/** The legend pills are square — a 2px coloured edge on the left, no radius. */
function Pill({ kind, text, axis }: PillProps) {
  return (
    <LinearGradient
      colors={fill.chip}
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
    height: CARD_H,
  },
  inner: { padding: 18 },
  body: { gap: 16, alignItems: 'flex-start' },
  head: { gap: 8, alignItems: 'flex-start' },
  label: {
    ...type.label,
    color: color.textDim,
    textTransform: 'uppercase',
  },
  amount: { ...type.display, color: color.text },
  legend: { gap: 10, alignItems: 'flex-start' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderLeftWidth: 2,
  },
  pillText: { ...type.chip, color: color.text },
  bubble: {
    position: 'absolute',
    left: 209,
    top: 26,
    width: 82,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
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
    right: 8,
    bottom: -9,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: color.tooltipBg,
  },
  mascot: {
    position: 'absolute',
    left: 185,
    top: 51,
    width: 196,
    height: 147,
    zIndex: 1,
  },
})
