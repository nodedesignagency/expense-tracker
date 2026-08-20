import { useEffect, useState, type ComponentType } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useAppState, useDispatch, type Tab } from '../store'
import { EASE_ENTER, EASE_MOVE, MOVE, PRESS, SWAP } from '../motion'
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

/* Frame: the pill pads 11.845 and sets the glyph 5.923 from its label. */
const PAD = sp(11.845)
const GAP = sp(5.923)
const GLYPH = sp(20)
/** Collapsed, the item is a circle with the glyph centred in it. */
const TUCKED = (metric.navH - GLYPH) / 2

/** Two floating groups: destinations pinned left, the primary action right. */
export function BottomNav({ inset = 0 }: { inset?: number }) {
  const { tab } = useAppState()
  const dispatch = useDispatch()
  const [labels, setLabels] = useState<Partial<Record<Tab, number>>>({})

  const measure = (id: Tab) => (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout
    setLabels((prev) => (prev[id] === width ? prev : { ...prev, [id]: width }))
  }

  return (
    <View style={[s.nav, { bottom: sp(24) + inset }]} pointerEvents="box-none">
      {/*
       * The pill has to know how wide its label is before it opens, or it can
       * only snap. Measured once, off-screen, at natural size — inside the
       * item the text would be squeezed by the very width being measured for.
       */}
      <View style={s.ruler} pointerEvents="none">
        {TABS.map((def) => (
          <Text key={def.id} style={s.itemLabel} numberOfLines={1} onLayout={measure(def.id)}>
            {def.label}
          </Text>
        ))}
      </View>

      <View style={s.group}>
        {TABS.map((def) => (
          <NavItem
            key={def.id}
            def={def}
            active={tab === def.id}
            labelWidth={labels[def.id] ?? 0}
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
  active: boolean
  labelWidth: number
  onPress: () => void
}

/**
 * One destination.
 *
 * Two values rather than one. The pill's shape moves on screen and wants an
 * ease-in-out; the glyph enters and leaves and wants an ease-out. Sharing a
 * curve makes one of them wrong, and the swap was reading clunky because the
 * shape had the glyph's curve — most of a fifty-point width change landing in
 * the first few frames.
 *
 * The item's own width is never animated. Only the label's clip is, and the
 * row grows to fit it — one animated property instead of three kept in step,
 * and no chance of the padding and the width disagreeing mid-flight.
 */
function NavItem({ def, active, labelWidth, onPress }: NavItemProps) {
  const move = useSharedValue(active ? 1 : 0)
  const swap = useSharedValue(active ? 1 : 0)
  const press = useSharedValue(0)

  useEffect(() => {
    const to = active ? 1 : 0
    move.set(withTiming(to, { duration: MOVE, easing: EASE_MOVE }))
    swap.set(withTiming(to, { duration: SWAP, easing: EASE_ENTER }))
  }, [active, move, swap])

  const shell = useAnimatedStyle(() => ({
    paddingLeft: interpolate(move.get(), [0, 1], [TUCKED, PAD], 'clamp'),
    paddingRight: interpolate(move.get(), [0, 1], [TUCKED, PAD], 'clamp'),
    transform: [{ scale: interpolate(press.get(), [0, 1], [1, 0.97], 'clamp') }],
  }))

  const pill = useAnimatedStyle(() => ({ opacity: move.get() }))

  /* The clip carries the gap, so it closes to nothing along with the label. */
  const clip = useAnimatedStyle(() => ({
    width: labelWidth ? interpolate(move.get(), [0, 1], [0, GAP + labelWidth], 'clamp') : 0,
  }))

  /* The label follows the glyph in rather than arriving with it. */
  const label = useAnimatedStyle(() => ({
    opacity: interpolate(swap.get(), [0.45, 1], [0, 1], 'clamp'),
  }))

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={def.label}
      onPress={onPress}
      onPressIn={() => press.set(withTiming(1, { duration: PRESS, easing: EASE_ENTER }))}
      onPressOut={() => press.set(withTiming(0, { duration: PRESS, easing: EASE_ENTER }))}
      hitSlop={8}
    >
      <Animated.View style={[s.item, shell]}>
        <Animated.View style={[StyleSheet.absoluteFill, pill]} pointerEvents="none">
          <Glass
            rim={rim.raised}
            fill={fill.navRaised}
            radius={metric.navH / 2}
            w={96}
            h={metric.navH}
            style={s.pill}
            stretch
          />
        </Animated.View>

        <NavGlyph swap={swap} Icon={def.Icon} art={def.art} />

        {/*
         * Only the label is clipped. The item cannot be, because the bloom
         * behind the glyph is wider than the pill is tall and would be sliced
         * flat top and bottom.
         */}
        <Animated.View style={[s.labelClip, clip]}>
          <Animated.Text
            style={[s.itemLabel, label, { marginLeft: GAP, width: labelWidth || undefined }]}
            numberOfLines={1}
          >
            {def.label}
          </Animated.Text>
        </Animated.View>
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
  ruler: { position: 'absolute', left: -9999, top: 0, flexDirection: 'row', opacity: 0 },
  group: { flexDirection: 'row', alignItems: 'center', gap: GAP },
  item: {
    minWidth: metric.navH,
    height: metric.navH,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: metric.navH / 2,
  },
  pill: { flex: 1 },
  labelClip: { overflow: 'hidden', justifyContent: 'center', height: '100%' },
  itemLabel: { ...type.nav, color: color.textBright },
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
