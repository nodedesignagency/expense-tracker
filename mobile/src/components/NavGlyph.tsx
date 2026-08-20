import { Animated, Image, StyleSheet, type ImageSourcePropType } from 'react-native'
import { color, sp } from '../theme'

/*
 * Sizes. The outline sits on a 16 grid but reads small against the pill, so it
 * is drawn at 20.
 *
 * The 3D box is not the same number as the artwork inside it. These renders
 * carry transparent margin — the current set fills 78-84% of its 64px canvas —
 * so a box matched to the outline would land the visible art well under it.
 * 27 puts roughly 23 of actual artwork on screen, a little over the outline,
 * which is the relationship the reference has.
 */
const FLAT = 20
const DIMENSIONAL = 27

/** How far the outline dims when idle — the frame's own value for a nav item. */
const IDLE = 0.72

interface NavGlyphProps {
  /** 0 idle, 1 selected. Driven by the tab, so the glyph holds no state of
   *  its own — it used to, and lost it every time the tab rebuilt. */
  lit: Animated.Value
  /** The outline, shown when the tab is idle. */
  Icon: React.ComponentType<{ size?: number; color?: string }>
  /** The 3D render, shown when it is selected. */
  art: ImageSourcePropType
}

/** One tab's icon: outline and 3D render, crossfading on selection. */
export function NavGlyph({ lit, Icon, art }: NavGlyphProps) {
  return (
    <Animated.View style={styles.box}>
      <Animated.View
        style={[
          styles.layer,
          { opacity: lit.interpolate({ inputRange: [0, 1], outputRange: [IDLE, 0] }) },
        ]}
      >
        <Icon size={sp(FLAT)} color={color.text} />
      </Animated.View>

      <Animated.View style={[styles.layer, { opacity: lit }]}>
        <Image
          source={art}
          style={{ width: sp(DIMENSIONAL), height: sp(DIMENSIONAL) }}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  box: {
    width: sp(FLAT),
    height: sp(FLAT),
    alignItems: 'center',
    justifyContent: 'center',
  },
  /*
   * Both layers share a centre and may overflow the box, so the larger render
   * is not cropped to the outline's footprint.
   */
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
