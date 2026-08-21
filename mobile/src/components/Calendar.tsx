import { useMemo, useState } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { addDays, formatMonthYear, fromISODate, toISODate } from '../lib/dates'
import type { Transaction } from '../lib/types'
import { capTrim, color, font, radius, sp, type } from '../theme'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'

/*
 * A month, laid out the way the reference does it: seven columns of rounded
 * cells with the weekday over each, the number low in the cell, and a mark on
 * the days that have something on them.
 *
 * Measured the way the number pad is, and for the same reason — the sheet
 * floats six clear of either side, draws a border and pads twenty inside it,
 * and a percentage width would take no account of the gaps between the cells.
 */
const GAP = sp(5)
const INNER_W = Dimensions.get('window').width - sp(6) * 2 - 2 - 20 * 2 - sp(28)
const CELL_W = Math.floor(((INNER_W - GAP * 6) / 7) * 100) / 100
const CELL_H = Math.round(CELL_W * 1.12)

/** Monday first, which is how the reference reads and how a week is worked. */
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

/** Monday-based index: JS puts Sunday at 0, and a ledger week does not. */
function weekIndex(d: Date): number {
  return (d.getDay() + 6) % 7
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
  const cells = useMemo(() => monthGrid(anchor), [anchor])

  /* Which days carry an entry, so the month says something before it is read. */
  const marked = useMemo(() => {
    const set = new Set<string>()
    for (const row of ledger) set.add(row.date)
    return set
  }, [ledger])

  const shiftMonth = (delta: number) => {
    const d = fromISODate(anchor)
    d.setDate(1)
    d.setMonth(d.getMonth() + delta)
    setAnchor(toISODate(d))
  }

  return (
    <View style={s.root}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss the calendar"
      />

      <View style={s.card}>
        <BlurView
          intensity={54}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View style={s.wash} pointerEvents="none" />

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
          {WEEKDAYS.map((d) => (
            <View key={d} style={s.weekCell}>
              <Text style={s.weekText}>{d}</Text>
            </View>
          ))}
        </View>

        <View style={s.grid}>
          {cells.map((iso, i) => {
            if (!iso) return <View key={`gap${i}`} style={s.blank} />
            const chosen = iso === value
            return (
              <Pressable
                key={iso}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen }}
                accessibilityLabel={iso}
                onPress={() => onPick(iso)}
                style={[s.cell, chosen ? s.cellOn : null]}
              >
                {marked.has(iso) ? <View style={s.dot} /> : null}
                <Text style={[s.day, iso === today ? s.dayToday : null]}>
                  {fromISODate(iso).getDate()}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => onPick(today)}
          style={s.todayButton}
        >
          <Text style={s.todayText}>Today</Text>
        </Pressable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,4,4,0.55)',
    zIndex: 10,
  },
  card: {
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    paddingHorizontal: sp(14),
    paddingTop: sp(12),
    paddingBottom: sp(14),
  },
  wash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(40,34,34,0.86)' },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: sp(10),
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

  week: { flexDirection: 'row', gap: GAP, paddingBottom: GAP },
  weekCell: {
    width: CELL_W,
    height: sp(24),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  weekText: { fontFamily: font.r500, fontSize: sp(9.5), color: color.textDim },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  blank: { width: CELL_W, height: CELL_H },
  cell: {
    width: CELL_W,
    height: CELL_H,
    borderRadius: sp(12),
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: sp(6),
  },
  cellOn: { backgroundColor: color.accentSolid },
  /* Top-right, out of the number's way, the way the reference marks a day. */
  dot: {
    position: 'absolute',
    top: sp(6),
    right: sp(6),
    width: sp(5),
    height: sp(5),
    borderRadius: sp(2.5),
    backgroundColor: color.credit,
  },
  day: { fontFamily: font.r500, fontSize: sp(13), color: color.textSoft },
  dayToday: { color: color.text },

  todayButton: {
    marginTop: sp(12),
    height: sp(40),
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  todayText: { ...type.chip, ...capTrim(sp(14)), color: color.text },
})
