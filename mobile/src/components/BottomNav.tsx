import type { ComponentType } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { HOME_GLYPH_SRC } from '../assets/registry'
import { useAppState, useDispatch, type Tab } from '../store'
import { color, fill, metric, radius, rim, type } from '../theme'
import { AccentFill } from './Accent'
import { Glass } from './Glass'
import { ChartIcon, PlusIcon, SettingsIcon } from './Icons'

interface TabDef {
  id: Tab
  label: string
  /** The home destination uses the 3D glyph; the rest are inline vectors. */
  art?: number
  Icon?: ComponentType<{ size?: number; color?: string }>
}

const TABS: TabDef[] = [
  { id: 'home', label: 'Home', art: HOME_GLYPH_SRC as number },
  { id: 'insights', label: 'Insights', Icon: ChartIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
]

/** Two floating groups: destinations pinned left, the primary action right. */
export function BottomNav({ inset = 0 }: { inset?: number }) {
  const { tab } = useAppState()
  const dispatch = useDispatch()

  return (
    <View style={[s.nav, { bottom: 24 + inset }]} pointerEvents="box-none">
      <View style={s.group}>
        {TABS.map(({ id, label, art, Icon }) => {
          const active = tab === id
          const glyph = (
            <View style={s.glyph}>
              {art ? (
                /* The 3D house is drawn oversized and spills past its box. */
                <Image source={art} style={s.glyphArt} resizeMode="contain" />
              ) : Icon ? (
                <Icon size={16} color={color.text} />
              ) : null}
            </View>
          )

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
                  fill={fill.raised}
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
        <AccentFill width={84} height={metric.navH} />
        <View style={s.addContent}>
          <PlusIcon size={12} color={color.text} />
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
    gap: 12,
    zIndex: 20,
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 5.923 },
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
    gap: 5.923,
    paddingHorizontal: 11.845,
  },
  itemLabel: { ...type.nav, color: color.textBright },
  glyph: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  glyphArt: { width: 44, height: 29 },
  add: {
    width: 84,
    height: metric.navH,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.strokeAccent,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  addLabel: { ...type.nav, fontSize: 14, color: color.text },
})
