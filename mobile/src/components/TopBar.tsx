import type { ComponentType } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAppState, useDispatch } from '../store'
import type { Scope } from '../lib/types'
import { color, fill, metric, radius, rim, sp, type } from '../theme'
import { Glass } from './Glass'
import { CalendarIcon, FilterIcon, GridIcon, SearchIcon } from './Icons'

/*
 * Frame: View Toggle is 171 x 34, padding 4, two fixed 79.5 halves with 4
 * between. Both of those have moved on.
 *
 * The height is 38. 34 is the frame's, and against the type as it now sits it
 * read tight; everything inside goes up by the same 1.1176, which puts the
 * toggle's glyph at 15.65 and each action's at 22.35.
 *
 * And the halves hug their own labels rather than splitting the track evenly.
 * At the frame's 12pt a fixed half left seven points of air either side of its
 * name; at 14 it leaves three, which is what made the pair look packed. Sized
 * to what is in them, with ten a side, they come to 94.7 and 92.7 — a 198
 * track, which still clears the three actions by seven at the frame's width.
 *
 * Frame units down as far as TRACK_W, then scaled, the same way the bar does
 * it: solve the fit once at 393 and let the screen shrink the result.
 */
const CONTROL = 38
/** How much bigger than the frame the row is drawn. metric.control is this. */
const LIFT = CONTROL / 34
const TRACK_PAD = 3
const OPT_PAD = 10
const OPT_GAP = 4 * LIFT
const OPT_ICON = 14 * LIFT
const ACTION_ICON = 20 * LIFT

/*
 * The two names at 14pt medium, measured out of the font we ship. The track is
 * built out from them, so they are what the whole row is sized by.
 */
const OPTIONS: { value: Scope; label: string; nameW: number }[] = [
  { value: 'business', label: 'Business', nameW: 54.61 },
  { value: 'personal', label: 'Personal', nameW: 52.6 },
]

const OPT_W = OPTIONS.map((o) => OPT_PAD * 2 + OPT_ICON + OPT_GAP + o.nameW)
const OPT_LEFT = [TRACK_PAD, TRACK_PAD + OPT_W[0] + OPT_GAP]
const TRACK_W = sp(TRACK_PAD * 2 + OPT_W[0] + OPT_GAP + OPT_W[1])
const THUMB_H = sp(CONTROL - TRACK_PAD * 2)

/** Scope switch on the left, three round utility actions on the right. */
export function TopBar() {
  const { scope, searchOpen, filterOpen, categories } = useAppState()
  const dispatch = useDispatch()

  const selected = Math.max(0, OPTIONS.findIndex((o) => o.value === scope))

  return (
    <View style={s.bar}>
      <Glass
        rim={rim.soft}
        fill={fill.track}
        radius={metric.control / 2}
        w={TRACK_W}
        h={metric.control}
        style={{ width: TRACK_W, height: metric.control }}
        innerStyle={s.trackInner}
        stretch
      >
        {/*
          * The lit thumb moves between the two, and takes each one's width
          * with it — they are no longer the same size as each other.
          */}
        <View
          style={[s.thumb, { left: sp(OPT_LEFT[selected]), width: sp(OPT_W[selected]) }]}
          pointerEvents="none"
        >
          <Glass
            rim={rim.raised}
            fill={fill.raised}
            radius={THUMB_H / 2}
            w={sp(OPT_W[selected])}
            h={THUMB_H}
            style={{ flex: 1 }}
            stretch
          />
        </View>

        {OPTIONS.map((option, i) => (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === option.value }}
            style={[s.option, { width: sp(OPT_W[i]) }]}
            onPress={() => dispatch({ type: 'setScope', scope: option.value })}
          >
            <GridIcon size={sp(OPT_ICON)} color={color.text} />
            <Text style={s.optionText} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </Glass>

      <View style={s.actions}>
        <RoundButton
          label="Search entries"
          Icon={SearchIcon}
          active={searchOpen}
          onPress={() => dispatch({ type: 'toggleSearch' })}
        />
        <RoundButton
          label="Filter by category"
          Icon={FilterIcon}
          active={filterOpen || categories.length > 0}
          badge={categories.length || undefined}
          onPress={() => dispatch({ type: 'toggleFilter' })}
        />
        <RoundButton
          label="Jump to today"
          Icon={CalendarIcon}
          onPress={() => dispatch({ type: 'selectDate', date: null })}
        />
      </View>
    </View>
  )
}

interface RoundButtonProps {
  label: string
  /** Each action carries its own glyph — search, filter, today. */
  Icon: ComponentType<{ size?: number; color?: string }>
  onPress: () => void
  active?: boolean
  badge?: number
}

function RoundButton({ label, Icon, onPress, active, badge }: RoundButtonProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {({ pressed }) => (
        <View style={{ transform: [{ scale: pressed ? 0.94 : 1 }] }}>
          <Glass
            rim={rim.button}
            fill={active ? fill.raised : fill.surface}
            radius={metric.control / 2}
            w={metric.control}
            h={metric.control}
            style={{ width: metric.control, height: metric.control }}
            innerStyle={s.centre}
            stretch
          >
            <Icon size={sp(ACTION_ICON)} color={color.text} />
          </Glass>
          {badge ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp(10),
    paddingHorizontal: metric.gutter,
    paddingTop: metric.rhythm,
  },
  trackInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sp(TRACK_PAD),
    gap: sp(OPT_GAP),
  },
  thumb: {
    position: 'absolute',
    top: sp(TRACK_PAD),
    bottom: sp(TRACK_PAD),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(OPT_GAP),
    height: THUMB_H,
  },
  optionText: {
    ...type.chip,
    color: color.text,
  },
  centre: { alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: sp(8) },
  badge: {
    position: 'absolute',
    top: sp(-3),
    right: sp(-3),
    minWidth: sp(16),
    height: sp(16),
    paddingHorizontal: sp(4),
    borderRadius: radius.pill,
    backgroundColor: color.accentSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: 'SFRounded-700', fontSize: sp(10.5), color: '#fff' },
})
