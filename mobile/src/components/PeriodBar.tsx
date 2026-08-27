import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Period } from '../lib/selectors'
import { capTrim, color, radius, sp, type } from '../theme'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

interface Props {
  period: Period
  label: string
  /** True at the newest period there is, so forward is refused. */
  atLatest: boolean
  onPeriod: (next: Period) => void
  onStep: (delta: number) => void
}

/**
 * Which window the page is reading, and how to move it.
 *
 * The segmented control is the composer's, mark for mark — this app already
 * has a word for "one of these three" and inventing a second would be two
 * things to keep in step.
 *
 * The range is stepped by a whole period at a time, and the label says which
 * one you are in rather than which dates it spans: `Q1 2026` is what a
 * quarter is called, and `Jan 1 – Mar 31` is the same fact spelled out for
 * nobody's benefit.
 */
export function PeriodBar({ period, label, atLatest, onPeriod, onStep }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous period"
          hitSlop={10}
          style={s.step}
          onPress={() => onStep(-1)}
        >
          <ChevronLeftIcon size={sp(18)} color={color.text} />
        </Pressable>

        <Text style={s.label}>{label}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next period"
          hitSlop={10}
          disabled={atLatest}
          style={[s.step, atLatest ? s.stepOff : null]}
          onPress={() => onStep(1)}
        >
          <ChevronRightIcon size={sp(18)} color={atLatest ? color.textDim : color.text} />
        </Pressable>
      </View>

      <View style={s.segment}>
        {PERIODS.map((p) => {
          const on = p.value === period
          return (
            <Pressable
              key={p.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onPeriod(p.value)}
              style={[s.option, on ? s.optionOn : null]}
            >
              <Text style={[s.optionText, on ? null : s.optionTextOff]}>{p.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { gap: sp(14) },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: {
    width: sp(32),
    height: sp(32),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  stepOff: { backgroundColor: 'rgba(255,255,255,0.03)' },
  label: { ...type.title, ...capTrim(sp(18)), color: color.text },

  /* The composer's own segmented control. */
  segment: {
    flexDirection: 'row',
    padding: sp(3),
    gap: sp(3),
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  option: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    height: sp(32),
    borderRadius: radius.pill,
  },
  optionOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  optionText: { ...type.chip, ...capTrim(sp(14)), color: color.text },
  optionTextOff: { color: color.textDim },
})
