import { useMemo, useState } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { addDays, fromISODate, toISODate } from '../lib/dates'
import type { Transaction } from '../lib/types'
import { capTrim, color, font, radius, sp, type } from '../theme'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'

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
const COL_W = Math.floor(
  ((Dimensions.get('window').width - sp(6) * 2 - 2 - 20 * 2 - sp(28)) / 7) * 100,
) / 100
/** The circle itself, capped so it never outgrows the week strip's. */
const DISC = Math.min(COL_W - sp(6), sp(38))
/** Room under the disc for the mark, so it sits outside rather than over. */
const MARK_ROW = sp(9)

/** Monday first, which is how the reference reads and how a week is worked. */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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

          {/* Year over month, so the month is the thing being read. */}
          <View style={s.title}>
            <Text style={s.year}>{fromISODate(anchor).getFullYear()}</Text>
            <Text style={s.month}>{MONTHS[fromISODate(anchor).getMonth()]}</Text>
          </View>

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
            const isToday = iso === today
            return (
              <Pressable
                key={iso}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen }}
                accessibilityLabel={iso}
                onPress={() => onPick(iso)}
                style={s.col}
              >
                <View
                  style={[
                    s.disc,
                    /* Today is a ring; the chosen day is filled. Both at once
                     * would be two marks saying different things in one place. */
                    !chosen && isToday ? s.discToday : null,
                    chosen ? s.discOn : null,
                  ]}
                >
                  <Text style={[s.day, chosen ? s.dayOn : null]}>
                    {fromISODate(iso).getDate()}
                  </Text>
                </View>
                {/* Under the disc, not over the number. */}
                <View style={s.markRow}>
                  {marked.has(iso) ? <View style={s.mark} /> : null}
                </View>
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
  /*
   * The sheets' own fill and hairline. It was a blur under a warm
   * `rgba(40,34,34,0.86)` wash, which is why it read as a different colour
   * from everything around it — the owner spotted that immediately. Nothing
   * else in this app blurs a panel; the sheets are flat and so is this.
   */
  card: {
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#141414',
    overflow: 'hidden',
    paddingHorizontal: sp(14),
    paddingTop: sp(14),
    paddingBottom: sp(14),
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
  title: { alignItems: 'center', gap: sp(1) },
  year: { fontFamily: font.r400, fontSize: sp(11), color: color.textDim },
  month: { ...type.name, ...capTrim(sp(16)), color: color.text },

  /** One column per weekday, shared by the header and the grid. */
  col: { width: COL_W, alignItems: 'center' },
  week: { flexDirection: 'row', paddingBottom: sp(8) },
  weekText: { fontFamily: font.r500, fontSize: sp(11), color: color.textDim },

  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: sp(6) },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* The week strip's own ring, so today is marked the same way in both. */
  discToday: { borderWidth: 1, borderColor: color.strokeAccent },
  discOn: { backgroundColor: color.accentSolid },
  day: { fontFamily: font.r500, fontSize: sp(15), color: color.textSoft },
  dayOn: { color: color.text },

  markRow: { height: MARK_ROW, alignItems: 'center', justifyContent: 'center' },
  mark: {
    width: sp(4),
    height: sp(4),
    borderRadius: sp(2),
    backgroundColor: color.credit,
  },

  todayButton: {
    marginTop: sp(10),
    height: sp(40),
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  todayText: { ...type.chip, ...capTrim(sp(14)), color: color.text },
})
