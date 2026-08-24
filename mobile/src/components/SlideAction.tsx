import { useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import { StyleSheet, Text, View } from 'react-native'
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
import { CELEBRATE, EASE_ENTER, SPRING_SETTLE } from '../motion'
import { capTrim, color, font, radius, sp } from '../theme'
import { ArrowRightIcon, CheckIcon } from './Icons'

/*
 * The owner's own frames this time — section 41:76, three states of one
 * control. Track 56 tall and fully round; thumb a 72 x 48 pill inset 4,
 * carrying an arrow; caption centred in the track.
 */
const TRACK_H = sp(56)
const PAD = sp(4)
const THUMB_H = TRACK_H - PAD * 2
const THUMB_W = sp(72)
const THUMB_R = THUMB_H / 2
/** How far along counts as meaning it. */
const COMMIT = 0.88

/** The shimmer band, as a share of the track it sweeps across. */
const SHEEN_W = 0.42
/** One sweep, and the pause before the next one. */
const SHEEN_MS = 1400
const SHEEN_HOLD = 900

/**
 * Five shades, transparent to bright, trailing the thumb.
 *
 * The owner's third frame settles what this is: not paint filling a bar but
 * light coming off the handle. The brightest shade rides right behind the
 * thumb, the deeper ones stretch back over the swept ground, and the far end
 * dies to nothing before it reaches the start — the first stop is
 * transparent, so the tail has no left edge at all. Anchored to the track
 * and revealed by a translate, same as before, so none of it is layout work.
 */
export type SlideRamp = readonly [string, string, string, string, string]
const RAMP_STOPS = [0, 0.3, 0.56, 0.82, 1] as const

/**
 * The bloom off the handle — the second frame's tell. An elliptical glow
 * that rides with the thumb, spilling a little ahead of it and well behind,
 * present from the moment the finger lands. This is what makes the trail
 * read as emitted rather than drawn.
 */
const BLOOM_W = sp(190)
/** How far the bloom spills past the thumb's leading edge. */
const BLOOM_LEAD = sp(40)

interface SlideActionProps {
  /** The whole control's width, so the travel is known before a finger lands. */
  width: number
  label: string
  /** What the caption takes on — the ledger's own red or green. */
  tint: string
  /** The five track shades, deep to pale. */
  ramp: SlideRamp
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
 * Slide to add.
 *
 * A tap is one event and this one writes to the ledger, so it asks for a
 * gesture with some length in it. Carrying the thumb across draws the ramp
 * out of the track in the direction's own colour, so the confirmation says
 * which kind of entry it is while it is being given rather than after.
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
 *
 * On success it does not simply stop: the ramp floods the last stretch, the
 * grip becomes a check, and the thumb throws a ring of light and a spray of
 * sparks — the entry going in is the biggest thing this screen does, and the
 * control that took the gesture is where the payoff belongs.
 */
export function SlideAction({ width, label, tint, ramp, onCommit }: SlideActionProps) {
  const travel = Math.max(width - THUMB_W - PAD * 2, 1)
  const x = useSharedValue(0)
  const held = useSharedValue(0)
  /** Latched at the commit point so the haptic fires once, not every frame. */
  const armed = useSharedValue(0)
  /** 0..1 across the celebration; everything it does hangs off this. */
  const boom = useSharedValue(0)
  /** The sheen's own clock, sweeping whether or not a finger is down. */
  const sheen = useSharedValue(0)

  const at = useDerivedValue(() => x.get() / travel)

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
      held.set(withTiming(1, { duration: 120, easing: EASE_ENTER }))
    })
    .onUpdate((e) => {
      if (boom.get() > 0) return
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
      if (boom.get() > 0) return
      if (x.get() / travel >= COMMIT) {
        x.set(withSpring(travel, { ...SPRING_SETTLE, velocity: e.velocityX }))
        scheduleOnRN(commit)
        return
      }
      x.set(withSpring(0, { ...SPRING_SETTLE, velocity: e.velocityX }))
    })

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { scale: interpolate(held.get(), [0, 1], [1, 1.03]) }],
    /* Grey at rest, white the moment it is held — the frames' own tell. */
    backgroundColor: interpolateColor(
      Math.max(held.get(), Math.min(at.get() * 4, 1)),
      [0, 1],
      ['#5C5C5C', '#FFFFFF'],
    ),
  }))

  /* One dark arrow throughout: half-strength on grey reads as the first
     frame's dim glyph, full-strength on white as the second's. */
  const arrow = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.max(held.get(), Math.min(at.get() * 4, 1)),
      [0, 1],
      [0.55, 1],
    ) * interpolate(boom.get(), [0, 0.25], [1, 0], 'clamp'),
  }))

  /* The bloom lights on touch, travels with the hand, hands off to the burst. */
  const bloom = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    opacity:
      Math.max(held.get(), Math.min(at.get() * 6, 1)) * (1 - boom.get()),
  }))

  /*
   * The ramp is one full-width gradient that never changes size — it slides
   * in from the left, and the track's clip reveals it. What shows at the
   * leading edge is therefore always the ramp's pale end, and pulling further
   * uncovers the deeper shades behind it, which is what anchors the colours
   * to the track instead of stretching them with the fill. A width animated
   * here instead would be layout work every frame; a translate is free.
   *
   * On the flood, the last half-thumb of hidden ramp comes through, so the
   * colour meets the track's end wall.
   */
  const ledge = PAD + THUMB_W / 2
  const fill = useAnimatedStyle(() => ({
    transform: [
      { translateX: -width + ledge + x.get() + boom.get() * (width - ledge - travel) },
    ],
    opacity: interpolate(at.get(), [0, 0.05], [0, 1], 'clamp'),
  }))

  /* The sheen sweeps the track; over the unfilled stretch it reads as the
     invitation, over the filled stretch as light moving on the colour. */
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(sheen.get(), [0, 1], [-width * SHEEN_W, width]) },
    ],
    opacity: 1 - boom.get(),
  }))

  /*
   * The caption stays and takes the colour on rather than fading out. The
   * reference keeps it legible the whole way across, which is what lets you
   * read what you are committing to while committing to it. On success it
   * gives way to the check.
   */
  const caption = useAnimatedStyle(() => ({
    color: interpolateColor(at.get(), [0, 0.6], ['#EDEDED', tint]),
    opacity: 1 - boom.get(),
  }))

  /* The check pops in a touch past full size and settles — something landed. */
  const check = useAnimatedStyle(() => ({
    opacity: interpolate(boom.get(), [0.1, 0.35], [0, 1], 'clamp'),
    transform: [
      { scale: interpolate(boom.get(), [0.1, 0.45, 0.7], [0.4, 1.18, 1], 'clamp') },
    ],
  }))

  /* The ring of light off the thumb's final position. */
  const ring = useAnimatedStyle(() => ({
    opacity: interpolate(boom.get(), [0, 0.12, 0.9], [0, 1, 0], 'clamp'),
    transform: [{ scale: interpolate(boom.get(), [0, 1], [0.3, 2.8]) }],
  }))

  /* A white core, gone almost at once — the strike the ring expands from. */
  const flash = useAnimatedStyle(() => ({
    opacity: interpolate(boom.get(), [0, 0.08, 0.3], [0, 0.85, 0], 'clamp'),
    transform: [{ scale: interpolate(boom.get(), [0, 0.3], [0.4, 1.3], 'clamp') }],
  }))

  /* The whole control takes the landing: a small kick, then settled. */
  const pulse = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(boom.get(), [0, 0.25, 0.7], [1, 1.03, 1], 'clamp') }],
  }))

  const sparkColors = [ramp[2], ramp[3], ramp[4]]

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[s.frame, { width }, pulse]}>
        <View style={[s.track, { width }]}>
          <Animated.View style={[s.fill, { width }, fill]} pointerEvents="none">
            <LinearGradient
              colors={ramp}
              locations={RAMP_STOPS}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Animated.View style={[s.bloomBox, bloom]} pointerEvents="none">
            <BloomTrail tint={ramp[3]} />
          </Animated.View>

          <Animated.View
            style={[s.sheen, { width: width * SHEEN_W }, sheenStyle]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
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
            {/*
              * Lit from above and shaded at the foot, which is the whole of the
              * depth: a flat fill at this size reads as a sticker, and a shadow
              * would be Android elevation re-rendering every frame of the drag.
              */}
            <LinearGradient
              colors={['rgba(255,255,255,0.62)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.20)']}
              locations={[0, 0.52, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[StyleSheet.absoluteFill, s.gloss]}
            />
            <Animated.View style={[StyleSheet.absoluteFill, s.centre, arrow]}>
              <ArrowRightIcon size={sp(22)} color="#141414" />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, s.centre, check]}>
              <CheckIcon size={sp(22)} color="#0A0A0A" />
            </Animated.View>
          </Animated.View>
        </View>

        {/*
          * The celebration lives outside the track's clip, so the light and
          * the sparks can leave the control — a burst that stops dead at the
          * border it came from reads as a glitch, not a payoff. Centred on
          * where the thumb ends its run.
          */}
        {/*
          * Everything in here is placed by arithmetic off the anchor point —
          * an explicit negative left/top per child. The first cut leaned on
          * the anchor's alignItems to centre its absolute children, and Yoga
          * quietly declined: nothing drew at all, and nothing said so.
          */}
        <View
          style={[s.burst, { left: width - PAD - THUMB_W / 2 }]}
          pointerEvents="none"
        >
          <Animated.View style={[s.ringBox, flash]}>
            <BurstCore size={RING_SIZE} />
          </Animated.View>

          <Animated.View style={[s.ringBox, ring]}>
            <BurstRing size={RING_SIZE} tint={ramp[3]} />
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

/**
 * The glow riding with the thumb: an ellipse of the ramp's own colour,
 * hottest just behind the handle, dead by its far edge. One static texture,
 * translated — never redrawn.
 */
function BloomTrail({ tint }: { tint: string }) {
  return (
    <Svg
      width={BLOOM_W}
      height={TRACK_H}
      viewBox={`0 0 ${BLOOM_W} ${TRACK_H}`}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <RadialGradient
          id="slideBloom"
          cx={0}
          cy={0}
          r={1}
          gradientUnits="userSpaceOnUse"
          gradientTransform={`matrix(${BLOOM_W * 0.62}, 0, 0, ${TRACK_H * 0.85}, ${BLOOM_W * 0.72}, ${TRACK_H / 2})`}
        >
          <Stop offset="0" stopColor={tint} stopOpacity={0.55} />
          <Stop offset="0.55" stopColor={tint} stopOpacity={0.22} />
          <Stop offset="1" stopColor={tint} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={BLOOM_W} height={TRACK_H} fill="url(#slideBloom)" />
    </Svg>
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
function BurstRing({ size, tint }: { size: number; tint: string }) {
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
          <Stop offset="0.45" stopColor={tint} stopOpacity={0} />
          <Stop offset="0.78" stopColor={tint} stopOpacity={0.85} />
          <Stop offset="1" stopColor={tint} stopOpacity={0} />
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  sheen: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  caption: {
    fontFamily: font.r500,
    fontSize: sp(16),
    ...capTrim(sp(16)),
    textAlign: 'center',
  },
  thumb: {
    position: 'absolute',
    left: PAD,
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: THUMB_R,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gloss: { borderRadius: THUMB_R },
  centre: { alignItems: 'center', justifyContent: 'center' },
  /* Anchored so the glow's hot edge leads the thumb by BLOOM_LEAD at x=0. */
  bloomBox: {
    position: 'absolute',
    left: PAD + THUMB_W + BLOOM_LEAD - BLOOM_W,
    top: 0,
    width: BLOOM_W,
    height: TRACK_H,
  },
  burst: {
    position: 'absolute',
    top: TRACK_H / 2,
    width: 0,
    height: 0,
  },
  ringBox: {
    position: 'absolute',
    left: -RING_SIZE / 2,
    top: -RING_SIZE / 2,
    width: RING_SIZE,
    height: RING_SIZE,
  },
  spark: { position: 'absolute' },
})
