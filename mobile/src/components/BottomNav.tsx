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

const ITEM = metric.navH
const GAP = sp(5.923)
/** Centre to centre, which is how far the pill travels per destination. */
const STEP = ITEM + GAP

/**
 * Two floating groups: destinations pinned left, the primary action right.
 *
 * One pill, and it travels. Every destination is the same fixed-width circle,
 * so nothing in the bar ever moves and the selection is a single shape sliding
 * between them.
 *
 * The alternative — each destination carrying its own pill, opening and
 * shutting — cannot be made coherent however well it is eased, because two
 * shapes are changing at once and neither is the thing that moved. It also
 * forces every neighbour sideways as the active one widens.
 *
 * That is what costs the labels. Holding a position fixed means reserving the
 * label's width whether it is showing or not, and three reserved labels plus
 * the Add button come to 354 against the 316 a 360pt screen has between its
 * gutters. Icons alone need 209.
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
            radius={ITEM / 2}
            w={ITEM}
            h={ITEM}
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
 * One destination.
 *
 * Its glyph is not animated on its own clock — it reads how near the pill is.
 * A tab a whole step away is fully idle, one the pill is sitting on is fully
 * lit, and everything between follows the shape as it passes. That coupling is
 * what makes the swap and the slide read as a single movement rather than two
 * things that happen to start together.
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
  pill: { position: 'absolute', left: 0, top: 0, width: ITEM, height: ITEM },
  pillFill: { flex: 1 },
  item: {
    width: ITEM,
    height: ITEM,
    alignItems: 'center',
    justifyContent: 'center',
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
