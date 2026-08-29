import { StyleSheet, Text } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { axisFor, color, fill, sp, type } from '../theme'

/**
 * The legend chip: a 2px coloured edge on the left, no radius.
 *
 * Lives here rather than inside the balance card because Insights needs the
 * *same* chip, not one that looks like it. It is the fastest thing on either
 * page to recognise, and two copies would drift the moment one was touched.
 *
 * Square on purpose — every other chip in this app is a pill, and the tick
 * bar is what tells you this one is a reading rather than a control.
 */
export function TickChip({
  kind,
  label,
  value,
}: {
  kind: 'credit' | 'debit'
  label?: string
  value: string
}) {
  const axis = axisFor(fill.chip.deg, 102, 26)
  return (
    <LinearGradient
      colors={fill.chip.colors}
      start={axis.start}
      end={axis.end}
      style={[s.chip, { borderLeftColor: kind === 'credit' ? color.credit : color.debit }]}
    >
      {label ? <Text style={s.label}>{label}</Text> : null}
      <Text style={s.value}>{value}</Text>
    </LinearGradient>
  )
}

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(6),
    paddingVertical: sp(6),
    paddingHorizontal: sp(10),
    borderLeftWidth: sp(2),
  },
  label: { ...type.chip, color: color.textDim },
  value: { ...type.chip, color: color.text },
})
