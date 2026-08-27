import { useEffect, useMemo, useState } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { CAL_FROM, CAL_IN, CAL_OUT, EASE_SHEET } from '../motion'
import {
  addDays,
  formatMonthYear,
  fromISODate,
  toISODate,
  weekOf,
  weekdayShort,
} from '../lib/dates'
import type { Transaction } from '../lib/types'
import { capTrim, color, metric, radius, sp, type } from '../theme'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'
import { DayCircle } from './WeekStrip'

/*
 * A month, in the week strip's own language: a circle per day, the number
 * inside it, and a mark under the days that carry something.
 *
 * The first cut drew large filled rounded rectangles under a row of chipped
 * weekday labels, on a blurred panel. Three things were wrong with it and the
 * owner named them: the panel was a **different colour from everything else**
 * (a warm `rgba(40,34,34)` wash over a blur, against the app's neutral near
 * black), the cells were heavy enough that a month starting late in the week
 * left a conspicuous hole where its first row should be, and it read as
 * belonging to another app.
 *
 * So it is flat now, in the sheets' own `#141414` with the same hairline, and
 * the cells are circles the size the week strip already uses. Empty leading
 * cells stop being a hole when what surrounds them is light.
 *
 * Measured the way the number pad is, and for the same reason — the sheet
 * floats six clear of either side, draws a border and pads twenty inside it,
 * and a percentage width would take no account of the gaps between the cells.
 */
const PAD = sp(14)
const COL_W = Math.floor(
  ((Dimensions.get('window').width - sp(6) * 2 - 2 - 20 * 2 - sp(44)) / 7) * 100,
) / 100
/**
 * The card's width, **declared rather than inherited**.
 *
 * It had none, and a wrapping grid has no natural width to give it, so the
 * card took everything available — the full screen — while the seven columns
 * only filled the left of it. That left a band of dead space down the right
 * hand side, which is exactly what the owner drew a line beside. Seven columns
 * and the padding is all it ever needs to be.
 */
const BORDER = 1
/*
 * **The border is part of the width.** Without the two pixels below, the
 * content box came out `COL_W * 7 - 2`, seven columns did not fit, and the
 * grid wrapped at six — the whole Saturday column was empty and every date
 * after the first sat one day to the left. HANDOFF has warned about this
 * exact thing since the keypad wrapped to six rows of two.
 */
const CARD_W = COL_W * 7 + PAD * 2 + BORDER * 2
/** Room under the circle for the mark, so it sits outside rather than over. */
const MARK_ROW = sp(9)

/**
 * Sunday first, and the strip's own words for the days.
 *
 * It was Monday first, which is defensible on its own but not beside a week
 * strip that starts on Sunday — one app cannot start its week twice. Taken
 * from `weekOf` rather than written out, so the two orders cannot diverge.
 */
const WEEKDAYS = weekOf('2026-01-01').map(weekdayShort)

/** Sunday-based, matching `weekOf` and therefore the week strip. */
function weekIndex(d: Date): number {
  return d.getDay()
}

function monthGrid(anchor: string): (string | null)[] {
  const first = fromISODate(anchor)
  first.setDate(1)
  const lead = weekIndex(first)
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const iso = toISODate(first)

  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 0; d < days; d += 1) cells.push(addDays(iso, d))
  /* Fill the last row out so the grid keeps its shape. */
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

interface CalendarProps {
  /** The day currently chosen. */
  value: string
  /** Today, so it can be marked even when it is not the one chosen. */
  today: string
  /** The ledger in view, for the marks. */
  ledger: Transaction[]
  onPick: (iso: string) => void
  onClose: () => void
}

/**
 * The date picker, over the sheet rather than inside it.
 *
 * A month will not fit where the number pad sits without the cells dropping
 * under a size a thumb can find, and growing the sheet to hold it would move
 * the form out from under the hand mid-entry. So it covers the sheet instead:
 * nothing behind it resizes, and it goes away leaving everything where it was.
 */
export function Calendar({ value, today, ledger, onPick, onClose }: CalendarProps) {
  const [anchor, setAnchor] = useState(value)

  /*
   * 0 to 1 across the opening.
   *
   * The exit is run **here**, before the caller is told: the parent drops this
   * component the moment it hears, so an animation started after that has
   * nothing left to animate. Every way out therefore goes through `leave`.
   */
  const show = useSharedValue(0)
  useEffect(() => {
    show.set(withTiming(1, { duration: CAL_IN, easing: EASE_SHEET }))
  }, [show])

  const leave = (then: () => void) => {
    show.set(
      withTiming(0, { duration: CAL_OUT, easing: EASE_SHEET }, (done) => {
        'worklet'
        /* scheduleOnRN, not runOnJS — the latter is gone in Reanimated 4. */
        if (done) scheduleOnRN(then)
      }),
    )
  }

  const scrim = useAnimatedStyle(() => ({ opacity: show.get() }))
  const panel = useAnimatedStyle(() => ({
    opacity: show.get(),
    transform: [{ scale: interpolate(show.get(), [0, 1], [CAL_FROM, 1]) }],
  }))
  const cells = useMemo(() => monthGrid(anchor), [anchor])

  /*
   * What each day held, so the month says something before it is read — and
   * says *which way* it went. One green dot for a day that took money in, one
   * red for a day that paid out, both when it did both. A single colour for
   * "something happened" was throwing away the half that matters.
   */
  const marked = useMemo(() => {
    const map = new Map<string, { credit: boolean; debit: boolean }>()
    for (const row of ledger) {
      const at = map.get(row.date) ?? { credit: false, debit: false }
      if (row.direction === 'credit') at.credit = true
      else at.debit = true
      map.set(row.date, at)
    }
    return map
  }, [ledger])

  const shiftMonth = (delta: number) => {
    const d = fromISODate(anchor)
    d.setDate(1)
    d.setMonth(d.getMonth() + delta)
    setAnchor(toISODate(d))
  }

  return (
    <View style={s.root}>
      <Animated.View style={[s.scrim, scrim]} pointerEvents="none" />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => leave(onClose)}
        accessibilityRole="button"
        accessibilityLabel="Dismiss the calendar"
      />

      <Animated.View style={[s.card, panel]}>
        <View style={s.head}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={() => shiftMonth(-1)}
            hitSlop={10}
            style={s.step}
          >
            <ChevronLeftIcon size={sp(18)} color={color.text} />
          </Pressable>

          {/* One line. Stacking the year over the month read as clutter. */}
          <Text style={s.month}>{formatMonthYear(anchor)}</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            onPress={() => shiftMonth(1)}
            hitSlop={10}
            style={s.step}
          >
            <ChevronRightIcon size={sp(18)} color={color.text} />
          </Pressable>
        </View>

        <View style={s.week}>
          {WEEKDAYS.map((d, i) => (
            <View key={`${d}${i}`} style={s.col}>
              <Text style={s.weekText}>{d}</Text>
            </View>
          ))}
        </View>

        <View style={s.grid}>
          {cells.map((iso, i) => {
            if (!iso) return <View key={`gap${i}`} style={s.col} />
            const chosen = iso === value
            return (
              <Pressable
                key={iso}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen }}
                accessibilityLabel={iso}
                onPress={() => leave(() => onPick(iso))}
                style={s.col}
              >
                {/* The week strip's own day, not a copy of it. */}
                <DayCircle
                  iso={iso}
                  selected={chosen}
                  future={iso > today}
                  today={iso === today}
                />
                {/* Under the circle, not over the number. */}
                <View style={s.markRow}>
                  {marked.get(iso)?.credit ? (
                    <View style={[s.mark, s.markCredit]} />
                  ) : null}
                  {marked.get(iso)?.debit ? <View style={[s.mark, s.markDebit]} /> : null}
                </View>
              </Pressable>
            )
          })}
        </View>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  /* Its own layer, so it can fade while the card scales. */
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,4,4,0.55)' },
  /*
   * The sheets' own fill and hairline. It was a blur under a warm
   * `rgba(40,34,34,0.86)` wash, which is why it read as a different colour
   * from everything around it. Nothing else in this app blurs a panel.
   *
   * The width is declared: a wrapping grid has no natural width to give a
   * parent, so the card took the whole screen and left a band of dead space
   * down its right hand side.
   */
  card: {
    width: CARD_W,
    borderRadius: radius.sheet,
    borderWidth: BORDER,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#141414',
    overflow: 'hidden',
    paddingHorizontal: PAD,
    paddingTop: sp(14),
    paddingBottom: sp(16),
  },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: sp(14),
  },
  step: {
    width: sp(32),
    height: sp(32),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  month: { ...type.name, ...capTrim(sp(16)), color: color.text },

  /** One column per weekday, shared by the header and the grid. */
  col: { width: COL_W, alignItems: 'center' },
  week: { flexDirection: 'row', paddingBottom: sp(10) },
  /* The strip's own label style, so the two rows of weekdays match. */
  weekText: { ...type.weekday, color: color.text, textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: sp(8) },

  markRow: {
    height: MARK_ROW,
    flexDirection: 'row',
    gap: sp(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { width: sp(4), height: sp(4), borderRadius: sp(2) },
  markCredit: { backgroundColor: color.credit },
  markDebit: { backgroundColor: color.debit },
})
