import { Dimensions, StyleSheet, Text, View } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import {
  BLOOM_AT,
  BLOOM_FADE,
  BLOOM_SCALE,
  BLOOM_Y,
  SAID_IN,
  SAID_OUT,
} from '../motion'
import { capTrim, color, font, sp } from '../theme'
import { CheckIcon } from './Icons'

const { width: W, height: H } = Dimensions.get('window')

/**
 * The bloom's sprite — three times the width of the screen.
 *
 * The first cut was 1.9x and read as a small circle with a blur on it, which
 * is exactly what the owner said. The problem was never the blur: it was that
 * the ramp *ended* on screen, so the eye found the edge and resolved the
 * whole thing into a disc. Light does not have an edge you can find.
 *
 * At 3x, the ramp dies about a screen and a half out from its centre, so what
 * is on screen is only its bright middle: it runs off both sides and fades
 * vertically instead, which is what the reference does. The hot core stays
 * small as a fraction of the sprite, so the structure survives the size.
 */
const BLOOM = W * 3

/** Where the confirmation sits, as a share of the height. */
const SAID_Y = 0.44
/** How far it rises into place. Worked out here: a worklet cannot call sp(). */
const SAID_RISE = sp(10)

export interface BloomTint {
  /** The middle. Tinted, not white — see the note on `Bloom` below. */
  core: string
  /** The colour it becomes on the way out. */
  mid: string
  /** The deep edge, where it dies into the black. */
  edge: string
  /** A second light, off to one side, in a hue the first one does not have. */
  wash: string
}

interface CommitProps {
  /** 0 to 1 across the whole celebration. Owned by the composer. */
  progress: SharedValue<number>
  tint: BloomTint
  label: string
}

/**
 * What happens when the entry lands.
 *
 * Built from the owner's reference: light ignites below the bottom edge,
 * swells as it rises until it fills the screen, then carries on up and
 * shrinks away over the top, leaving the confirmation behind. The thing that
 * makes it read as an event rather than as a flourish is that it **passes
 * through** — it never appears and fades in place, and it leaves by the far
 * edge rather than by the one it came from.
 *
 * It is drawn over the whole screen rather than inside the sheet: the sheet
 * stops short of the top, and a bloom that stopped with it would read as
 * something happening *in the form* rather than to the ledger.
 *
 * One shared value drives every part, so nothing can drift out of step, and
 * every animated property is a transform or an opacity. The bloom itself is a
 * single static texture — an SVG ramp — moved and scaled, never redrawn. The
 * blur behind it is static too and crossfaded by opacity: animating a
 * `BlurView`'s intensity re-renders the blur every frame on Android.
 */
export function Commit({ progress, tint, label }: CommitProps) {
  /* The form going away: blurred back, so the light is the only thing left. */
  const veil = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.16, 0.9, 1], [0, 1, 1, 0], 'clamp'),
  }))

  /*
   * The black under the light, and it goes almost solid across the middle.
   *
   * That stretch is where the sheet is dismissed, the page comes back forward
   * and the new row lands — all of it underneath. At the wash's original 0.62
   * you would have watched the composer slide away through it. Near-solid,
   * with the bloom at its brightest on top, there is nothing to see.
   */
  const dark = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.get(),
      [0, 0.16, 0.38, 0.78, 1],
      [0, 0.62, 0.99, 0.99, 0],
      'clamp',
    ),
  }))

  const bloom = useAnimatedStyle(() => {
    const t = progress.get()
    return {
      opacity: interpolate(t, BLOOM_AT as unknown as number[], BLOOM_FADE as unknown as number[], 'clamp'),
      transform: [
        {
          translateY:
            interpolate(t, BLOOM_AT as unknown as number[], BLOOM_Y as unknown as number[], 'clamp') * H -
            BLOOM / 2,
        },
        {
          scale: interpolate(
            t,
            BLOOM_AT as unknown as number[],
            BLOOM_SCALE as unknown as number[],
            'clamp',
          ),
        },
      ],
    }
  })

  /*
   * The confirmation arrives as the light passes it and leaves before the
   * light does, so the screen is never holding two things at once.
   */
  const said = useAnimatedStyle(() => {
    const t = progress.get()
    return {
      opacity: interpolate(t, [SAID_IN, SAID_IN + 0.12, SAID_OUT, 1], [0, 1, 1, 0], 'clamp'),
      transform: [
        { translateY: interpolate(t, [SAID_IN, SAID_IN + 0.16], [SAID_RISE, 0], 'clamp') },
        { scale: interpolate(t, [SAID_IN, SAID_IN + 0.16], [0.94, 1], 'clamp') },
      ],
    }
  })

  return (
    <View style={s.root} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, veil]}>
        <BlurView
          intensity={44}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={[s.wash, dark]} pointerEvents="none" />

      <Animated.View style={[s.bloom, bloom]}>
        <Bloom tint={tint} />
      </Animated.View>

      <Animated.View style={[s.said, said]}>
        <View style={s.mark}>
          <CheckIcon size={sp(13)} color="#0A0A0A" />
        </View>
        <Text style={s.saidText}>{label}</Text>
      </Animated.View>
    </View>
  )
}

/**
 * The light itself — two of them, and neither has a white middle.
 *
 * The first cut ran to near-white at 0.96 over the innermost 8%, which put a
 * small hard disc of white in the centre of the screen: the owner called it
 * out as not good, and it is the same mistake as the slider's tight bloom in
 * a different guise. Real light of this kind has no hot spot you can point
 * at. So the core is a *tint* of the entry's colour rather than white, it
 * peaks well under 1, and the ramp out of it is long.
 *
 * And there are two, because the reference is not one colour: a second,
 * broader light sits off to one side in a hue the first does not have —
 * violet under the reds, teal under the greens. That off-centre pairing is
 * what makes a blur read as atmosphere rather than as a circle. It is drawn
 * first, so the entry's own colour stays on top and the direction still
 * reads at a glance.
 */
function Bloom({ tint }: { tint: BloomTint }) {
  /* How far the second light sits off the first, as a share of the sprite. */
  const off = BLOOM * 0.14
  return (
    <Svg width={BLOOM} height={BLOOM} viewBox={`0 0 ${BLOOM} ${BLOOM}`}>
      <Defs>
        <RadialGradient
          id="commitWash"
          cx={BLOOM / 2 - off}
          cy={BLOOM / 2 + off * 0.6}
          r={BLOOM / 2}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={tint.wash} stopOpacity={0.4} />
          <Stop offset="0.22" stopColor={tint.wash} stopOpacity={0.3} />
          <Stop offset="0.46" stopColor={tint.wash} stopOpacity={0.14} />
          <Stop offset="0.7" stopColor={tint.wash} stopOpacity={0.04} />
          <Stop offset="1" stopColor={tint.wash} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient
          id="commitBloom"
          cx={BLOOM / 2}
          cy={BLOOM / 2}
          r={BLOOM / 2}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={tint.core} stopOpacity={0.7} />
          <Stop offset="0.13" stopColor={tint.core} stopOpacity={0.6} />
          <Stop offset="0.25" stopColor={tint.mid} stopOpacity={0.46} />
          <Stop offset="0.4" stopColor={tint.mid} stopOpacity={0.27} />
          <Stop offset="0.57" stopColor={tint.edge} stopOpacity={0.13} />
          <Stop offset="0.76" stopColor={tint.edge} stopOpacity={0.035} />
          <Stop offset="1" stopColor={tint.edge} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={BLOOM} height={BLOOM} fill="url(#commitWash)" />
      <Rect x={0} y={0} width={BLOOM} height={BLOOM} fill="url(#commitBloom)" />
    </Svg>
  )
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 40 },
  /* Over the blur, or the form reads through it at its own brightness. */
  wash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#060606' },
  /*
   * Placed by arithmetic, not by alignment: an absolute child with no offsets
   * inside a filled parent is laid out by Yoga's alignment rules, and the
   * transform below assumes it starts at the top-left of the screen.
   */
  bloom: {
    position: 'absolute',
    left: (W - BLOOM) / 2,
    top: 0,
    width: BLOOM,
    height: BLOOM,
  },
  said: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: H * SAID_Y,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(8),
  },
  mark: {
    width: sp(20),
    height: sp(20),
    borderRadius: sp(10),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saidText: {
    fontFamily: font.r500,
    fontSize: sp(17),
    ...capTrim(sp(17)),
    color: color.text,
  },
})
