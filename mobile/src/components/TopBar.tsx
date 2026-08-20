import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAppState, useDispatch } from '../store'
import type { Scope } from '../lib/types'
import { color, fill, metric, radius, rim, type } from '../theme'
import { Glass } from './Glass'
import { GridIcon, SearchIcon } from './Icons'

const SCOPES: Scope[] = ['business', 'personal']

/* Frame: View Toggle is 171 x 34, padding 4, two 79.5 halves with 4 between. */
const TRACK_W = 171
const HALF_W = (TRACK_W - 8 - 4) / 2

/** Scope switch on the left, three round utility actions on the right. */
export function TopBar() {
  const { scope, searchOpen, filterOpen, categories } = useAppState()
  const dispatch = useDispatch()

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
        {/* The lit thumb slides between the halves. */}
        <View
          style={[s.thumb, { left: scope === 'business' ? 3 : 3 + HALF_W + 4 }]}
          pointerEvents="none"
        >
          <Glass
            rim={rim.raised}
            fill={fill.raised}
            radius={13}
            w={HALF_W}
            h={26}
            style={{ flex: 1 }}
            stretch
          />
        </View>

        {SCOPES.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === value }}
            style={[s.option, { width: HALF_W }]}
            onPress={() => dispatch({ type: 'setScope', scope: value })}
          >
            <GridIcon size={14} color={color.text} />
            <Text style={s.optionText}>{value === 'business' ? 'Business' : 'Personal'}</Text>
          </Pressable>
        ))}
      </Glass>

      <View style={s.actions}>
        <RoundButton
          label="Search entries"
          active={searchOpen}
          onPress={() => dispatch({ type: 'toggleSearch' })}
        />
        <RoundButton
          label="Filter by category"
          active={filterOpen || categories.length > 0}
          badge={categories.length || undefined}
          onPress={() => dispatch({ type: 'toggleFilter' })}
        />
        <RoundButton
          label="Jump to today"
          onPress={() => dispatch({ type: 'selectDate', date: null })}
        />
      </View>
    </View>
  )
}

interface RoundButtonProps {
  label: string
  onPress: () => void
  active?: boolean
  badge?: number
}

function RoundButton({ label, onPress, active, badge }: RoundButtonProps) {
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
            <SearchIcon size={20} color={color.text} />
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
    gap: 10,
    paddingHorizontal: metric.gutter,
    paddingTop: metric.rhythm,
  },
  trackInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    gap: 4,
  },
  thumb: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: HALF_W,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 26,
  },
  optionText: {
    ...type.chip,
    color: color.text,
  },
  centre: { alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: color.accentSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: 'SFRounded-700', fontSize: 10.5, color: '#fff' },
})
