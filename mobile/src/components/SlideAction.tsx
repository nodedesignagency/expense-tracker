import { useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { CELEBRATE, EASE_ENTER, SPRING_SETTLE, SPRING_WAKE } from '../motion'
import { axisFor, capTrim, font, sp } from '../theme'
import { ArrowRightIcon, CheckIcon } from './Icons'

/*
 * ============================================================================
 * Every number and colour in this file is read out of the frames — section
 * 41:76, nodes 39:26 (idle), 39:48 (live) and 39:58 (travelling) — through
 * get_design_context, which returns the fills, the gradient angles and the
 * shadow stacks. Nothing here is matched by eye against a render. Two earlier
 * passes were, and both were rightly rejected.
 *
 * Frame units throughout, put through sp() at the point of use: the app is
 * quoted at 393 and scaled, so a control held at full size on a 360 phone is
 * 9% larger against everything around it. See the note in theme.ts.
 * ============================================================================
 */

/** Track: 56 tall, 4 of horizontal padding, radius 51.2 — the full round. */
const TRACK_H = sp(56)
const PAD = sp(4)
const TRACK_BG = '#131313'
const TRACK_EDGE = 'rgba(255,255,255,0.1)'
/* A hairline stays a hairline: a rendering unit, not a measurement. */
const BORDER = 1

/** Thumb, idle: a 72 x 48 pill at radius 72, which on this box is full round. */
const THUMB_W = sp(72)
const THUMB_H = sp(48)
const THUMB_R = THUMB_H / 2
const ARROW = sp(24)

/**
 * Live, the frame draws the thumb at 84 x 56 against the idle 72 x 48 — the
 * same 1.1667 on both axes, so it is a scale of the one pill and not a second
 * one. The third state draws it 56 tall too, so this is where it *stays* once
 * there is an amount, not something it comes back from.
 */
const WAKE_SCALE = 84 / 72

/** The two fills, both on the frame's own axis. */
const THUMB_DEG = 133.494
const THUMB_IDLE = ['#7D7D7D', '#5A5A5A'] as const
const THUMB_LIVE = ['#FFFEFE', '#A9AEB1'] as const

/** The exported arrow's own fills — grey on the grey pill, near-black on the white. */
const ARROW_IDLE = '#3E3E3E'
const ARROW_LIVE = '#000403'

/** Caption: 18pt medium. */
const CAPTION = sp(18)
const CAPTION_IDLE = '#F1F1F1'

/** How far along counts as meaning it. */
const COMMIT = 0.88

/** The shimmer band, as a share of the track it sweeps across. */
const SHEEN_W = 0.42
const SHEEN_MS = 1400
const SHEEN_HOLD = 900

/*
 * ---------------------------------------------------------------------------
 * The light around the thumb.
 *
 * The frame gives this as five stacked shadows, all at y=0, and React Native
 * takes exactly that: `boxShadow` accepts the CSS string, composes several of
 * them, and is supported from 0.76 on the New Architecture — which SDK 54 is.
 * So these are the frame's own values, verbatim, rather than an SVG ramp
 * built to look like them. That substitution is what the last pass got wrong.
 *
 * The two live states differ only in which way the stack leans: it spills to
 * the thumb's right while it waits and trails to its left once it is moving,
 * reaching half again as far. **That mirroring is the "shadow going right to
 * left"** — it belongs to the shadow, not to a sweep laid over the top. Two
 * casters crossfaded by travel, so the swing itself stays opacity-only.
 * ---------------------------------------------------------------------------
 */

/** offset, blur, alpha — node 39:48, then node 39:58. */
const SHADOW_REST: readonly (readonly [number, number, number])[] = [
  [47, 13, 0.02],
  [30, 12, 0.15],
  [17, 10, 0.5],
  [8, 8, 0.85],
  [2, 4, 0.98],
]
const SHADOW_MOVE: readonly (readonly [number, number, number])[] = [
  [-70, 20, 0.02],
  [-45, 18, 0.15],
  [-25, 15, 0.5],
  [-11, 11, 0.85],
  [-3, 6, 0.98],
]

/** The stack as one CSS string, with the frame's offsets and blurs scaled. */
function stack(layers: readonly (readonly [number, number, number])[], rgb: string) {
  return layers
    .map(([dx, blur, a]) => `${sp(dx)}px 0px ${sp(blur)}px 0px rgba(${rgb},${a})`)
    .join(', ')
}

/*
 * ---------------------------------------------------------------------------
 * The trail.
 *
 * Node 39:58 carries one more thing the shadow stack does not describe:
 * `Ellipse 762`, rx 133, ry 28, filled `#00755E` and blurred at sigma 46.45.
 * A different, deeper green from the shadow's — the two were collapsed into
 * one before, which is part of why the colour never looked right.
 *
 * Blurred that hard against a 28 half-height, the ellipse is all falloff: the
 * vertical smear alone takes its peak to erf(28 / 46.45·√2) ≈ 0.45, and the
 * blur is so much wider than the track is tall that the profile barely varies
 * from top to bottom. So it is drawn as a horizontal ramp rather than a
 * radial one — the stops below are that convolution sampled every tenth,
 * which is the shape a real Gaussian blur gives and costs one gradient
 * instead of a filter Android may or may not honour.
 *
 * It is broad: centred 99 to the *left* of the thumb's leading edge and spent
 * about 300 either side of that, which is most of the track. The last pass
 * had it a fifth as wide, and that is why it read as a band being filled
 * rather than as light being cast.
 * ---------------------------------------------------------------------------
 */
const TRAIL_OFFSET = 99
const TRAIL_REACH = 300
const TRAIL_W = sp(TRAIL_REACH * 2)
const TRAIL_STOPS: readonly [number, number, ...number[]] = [
  0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
]
const TRAIL_ALPHA = [0, 0.005, 0.07, 0.277, 0.427, 0.451, 0.427, 0.277, 0.07, 0.005, 0]

/**
 * How much of the travel the light takes to swing from one side to the other.
 * Over a fifth of it the swap reads as a switch; over this it reads as the
 * light being dragged around the handle.
 */
const SWING = 0.3

/*
 * The burst. A dozen sparks off the thumb's final position, each with its own
 * direction, reach, size and start, all driven by the one `boom` value so the
 * whole thing is a single UI-thread animation. The table is fixed rather than
 * rolled per mount: the spray reads as random at speed, and a fixed table
 * keeps every value plain data for the worklet to close over.
 */
const SPRAY = [
  { ang: -2.921, dist: 64, size: 4, delay: 0.0, hue: 0 },
  { ang: -2.792, dist: 108, size: 5, delay: 0.08, hue: 1 },
  { ang: -2.232, dist: 96, size: 6, delay: 0.16, hue: 2 },
  { ang: -2.403, dist: 88, size: 7, delay: 0.04, hue: 0 },
  { ang: -1.766, dist: 82, size: 4, delay: 0.12, hue: 1 },
  { ang: -1.769, dist: 72, size: 5, delay: 0.0, hue: 2 },
  { ang: -1.494, dist: 66, size: 6, delay: 0.08, hue: 0 },
  { ang: -1.05, dist: 112, size: 7, delay: 0.16, hue: 1 },
  { ang: -1.171, dist: 102, size: 4, delay: 0.04, hue: 2 },
  { ang: -0.502, dist: 94, size: 5, delay: 0.12, hue: 0 },
  { ang: -0.608, dist: 86, size: 6, delay: 0.0, hue: 1 },
  { ang: -0.19, dist: 78, size: 7, delay: 0.08, hue: 2 },
] as const

/** The ring's canvas. Named so its centring is arithmetic, not Yoga's. */
const RING_SIZE = THUMB_H * 1.6

interface SlideActionProps {
  /** The whole control's width, so the travel is known before a finger lands. */
  width: number
  label: string
  /**
   * Whether there is anything to commit. False is the frame's first state:
   * the thumb sits grey and small and the gesture does nothing.
   */
  active: boolean
  /** The shadow stack's colour, as `r,g,b`. */
  glow: string
  /** The trail ellipse's colour, as `r,g,b`. Deeper than the glow's. */
  trail: string
  /** What the caption becomes once the light reaches it. */
  captionLit: string
  /**
   * Called once the thumb has been carried far enough and let go. Return false
   * to refuse: the thumb springs home and the caller says why. Return true and
   * the celebration runs — the caller should hold its dismissal for CELEBRATE.
   */
  onCommit: () => boolean
}

/**
 * Swipe to add entry.
 *
 * Three states, and they are three moments in the entry rather than three
 * points in one drag:
 *
 *   1. Nothing typed. Small grey thumb, grey arrow, no light, dead to touch.
 *   2. An amount exists. The thumb swells to the frame's larger pill and
 *      stays there, now white with a near-black arrow, the green stack
 *      spilling to its right.
 *   3. Travelling. That stack swings around to trail left, the teal ellipse
 *      washes the ground behind it, and the caption takes the lit colour.
 *
 * **The thumb is rendered outside the track's clip.** It has to be: live, it
 * is the full height of the track and wider than the padding leaves, so
 * anything clipping the track flattens its cap — which is exactly what the
 * owner caught. The track still clips, but only what belongs inside it: the
 * trail, the sheen and the caption.
 *
 * On Gesture.Pan rather than PanResponder. PanResponder hands every move back
 * to the React runtime, which is one render per frame for the length of the
 * drag; the gesture's callbacks are worklets and never touch it. The finger is
 * on the thing that is moving, so this is the one place where the difference
 * is felt directly rather than measured.
 */
export function SlideAction({
  width,
  label,
  active,
  glow,
  trail,
  captionLit,
  onCommit,
}: SlideActionProps) {
  /* Live, the thumb is wider — so what it may travel is measured from that. */
  const liveW = THUMB_W * WAKE_SCALE
  const travel = Math.max(width - liveW - PAD * 2, 1)

  const x = useSharedValue(0)
  const held = useSharedValue(0)
  /** Latched at the commit point so the haptic fires once, not every frame. */
  const armed = useSharedValue(0)
  /** 0..1 across the celebration; everything it does hangs off this. */
  const boom = useSharedValue(0)
  /** The sheen's own clock, sweeping whether or not a finger is down. */
  const sheen = useSharedValue(0)
  /** 0 idle, 1 live. Sprung, so the swell arrives with weight. */
  const wake = useSharedValue(active ? 1 : 0)

  const at = useDerivedValue(() => x.get() / travel)
  /** How far the light has swung from resting to trailing. */
  const swung = useDerivedValue(() => interpolate(at.get(), [0, SWING], [0, 1], 'clamp'))
  /** Clamped, because the wake spring overshoots and opacity must not. */
  const awake = useDerivedValue(() => interpolate(wake.get(), [0, 1], [0, 1], 'clamp'))

  useEffect(() => {
    /*
     * The sweep, then a hold, then a snap back to the start — withRepeat
     * replays the sequence, and without the snap the second pass would begin
     * where the first ended and never move again.
     */
    sheen.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: SHEEN_MS, easing: Easing.inOut(Easing.quad) }),
          withDelay(SHEEN_HOLD, withTiming(0, { duration: 1 })),
        ),
        -1,
      ),
    )
  }, [sheen])

  useEffect(() => {
    /*
     * A spring rather than a curve. The swell is the control coming alive,
     * and a timing curve arrives at its size and stops dead where the spring
     * carries a little past and settles — which is what reads as weight.
     */
    wake.set(withSpring(active ? 1 : 0, SPRING_WAKE))
    if (!active) x.set(withSpring(0, SPRING_SETTLE))
  }, [active, wake, x])

  const commit = () => {
    if (onCommit()) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      boom.set(withTiming(1, { duration: CELEBRATE * 0.8, easing: EASE_ENTER }))
      return
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    x.set(withSpring(0, SPRING_SETTLE))
  }

  const pan = Gesture.Pan()
    .onBegin(() => {
      if (boom.get() > 0 || !active) return
      held.set(withTiming(1, { duration: 120, easing: EASE_ENTER }))
    })
    .onUpdate((e) => {
      /* Dead until there is something to commit — the frame's first state. */
      if (boom.get() > 0 || !active) return
      x.set(Math.min(Math.max(e.translationX, 0), travel))
      /*
       * The detent, felt as it is crossed rather than on release — a haptic
       * that waits for the end is a report, not feedback. Latched, or it
       * would fire on every frame the finger spends past the line.
       */
      const past = x.get() / travel >= COMMIT ? 1 : 0
      if (past !== armed.get()) {
        armed.set(past)
        if (past) scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light)
      }
    })
    .onEnd((e) => {
      held.set(withTiming(0, { duration: 160, easing: EASE_ENTER }))
      armed.set(0)
      if (boom.get() > 0 || !active) return
      if (x.get() / travel >= COMMIT) {
        x.set(withSpring(travel, { ...SPRING_SETTLE, velocity: e.velocityX }))
        scheduleOnRN(commit)
        return
      }
      x.set(withSpring(0, { ...SPRING_SETTLE, velocity: e.velocityX }))
    })

  /*
   * The thumb. Scaled about its own centre, so the frame's 84 x 56 comes out
   * of the 72 x 48 pill rather than being a second set of numbers to keep in
   * step — and the arrow rides it, which is where the frame's 24 -> 28 glyph
   * comes from.
   */
  const thumb = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      {
        scale:
          interpolate(wake.get(), [0, 1], [1, WAKE_SCALE]) *
          interpolate(held.get(), [0, 1], [1, 1.02]),
      },
    ],
  }))

  const live = useAnimatedStyle(() => ({ opacity: awake.get() }))
  const gone = useAnimatedStyle(() => ({
    opacity: (1 - awake.get()) * interpolate(boom.get(), [0, 0.25], [1, 0], 'clamp'),
  }))
  const lit = useAnimatedStyle(() => ({
    opacity: awake.get() * interpolate(boom.get(), [0, 0.25], [1, 0], 'clamp'),
  }))

  /* Which way the stack leans. The whole of states two and three. */
  const castRest = useAnimatedStyle(() => ({
    opacity: awake.get() * (1 - swung.get()) * (1 - boom.get()),
  }))
  const castMove = useAnimatedStyle(() => ({
    opacity: awake.get() * swung.get() * (1 - boom.get()),
  }))

  /*
   * The trail rides with the thumb — one texture translated, never resized,
   * so nothing here is layout work. It arrives with the swing rather than the
   * first pixel of travel, since the frame only draws it once under way.
   */
  const trailStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    opacity: swung.get() * (1 - boom.get()),
  }))

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(sheen.get(), [0, 1], [-width * SHEEN_W, width]) }],
    opacity: (1 - boom.get()) * interpolate(at.get(), [0, 0.25], [1, 0], 'clamp'),
  }))

  /*
   * The caption keeps its place and takes the colour on rather than fading
   * out, which is what lets you read what you are committing to while
   * committing to it. Both colours are the frames' own.
   */
  const caption = useAnimatedStyle(() => ({
    color: interpolateColor(at.get(), [0.05, 0.55], [CAPTION_IDLE, captionLit]),
    opacity: (1 - boom.get()) * interpolate(awake.get(), [0, 1], [0.5, 1]),
  }))

  /* The check pops a touch past full size and settles — something landed. */
  const check = useAnimatedStyle(() => ({
    opacity: interpolate(boom.get(), [0.1, 0.35], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(boom.get(), [0.1, 0.45, 0.7], [0.4, 1.18, 1], 'clamp') }],
  }))

  const ring = useAnimatedStyle(() => ({
    opacity: interpolate(boom.get(), [0, 0.12, 0.9], [0, 1, 0], 'clamp'),
    transform: [{ scale: interpolate(boom.get(), [0, 1], [0.3, 2.8]) }],
  }))

  const flash = useAnimatedStyle(() => ({
    opacity: interpolate(boom.get(), [0, 0.08, 0.3], [0, 0.85, 0], 'clamp'),
    transform: [{ scale: interpolate(boom.get(), [0, 0.3], [0.4, 1.3], 'clamp') }],
  }))

  const pulse = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(boom.get(), [0, 0.25, 0.7], [1, 1.03, 1], 'clamp') }],
  }))

  const thumbAxis = axisFor(THUMB_DEG, THUMB_W, THUMB_H)
  const trailColors = TRAIL_ALPHA.map((a) => `rgba(${trail},${a})`) as unknown as readonly [
    string,
    string,
    ...string[],
  ]
  const sparkColors = [0.55, 0.8, 1].map((a) => `rgba(${glow},${a})`)

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[s.frame, { width }, pulse]}>
        {/*
          * The track clips what belongs inside it and nothing else. The thumb
          * is a sibling below, outside this, because live it is the track's
          * full height and clipping it flattens its cap.
          */}
        <View style={[s.track, { width }]}>
          <Animated.View
            style={[s.trail, { left: PAD - sp(TRAIL_OFFSET + TRAIL_REACH) }, trailStyle]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={trailColors}
              locations={TRAIL_STOPS}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Animated.View
            style={[s.sheen, { width: width * SHEEN_W }, sheenStyle]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Animated.Text
            style={[s.caption, caption]}
            pointerEvents="none"
            numberOfLines={1}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            {label}
          </Animated.Text>

          {/*
            * The light is cast from *inside* the track and the pill that
            * throws it is drawn outside — which sounds backwards, and is the
            * only arrangement that gives the frame's result.
            *
            * The stack's inner layers blur wider than they offset, so left to
            * itself the glow wraps the whole pill and spills over the track's
            * top and bottom edges. The frame does not show that, because the
            * track clips it. But clipping the *pill* flattens its cap, which
            * is what the owner caught. So the two are separated: the casters
            * live here, inside the clip, carrying the same transform as the
            * pill above so they can never drift apart.
            */}
          <Animated.View style={[s.castAnchor, thumb]} pointerEvents="none">
            <Animated.View style={[s.cast, { boxShadow: stack(SHADOW_REST, glow) }, castRest]} />
            <Animated.View style={[s.cast, { boxShadow: stack(SHADOW_MOVE, glow) }, castMove]} />
          </Animated.View>
        </View>

        <Animated.View style={[s.thumb, thumb]} pointerEvents="none">
          <View style={s.pill}>
            <LinearGradient
              colors={THUMB_IDLE}
              start={thumbAxis.start}
              end={thumbAxis.end}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View style={[StyleSheet.absoluteFill, live]}>
              <LinearGradient
                colors={THUMB_LIVE}
                start={thumbAxis.start}
                end={thumbAxis.end}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            <Animated.View style={[StyleSheet.absoluteFill, s.centre, gone]}>
              <ArrowRightIcon size={ARROW} color={ARROW_IDLE} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, s.centre, lit]}>
              <ArrowRightIcon size={ARROW} color={ARROW_LIVE} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, s.centre, check]}>
              <CheckIcon size={sp(22)} color={ARROW_LIVE} />
            </Animated.View>
          </View>
        </Animated.View>

        {/*
          * The celebration, outside every clip, so the light and the sparks
          * can leave the control — a burst that stops dead at the border it
          * came from reads as a glitch, not a payoff. Every child here is
          * placed by arithmetic off the anchor: an absolute child with no
          * offsets in a zero-sized box, centred by alignItems, draws nothing
          * at all and says nothing about it.
          */}
        <View style={[s.burst, { left: width - PAD - liveW / 2 }]} pointerEvents="none">
          <Animated.View style={[s.ringBox, flash]}>
            <BurstCore size={RING_SIZE} />
          </Animated.View>
          <Animated.View style={[s.ringBox, ring]}>
            <BurstRing size={RING_SIZE} rgb={glow} />
          </Animated.View>
          {SPRAY.map((p, i) => (
            <Spark key={i} boom={boom} spec={p} color={sparkColors[p.hue]} />
          ))}
        </View>
      </Animated.View>
    </GestureDetector>
  )
}

/** One spark: out along its own line, shrinking and dying as it goes. */
function Spark({
  boom,
  spec,
  color: sparkColor,
}: {
  boom: { get: () => number }
  spec: (typeof SPRAY)[number]
  color: string
}) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(boom.get(), [spec.delay, 1], [0, 1], 'clamp')
    return {
      opacity: interpolate(t, [0, 0.15, 1], [0, 1, 0]),
      transform: [
        { translateX: Math.cos(spec.ang) * spec.dist * t },
        { translateY: Math.sin(spec.ang) * spec.dist * t },
        { scale: interpolate(t, [0, 1], [1, 0.3]) },
      ],
    }
  })

  const d = sp(spec.size)
  return (
    <Animated.View
      style={[
        s.spark,
        {
          width: d,
          height: d,
          borderRadius: d / 2,
          left: -d / 2,
          top: -d / 2,
          backgroundColor: sparkColor,
        },
        style,
      ]}
    />
  )
}

/** The strike: solid light in the middle, gone by half way out. */
function BurstCore({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient
          id="slideFlash"
          cx={size / 2}
          cy={size / 2}
          r={size / 2}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.3} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill="url(#slideFlash)" />
    </Svg>
  )
}

/** The ring: a radial ramp that is nothing in the middle and light at the rim. */
function BurstRing({ size, rgb }: { size: number; rgb: string }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient
          id="slideBurst"
          cx={size / 2}
          cy={size / 2}
          r={size / 2}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0.45" stopColor={`rgb(${rgb})`} stopOpacity={0} />
          <Stop offset="0.78" stopColor={`rgb(${rgb})`} stopOpacity={0.85} />
          <Stop offset="1" stopColor={`rgb(${rgb})`} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill="url(#slideBurst)" />
    </Svg>
  )
}

const s = StyleSheet.create({
  /* Unclipped: the thumb overhangs it live, and the burst leaves entirely. */
  frame: { height: TRACK_H },
  track: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: TRACK_BG,
    borderWidth: BORDER,
    borderColor: TRACK_EDGE,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  trail: { position: 'absolute', top: 0, bottom: 0, width: TRAIL_W },
  sheen: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  caption: {
    fontFamily: font.r500,
    fontSize: CAPTION,
    ...capTrim(CAPTION),
    textAlign: 'center',
  },
  thumb: {
    position: 'absolute',
    left: PAD,
    top: (TRACK_H - THUMB_H) / 2,
    width: THUMB_W,
    height: THUMB_H,
  },
  /*
   * The same box, one unit in on both axes: an absolute child of the track is
   * laid out against its padding box, inside the border, while the pill
   * outside is laid out against the frame. Without this the light sits a unit
   * off the thing casting it.
   */
  castAnchor: {
    position: 'absolute',
    left: PAD - BORDER,
    top: (TRACK_H - THUMB_H) / 2 - BORDER,
    width: THUMB_W,
    height: THUMB_H,
  },
  /* Nothing in them but the light they throw. */
  cast: { ...StyleSheet.absoluteFillObject, borderRadius: THUMB_R },
  pill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: THUMB_R,
    borderWidth: BORDER,
    borderColor: TRACK_EDGE,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: { alignItems: 'center', justifyContent: 'center' },
  burst: { position: 'absolute', top: TRACK_H / 2, width: 0, height: 0 },
  ringBox: {
    position: 'absolute',
    left: -RING_SIZE / 2,
    top: -RING_SIZE / 2,
    width: RING_SIZE,
    height: RING_SIZE,
  },
  spark: { position: 'absolute' },
})
