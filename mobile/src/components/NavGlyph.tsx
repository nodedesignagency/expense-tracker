import { Image, StyleSheet, type ImageSourcePropType } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import { ARRIVE_FROM } from '../motion'
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
  /** 0 idle, 1 selected. Owned by the tab, so the glyph holds no state itself. */
  lit: SharedValue<number>
  /** The outline, shown when the tab is idle. */
  Icon: React.ComponentType<{ size?: number; color?: string }>
  /** The 3D render, shown when it is selected. */
  art: ImageSourcePropType
}

/**
 * One tab's icon: outline and 3D render, crossfading on selection.
 *
 * Both layers are driven from a shared value on the UI thread, so the swap
 * keeps running while JS is busy — which, on a tab switch, it always is: the
 * screen behind is mounting at the same moment.
 *
 * The outline leaves faster than the render arrives. Held on the same curve
 * they cross at half opacity each and the middle of the transition goes muddy,
 * with two icons visibly stacked; letting the outline clear out first keeps
 * one shape legible the whole way through.
 */
export function NavGlyph({ lit, Icon, art }: NavGlyphProps) {
  const outline = useAnimatedStyle(() => ({
    opacity: interpolate(lit.get(), [0, 0.55], [IDLE, 0], 'clamp'),
  }))

  const dimensional = useAnimatedStyle(() => ({
    opacity: interpolate(lit.get(), [0.25, 1], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(lit.get(), [0.25, 1], [ARRIVE_FROM, 1], 'clamp') }],
  }))

  return (
    <Animated.View style={styles.box}>
      <Animated.View style={[styles.layer, outline]}>
        <Icon size={sp(FLAT)} color={color.text} />
      </Animated.View>

      <Animated.View style={[styles.layer, dimensional]}>
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
