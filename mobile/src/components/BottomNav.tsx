import type { ComponentType } from 'react'
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native'
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

/** Two floating groups: destinations pinned left, the primary action right. */
export function BottomNav({ inset = 0 }: { inset?: number }) {
  const { tab } = useAppState()
  const dispatch = useDispatch()

  return (
    <View style={[s.nav, { bottom: sp(24) + inset }]} pointerEvents="box-none">
      <View style={s.group}>
        {TABS.map(({ id, label, art, Icon }) => {
          const active = tab === id
          const glyph = <NavGlyph active={active} Icon={Icon} art={art} />

          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              onPress={() => dispatch({ type: 'setTab', tab: id })}
            >
              {active ? (
                <Glass
                  rim={rim.raised}
                  fill={fill.navRaised}
                  radius={metric.navH / 2}
                  w={96}
                  h={metric.navH}
                  style={{ height: metric.navH }}
                  innerStyle={s.itemActive}
                  stretch
                >
                  {glyph}
                  <Text style={s.itemLabel}>{label}</Text>
                </Glass>
              ) : (
                <View style={s.item}>{glyph}</View>
              )}
            </Pressable>
          )
        })}
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
    width: metric.navH,
    height: metric.navH,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.72,
  },
  itemActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(5.923),
    paddingHorizontal: sp(11.845),
  },
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
