import { Image, StyleSheet, type ImageSourcePropType } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import {
  ARRIVE_FROM,
  GLOW_SPREAD,
  TILT,
  TILT_FROM,
  TILT_PERSPECTIVE,
} from '../motion'
import { color, sp } from '../theme'
import { NavGlow } from './NavGlow'

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
  swap: SharedValue<number>
  /** The outline, shown when the tab is idle. */
  Icon: React.ComponentType<{ size?: number; color?: string }>
  /** The 3D render, shown when it is selected. */
  art: ImageSourcePropType
}

/**
 * One tab's icon: outline and 3D render, crossfading on selection, with a warm
 * bloom behind the render.
 *
 * Everything is driven from a shared value on the UI thread, so the swap keeps
 * running while JS is busy — which, on a tab change, it always is: the screen
 * behind is mounting at the same moment.
 *
 * The three parts are deliberately staggered rather than moving together. The
 * outline clears first, the render arrives over the middle, and the bloom
 * comes up last and slowest. Run in lockstep they cross at half opacity each
 * and the middle of the transition goes muddy, with two icons visibly stacked
 * and a halo around both.
 */
export function NavGlyph({ swap, Icon, art }: NavGlyphProps) {
  const outline = useAnimatedStyle(() => ({
    opacity: interpolate(swap.get(), [0, 0.45], [IDLE, 0], 'clamp'),
    transform: [{ scale: interpolate(swap.get(), [0, 0.45], [1, 0.94], 'clamp') }],
  }))

  const dimensional = useAnimatedStyle(() => {
    const t = interpolate(swap.get(), [0.2, 1], [0, 1], 'clamp')
    return {
      opacity: t,
      transform: [
        { perspective: TILT_PERSPECTIVE },
        { scale: interpolate(t, [0, 1], [ARRIVE_FROM, 1]) },
        { rotateY: TILT ? `${interpolate(t, [0, 1], [TILT_FROM, 0])}deg` : '0deg' },
      ],
    }
  })

  /* The bloom trails the render — light arrives after the object does. */
  const bloom = useAnimatedStyle(() => {
    const t = interpolate(swap.get(), [0.35, 1], [0, 1], 'clamp')
    return {
      opacity: t,
      transform: [{ scale: interpolate(t, [0, 1], [0.7, 1]) }],
    }
  })

  return (
    <Animated.View style={styles.box}>
      <Animated.View style={[styles.bloom, bloom]} pointerEvents="none">
        <NavGlow size={sp(FLAT) * GLOW_SPREAD} />
      </Animated.View>

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

const GLOW_BOX = sp(FLAT) * GLOW_SPREAD

const styles = StyleSheet.create({
  box: {
    width: sp(FLAT),
    height: sp(FLAT),
    alignItems: 'center',
    justifyContent: 'center',
  },
  /*
   * All three layers share a centre and may overflow the box, so neither the
   * larger render nor the halo is cropped to the outline's footprint.
   */
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloom: {
    position: 'absolute',
    width: GLOW_BOX,
    height: GLOW_BOX,
    left: (sp(FLAT) - GLOW_BOX) / 2,
    top: (sp(FLAT) - GLOW_BOX) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
