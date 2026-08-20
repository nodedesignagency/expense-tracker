import { useEffect, type ComponentType } from 'react'
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useAppState, useDispatch, type Tab } from '../store'
import { EASE_ENTER, EASE_MOVE, MOVE, PRESS } from '../motion'
import { color, fill, metric, radius, rim, sp, type } from '../theme'
import { AccentFill } from './Accent'
import { Glass } from './Glass'
import { PlusIcon } from './Icons'
import { NavGlyph } from './NavGlyph'
import { HomeIcon, ReportIcon, SettingsIcon } from './NavIcons'

interface TabDef {
  id: Tab
  label: string
  /** Outline when idle, the 3D render when selected. */
  Icon: ComponentType<{ size?: number; color?: string }>
  art: ImageSourcePropType
}

const TABS: TabDef[] = [
  { id: 'home', label: 'Home', Icon: HomeIcon, art: require('../../assets/nav/home-3d.png') },
  { id: 'insights', label: 'Insights', Icon: ReportIcon, art: require('../../assets/nav/report-3d.png') },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon, art: require('../../assets/nav/settings-3d.png') },
]

/*
 * The label stacks under the glyph rather than sitting beside it, and that is
 * a measurement, not a preference. A travelling pill needs every destination
 * at a fixed position, which means each one reserves its label's width whether
 * it is showing or not. Beside the glyph, the three labels — 35.8, 46.8 and
 * 49.3 at this size — plus the Add button come to 367 against the 316 a 360pt
 * screen has between its gutters. Stacked, the same three need 274.
 */
const ITEM_W = sp(58)
const ITEM_H = sp(56)
const GAP = sp(5.923)
/** Centre to centre, which is how far the pill travels per destination. */
const STEP = ITEM_W + GAP

/** The whole bar, so the scroll view knows how much room to leave under it. */
export const NAV_HEIGHT = ITEM_H

/**
 * Two floating groups: destinations pinned left, the primary action right.
 *
 * One pill, and it travels. Every destination is the same fixed box, so
 * nothing in the bar ever moves and the selection is a single shape sliding
 * between them.
 *
 * The alternative — each destination carrying its own pill, opening and
 * shutting — cannot be made coherent however well it is eased, because two
 * shapes change at once and neither is the thing that moved.
 */
export function BottomNav({ inset = 0 }: { inset?: number }) {
  const { tab } = useAppState()
  const dispatch = useDispatch()

  const index = Math.max(0, TABS.findIndex((t) => t.id === tab))
  const slide = useSharedValue(index)

  useEffect(() => {
    slide.set(withTiming(index, { duration: MOVE, easing: EASE_MOVE }))
  }, [index, slide])

  const travel = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.get() * STEP }],
  }))

  return (
    <View style={[s.nav, { bottom: sp(24) + inset }]} pointerEvents="box-none">
      <View style={s.group}>
        <Animated.View style={[s.pill, travel]} pointerEvents="none">
          <Glass
            rim={rim.raised}
            fill={fill.navRaised}
            radius={sp(20)}
            w={ITEM_W}
            h={ITEM_H}
            style={s.pillFill}
            stretch
          />
        </Animated.View>

        {TABS.map((def, i) => (
          <NavItem
            key={def.id}
            def={def}
            index={i}
            slide={slide}
            onPress={() => dispatch({ type: 'setTab', tab: def.id })}
          />
        ))}
      </View>

      {/* Add: 84 x 40, radial accent, 25% white edge. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add entry"
        onPress={() => dispatch({ type: 'openComposer' })}
        style={s.add}
      >
        <AccentFill width={sp(84)} height={metric.navH} />
        <View style={s.addContent}>
          <PlusIcon size={sp(12)} color={color.text} />
          <Text style={s.addLabel}>Add</Text>
        </View>
      </Pressable>
    </View>
  )
}

interface NavItemProps {
  def: TabDef
  index: number
  slide: { get: () => number }
  onPress: () => void
}

/**
 * One destination: glyph above its name.
 *
 * Neither is animated on its own clock — both read how near the pill is. A tab
 * a whole step away is idle, one the pill sits on is lit, and everything
 * between follows the shape as it passes. That coupling is what makes the swap
 * and the slide read as a single movement rather than two things that happen
 * to start together.
 *
 * The name holds its space at every state and only changes opacity, so the row
 * cannot shift as the selection moves.
 */
function NavItem({ def, index, slide, onPress }: NavItemProps) {
  const press = useSharedValue(0)

  const swap = useDerivedValue(() => {
    'worklet'
    return 1 - Math.min(Math.abs(slide.get() - index), 1)
  })

  const feedback = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.get(), [0, 1], [1, 0.94], 'clamp') }],
  }))

  /* The name comes up behind the glyph, once the pill is most of the way in. */
  const label = useAnimatedStyle(() => ({
    opacity: interpolate(swap.get(), [0.35, 1], [0, 1], 'clamp'),
  }))

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: index === Math.round(slide.get()) }}
      accessibilityLabel={def.label}
      onPress={onPress}
      onPressIn={() => press.set(withTiming(1, { duration: PRESS, easing: EASE_ENTER }))}
      onPressOut={() => press.set(withTiming(0, { duration: PRESS, easing: EASE_ENTER }))}
      hitSlop={8}
    >
      <Animated.View style={[s.item, feedback]}>
        <NavGlyph swap={swap} Icon={def.Icon} art={def.art} />
        <Animated.Text style={[s.itemLabel, label]} numberOfLines={1}>
          {def.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  /* Frame: two groups floating 24 from the bottom. No container behind either. */
  nav: {
    position: 'absolute',
    left: metric.gutter,
    right: metric.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp(12),
    zIndex: 20,
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: GAP },
  pill: { position: 'absolute', left: 0, top: 0, width: ITEM_W, height: ITEM_H },
  pillFill: { flex: 1 },
  item: {
    width: ITEM_W,
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(4),
  },
  itemLabel: {
    ...type.nav,
    fontSize: sp(11),
    color: color.textBright,
    textAlign: 'center',
  },
  add: {
    width: sp(84),
    height: metric.navH,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.strokeAccent,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(4),
  },
  addContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(4),
    zIndex: 1,
  },
  addLabel: { ...type.nav, fontSize: sp(14), color: color.text },
})
