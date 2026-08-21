import { Image, StyleSheet, type ImageSourcePropType } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import {
  ARRIVAL,
  ARRIVE_FROM,
  GLOW_SPREAD,
  POP_FROM,
  POP_OVER,
  TILT,
  TILT_FROM,
  TILT_PERSPECTIVE,
} from '../motion'
import { color } from '../theme'
import { NavGlow } from './NavGlow'

/*
 * Sizes. The frame draws every nav glyph in a 16 box — nodes 11:23, 11:27 and
 * 11:30 — and now that the destination is the frame's own 40 tall instead of
 * 56, 16 is what it takes. The earlier 20 was an upsize against a pill half
 * again as deep, and there is no longer one to sit against.
 *
 * Not run through sp(). A glyph is not bound by the width of the screen, and
 * scaled to 91.6% with everything else it came out at 14.7 inside a pill that
 * was itself drawn short — see the note on what scales in BottomNav.
 *
 * Both carry that note's 1.3 as well, since the pill they sit in does: 16 and
 * 21.6 become 20.8 and 28.08, which is the same pair against a taller bar.
 *
 * The 3D box is not the same number as the artwork inside it. These renders
 * carry transparent margin — the current set fills 78-84% of its 64px canvas —
 * so a box matched to the outline would land the visible art well under it.
 * What settled that was 27 against a 20 outline; held to the same ratio at 16
 * it is 21.6, which puts roughly 18 of actual artwork against a 16 outline.
 */
const FLAT = 20.8
const DIMENSIONAL = 28.08

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
    /*
     * Pop carries the scale past full size and back. Shaped along the swap
     * rather than sprung, because the swap is itself a position — how near the
     * pill is — and a spring would run on its own clock and drift out of step
     * with the shape that is driving it.
     */
    const scale =
      ARRIVAL === 'pop'
        ? interpolate(t, [0, 0.55, 1], [POP_FROM, POP_OVER, 1])
        : interpolate(t, [0, 1], [ARRIVE_FROM, 1])
    return {
      opacity: t,
      transform: [
        { perspective: TILT_PERSPECTIVE },
        { scale },
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
        <NavGlow size={FLAT * GLOW_SPREAD} />
      </Animated.View>

      <Animated.View style={[styles.layer, outline]}>
        <Icon size={FLAT} color={color.text} />
      </Animated.View>

      <Animated.View style={[styles.layer, dimensional]}>
        <Image
          source={art}
          style={{ width: DIMENSIONAL, height: DIMENSIONAL }}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  )
}

const GLOW_BOX = FLAT * GLOW_SPREAD

const styles = StyleSheet.create({
  box: {
    width: FLAT,
    height: FLAT,
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
    left: (FLAT - GLOW_BOX) / 2,
    top: (FLAT - GLOW_BOX) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
