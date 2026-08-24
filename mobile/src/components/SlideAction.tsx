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
import { CELEBRATE, EASE_ENTER, SPRING_SETTLE, WAKE } from '../motion'
import { axisFor, capTrim, font, sp } from '../theme'
import { ArrowRightIcon, CheckIcon } from './Icons'

/*
 * Transcribed from the owner's own frames — section 41:76, nodes 39:26,
 * 39:48 and 39:58. Every number and colour below is read out of those, not
 * chosen: the track is 56 tall with 4 of horizontal padding and a 51.2
 * radius (which on a box this deep is the full round), the thumb is a 72 x 48
 * pill, and the caption is 18pt medium.
 */
const TRACK_H = sp(56)
const PAD = sp(4)
const THUMB_W = sp(72)
const THUMB_H = sp(48)
const THUMB_R = THUMB_H / 2
const CAPTION = sp(18)

/** The track's own surface and hairline, from the frame. */
const TRACK_BG = '#131313'
const TRACK_EDGE = 'rgba(255,255,255,0.1)'

/*
 * The two thumb fills, both at the frame's own 133.49deg.
 *
 * Idle is a mid grey pair and active is very nearly white — which is the
 * whole of the disabled/enabled tell, and the reason the arrow needs two
 * colours rather than one at two opacities.
 */
const THUMB_DEG = 133.494
const THUMB_IDLE = ['#7D7D7D', '#5A5A5A'] as const
const THUMB_LIVE = ['#FFFEFE', '#A9AEB1'] as const

/** The arrow, dim on the grey pill and near-black on the white one. */
const ARROW_IDLE = '#9A9A9A'
const ARROW_LIVE = '#141414'

/**
 * What the thumb does the moment an amount exists.
 *
 * The frame draws the live thumb at 84 x 56 against the idle one's 72 x 48 —
 * the same 1.167 on both axes, so it is a scale and not a resize. It is a
 * pulse rather than a new resting size: it swells and comes back, and what
 * stays is the colour and the light. Applied to the whole thumb, so the arrow
 * rides it and the frame's 24 -> 28 glyph comes out of the same number.
 */
const WAKE_SCALE = 84 / 72

/** How far along counts as meaning it. */
const COMMIT = 0.88

/** The shimmer band, as a share of the track it sweeps across. */
const SHEEN_W = 0.42
/** One sweep, and the pause before the next one. */
const SHEEN_MS = 1400
const SHEEN_HOLD = 900

/*
 * The glow, which is the part that was being guessed before.
 *
 * The frame gives it as five stacked shadows, all at y=0, in one green — and
 * the two live states differ only in which way they lean:
 *
 *   at rest   +2 +8 +17 +30 +47, blurs 4 8 10 12 13
 *   moving    -3 -11 -25 -45 -70, blurs 6 11 15 18 20
 *
 * Same colour, same falling opacities, mirrored and reaching further. So the
 * light spills to the *right* of the thumb while it waits and trails to the
 * *left* once it is going — which is the "shadow going right to left" the
 * owner asked for, and it is a property of the shadow, not a separate sweep.
 *
 * Built as two elliptical sprites rather than as box shadows. React Native
 * cannot stack five of them, animating one would be layout work every frame,
 * and Android's own shadow is a flat grey drawn from elevation — no use for
 * coloured light. Two static textures crossfading is transform and opacity
 * only, which is the rule for anything running per frame.
 */
/*
 * At rest the reach is the stack's own: the outermost shadow sits at +47 with
 * 13 of blur, so the light is spent by 62. Its falloff is the stack's too —
 * each layer's opacity at its offset as a fraction of that reach.
 */
const SPILL_REST = sp(62)
const REST_STOPS = [0, 0.13, 0.27, 0.48, 0.76, 1] as const
const REST_ALPHA = [0.95, 0.82, 0.48, 0.15, 0.02, 0] as const

/*
 * Travelling, the frame stops describing it as a shadow and draws it: the
 * `Ellipse 762` on node 39:58, 266 wide against a 56 track and blurred far
 * past its own box. That is much longer and much softer than the -70 stack
 * suggests, and it is the one the owner drew *to show the animation*, so it
 * is the one to follow. It also removes a seam: the swept ground and the
 * halo were two layers with different falloffs meeting at the pill, and the
 * step between them was visible. There is one light now, and no trail layer.
 */
const SPILL_MOVE = sp(232)
const MOVE_STOPS = [0, 0.16, 0.36, 0.6, 0.82, 1] as const
const MOVE_ALPHA = [0.82, 0.6, 0.34, 0.15, 0.04, 0] as const

/** How tightly the light hugs the pill vertically. */
const GLOW_RY = 0.58

interface SlideActionProps {
  /** The whole control's width, so the travel is known before a finger lands. */
  width: number
  label: string
  /**
   * Whether there is anything to commit. False is the frame's first state:
   * the thumb sits grey and the gesture does nothing.
   */
  active: boolean
  /** The glow's colour, as `r,g,b`. */
  glow: string
  /** What the caption becomes once the light reaches it. */
  captionLit: string
  /**
   * Called once the thumb has been carried far enough and let go. Return false
   * to refuse: the thumb springs home and the caller says why. Return true and
   * the celebration runs — the caller should hold its dismissal for CELEBRATE.
   */
  onCommit: () => boolean
}

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

/**
 * Swipe to add entry.
 *
 * Three states, and they are three moments in the entry rather than three
 * points in one drag — which is what the first cut of this got wrong:
 *
 *   1. Nothing typed. The thumb is grey and the track is dead.
 *   2. An amount exists. The thumb swells and settles back, now white, with
 *      the green light spilling to its right.
 *   3. Travelling. That light swings around and trails to the left, the
 *      ground it has covered keeps a dark wash of the same green, and the
 *      caption takes the lit colour as the light reaches it.
 *
 * On Gesture.Pan rather than PanResponder. PanResponder hands every move back
 * to the React runtime, which is one render per frame for the length of the
 * drag; the gesture's callbacks are worklets and never touch it. The finger is
 * on the thing that is moving, so this is the one place where the difference
 * is felt directly rather than measured.
 *
 * Springs home rather than easing home, for the same reason: let go mid-flick
 * and a curve throws the velocity away and restarts from nothing, where the
 * spring carries it through.
 */
export function SlideAction({
  width,
  label,
  active,
  glow,
  captionLit,
  onCommit,
}: SlideActionProps) {
  const travel = Math.max(width - THUMB_W - PAD * 2, 1)
  const x = useSharedValue(0)
  const held = useSharedValue(0)
  /** Latched at the commit point so the haptic fires once, not every frame. */
  const armed = useSharedValue(0)
  /** 0..1 across the celebration; everything it does hangs off this. */
  const boom = useSharedValue(0)
  /** The sheen's own clock, sweeping whether or not a finger is down. */
  const sheen = useSharedValue(0)
  /** 0 idle, 1 live. The pulse is shaped along it rather than run beside it. */
  const wake = useSharedValue(active ? 1 : 0)

  const at = useDerivedValue(() => x.get() / travel)

  /* How far the light has swung from resting to trailing. */
  const swung = useDerivedValue(() => Math.min(at.get() * 6, 1))

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
    wake.set(withTiming(active ? 1 : 0, { duration: WAKE, easing: EASE_ENTER }))
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
      if (boom.get() > 0 || wake.get() < 1) return
      held.set(withTiming(1, { duration: 120, easing: EASE_ENTER }))
    })
    .onUpdate((e) => {
      /* Dead until there is something to commit — the frame's first state. */
      if (boom.get() > 0 || wake.get() < 1) return
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
      if (boom.get() > 0 || wake.get() < 1) return
      if (x.get() / travel >= COMMIT) {
        x.set(withSpring(travel, { ...SPRING_SETTLE, velocity: e.velocityX }))
        scheduleOnRN(commit)
        return
      }
      x.set(withSpring(0, { ...SPRING_SETTLE, velocity: e.velocityX }))
    })

  /*
   * The thumb. The swell is shaped along `wake` rather than sprung beside it,
   * so it cannot drift out of step with the colour it arrives with — and it
   * runs both ways, so clearing the amount hands the light back.
   */
  const thumb = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      {
        scale:
          interpolate(wake.get(), [0, 0.5, 1], [1, WAKE_SCALE, 1]) *
          interpolate(held.get(), [0, 1], [1, 1.03]),
      },
    ],
  }))

  const live = useAnimatedStyle(() => ({ opacity: wake.get() }))
  const idleArrow = useAnimatedStyle(() => ({
    opacity: (1 - wake.get()) * interpolate(boom.get(), [0, 0.25], [1, 0], 'clamp'),
  }))
  const liveArrow = useAnimatedStyle(() => ({
    opacity: wake.get() * interpolate(boom.get(), [0, 0.25], [1, 0], 'clamp'),
  }))

  /*
   * The two halves of the light. Both ride with the thumb; which one is
   * showing is the whole difference between the frame's second and third
   * states, so it is one crossfade rather than two animations.
   */
  const glowRest = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    opacity: wake.get() * (1 - swung.get()) * (1 - boom.get()),
  }))
  const glowMove = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    opacity: wake.get() * swung.get() * (1 - boom.get()),
  }))

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(sheen.get(), [0, 1], [-width * SHEEN_W, width]) }],
    opacity: (1 - boom.get()) * interpolate(at.get(), [0, 0.3], [1, 0], 'clamp'),
  }))

  /*
   * The caption keeps its place and takes the colour on rather than fading
   * out, which is what lets you read what you are committing to while
   * committing to it. The lit colour is the frame's own.
   */
  const caption = useAnimatedStyle(() => ({
    color: interpolateColor(at.get(), [0, 0.6], ['#F1F1F1', captionLit]),
    opacity: (1 - boom.get()) * interpolate(wake.get(), [0, 1], [0.55, 1]),
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
  const sparkColors = [0.55, 0.8, 1].map((a) => `rgba(${glow},${a})`)

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[s.frame, { width }, pulse]}>
        <View style={[s.track, { width }]}>
          {/* Spilling right, off the waiting thumb — the second frame. */}
          <Animated.View
            style={[s.glow, { left: PAD + THUMB_W, width: SPILL_REST }, glowRest]}
            pointerEvents="none"
          >
            <Spill
              width={SPILL_REST}
              rgb={glow}
              hot="left"
              stops={REST_STOPS}
              alpha={REST_ALPHA}
            />
          </Animated.View>

          {/* Trailing left, behind the travelling one — the third. */}
          <Animated.View
            style={[s.glow, { left: PAD - SPILL_MOVE, width: SPILL_MOVE }, glowMove]}
            pointerEvents="none"
          >
            <Spill
              width={SPILL_MOVE}
              rgb={glow}
              hot="right"
              stops={MOVE_STOPS}
              alpha={MOVE_ALPHA}
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

          <Animated.View style={[s.thumb, thumb]} pointerEvents="none">
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

            <Animated.View style={[StyleSheet.absoluteFill, s.centre, idleArrow]}>
              <ArrowRightIcon size={sp(24)} color={ARROW_IDLE} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, s.centre, liveArrow]}>
              <ArrowRightIcon size={sp(24)} color={ARROW_LIVE} />
            </Animated.View>

            <Animated.View style={[StyleSheet.absoluteFill, s.centre, check]}>
              <CheckIcon size={sp(22)} color={ARROW_LIVE} />
            </Animated.View>
          </Animated.View>
        </View>

        {/*
          * The celebration lives outside the track's clip, so the light and
          * the sparks can leave the control — a burst that stops dead at the
          * border it came from reads as a glitch, not a payoff. Every child
          * here is placed by arithmetic off the anchor: an absolute child
          * with no offsets in a zero-sized box, centred by alignItems, draws
          * nothing at all and says nothing about it.
          */}
        <View style={[s.burst, { left: width - PAD - THUMB_W / 2 }]} pointerEvents="none">
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

/**
 * One side of the glow: an ellipse of the frame's green, solid where it meets
 * the pill and dead at its far edge, with the shadow stack's own falloff.
 *
 * Written as a transform on a unit circle rather than as rx/ry — those are
 * real attributes on a rect and not on a gradient, so react-native-svg hands
 * them to the DOM, the browser drops them, and the ramp floods the box.
 */
function Spill({
  width,
  rgb,
  hot,
  stops,
  alpha,
}: {
  width: number
  rgb: string
  hot: 'left' | 'right'
  stops: readonly number[]
  alpha: readonly number[]
}) {
  const id = `spill${hot}${Math.round(width)}`
  const cx = hot === 'left' ? 0 : width
  const ry = TRACK_H * GLOW_RY

  return (
    <Svg
      width={width}
      height={TRACK_H}
      viewBox={`0 0 ${width} ${TRACK_H}`}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient
          id={id}
          cx={0}
          cy={0}
          r={1}
          gradientUnits="userSpaceOnUse"
          gradientTransform={`matrix(${width}, 0, 0, ${ry}, ${cx}, ${TRACK_H / 2})`}
        >
          {stops.map((offset, i) => (
            <Stop
              key={offset}
              offset={offset}
              stopColor={`rgb(${rgb})`}
              stopOpacity={alpha[i]}
            />
          ))}
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={TRACK_H} fill={`url(#${id})`} />
    </Svg>
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
  /* Unclipped, so the burst can leave; the track below does the clipping. */
  frame: { height: TRACK_H },
  track: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: TRACK_BG,
    borderWidth: 1,
    borderColor: TRACK_EDGE,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  glow: { position: 'absolute', top: 0, height: TRACK_H },
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
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: THUMB_R,
    borderWidth: 1,
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
