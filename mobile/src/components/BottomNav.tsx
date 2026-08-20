import { useEffect, useRef, type ComponentType } from 'react'
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native'
import { useAppState, useDispatch, type Tab } from '../store'
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

/** Measured off the reference recording: a crossfade, no scale, no overshoot. */
const DURATION = 220

/** Two floating groups: destinations pinned left, the primary action right. */
export function BottomNav({ inset = 0 }: { inset?: number }) {
  const { tab } = useAppState()
  const dispatch = useDispatch()

  return (
    <View style={[s.nav, { bottom: sp(24) + inset }]} pointerEvents="box-none">
      <View style={s.group}>
        {TABS.map((def) => (
          <NavItem
            key={def.id}
            def={def}
            active={tab === def.id}
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
  onPress: () => void
}

/**
 * One destination.
 *
 * The pill and the label are drawn *over* a container that never changes
 * shape, rather than the item being one component when idle and another when
 * selected. That distinction is the whole animation: swapping the element at
 * this position rebuilds everything under it, so the glyph's crossfade was
 * being handed a fresh value already sitting at its target and had nothing
 * left to play. Keeping the tree stable is what lets it run at all.
 */
function NavItem({ def, active, onPress }: NavItemProps) {
  const lit = useRef(new Animated.Value(active ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(lit, {
      toValue: active ? 1 : 0,
      duration: DURATION,
      useNativeDriver: true,
    }).start()
  }, [active, lit])

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={def.label}
      onPress={onPress}
    >
      <View style={[s.item, active ? s.itemSelected : null]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: lit }]} pointerEvents="none">
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

        <NavGlyph lit={lit} Icon={def.Icon} art={def.art} />

        {active ? (
          <Animated.Text style={[s.itemLabel, { opacity: lit }]} numberOfLines={1}>
            {def.label}
          </Animated.Text>
        ) : null}
      </View>
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
  group: { flexDirection: 'row', alignItems: 'center', gap: sp(5.923) },
  item: {
    minWidth: metric.navH,
    height: metric.navH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(5.923),
  },
  itemSelected: { paddingHorizontal: sp(11.845) },
  pill: { flex: 1 },
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
