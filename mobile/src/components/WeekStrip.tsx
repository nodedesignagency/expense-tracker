import { Fragment, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { dayOfMonth, weekdayShort, weekOf } from '../lib/dates'
import { useAppState, useDispatch, useToday } from '../store'
import { color, fill, metric, rim, sp, type } from '../theme'
import { AccentFill } from './Accent'
import { Glass } from './Glass'

/**
 * Sun–Sat day picker. Past and present days read as filled circles; days that
 * haven't happened yet are dashed outlines. Tapping the active day clears the
 * day filter so the full ledger comes back.
 */
export function WeekStrip() {
  const { weekAnchor, selectedDate } = useAppState()
  const dispatch = useDispatch()
  const today = useToday()
  const days = useMemo(() => weekOf(weekAnchor), [weekAnchor])

  return (
    <View style={s.strip}>
      {days.map((iso, index) => {
        const isSelected = iso === selectedDate
        const isFuture = iso > today
        return (
          <Fragment key={iso}>
            {index > 0 ? (
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
                style={s.rule}
                pointerEvents="none"
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${weekdayShort(iso)} ${dayOfMonth(iso)}`}
              style={s.day}
              onPress={() => dispatch({ type: 'selectDate', date: isSelected ? null : iso })}
            >
              <Text style={s.label}>{weekdayShort(iso)}</Text>
              <DayCircle iso={iso} selected={isSelected} future={isFuture} />
            </Pressable>
          </Fragment>
        )
      })}
    </View>
  )
}

function DayCircle({ iso, selected, future }: { iso: string; selected: boolean; future: boolean }) {
  const label = (
    <Text style={[s.dayNum, selected ? { color: color.textBright } : null]}>
      {dayOfMonth(iso)}
    </Text>
  )

  /* The accented day carries its own fill and border, so the rim steps out. */
  if (selected) {
    return (
      <View style={[s.circle, s.circleAccent]}>
        <AccentFill width={metric.day} height={metric.day} />
        <View style={s.above}>{label}</View>
      </View>
    )
  }

  /* So does the dashed one: days that haven't happened yet are outlines only. */
  if (future) {
    return <View style={[s.circle, s.circleFuture]}>{label}</View>
  }

  return (
    <Glass
      rim={rim.soft}
      fill={fill.surface}
      radius={metric.day / 2}
      w={metric.day}
      h={metric.day}
      style={{ width: metric.day, height: metric.day }}
      innerStyle={s.centre}
      stretch
    >
      {label}
    </Glass>
  )
}

const s = StyleSheet.create({
  /* Frame: a 345-wide row of seven 37-wide columns with a 1 x 41 rule between. */
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: metric.rhythm,
    marginHorizontal: metric.gutter,
  },
  day: { alignItems: 'center', gap: sp(8), width: sp(37) },
  label: { ...type.weekday, color: color.text, textAlign: 'center' },
  circle: {
    width: metric.day,
    height: metric.day,
    borderRadius: metric.day / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  circleAccent: { borderWidth: 1, borderColor: color.strokeAccent },
  circleFuture: {
    borderWidth: sp(1.143),
    borderColor: color.strokeDashed,
    borderStyle: 'dashed',
  },
  dayNum: { ...type.day, color: color.text },
  centre: { alignItems: 'center', justifyContent: 'center' },
  /* The accent fill is absolute, so it paints over static siblings. */
  above: { zIndex: 1 },
  rule: { width: 1, height: sp(41) },
})
