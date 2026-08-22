import * as Haptics from 'expo-haptics'
import { StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { LinearGradient } from 'expo-linear-gradient'
import { EASE_ENTER, SPRING_SETTLE } from '../motion'
import { capTrim, color, font, radius, sp } from '../theme'

const TRACK_H = sp(62)
const PAD = sp(6)
const THUMB = TRACK_H - PAD * 2
/** A squircle, as the reference has it — not a circle, and not a pill. */
const THUMB_R = THUMB * 0.42
/** How far along counts as meaning it. */
const COMMIT = 0.88

interface SlideActionProps {
  /** The whole control's width, so the travel is known before a finger lands. */
  width: number
  label: string
  /** What the track fills with — the ledger's own red or green. */
  tint: string
  /**
   * Called once the thumb has been carried far enough and let go. Return false
   * to refuse: the thumb springs home and the caller says why.
   */
  onCommit: () => boolean
}

/**
 * Slide to add.
 *
 * A tap is one event and this one writes to the ledger, so it asks for a
 * gesture with some length in it. Carrying the thumb across fills the track in
 * the direction's own colour, so the confirmation says which kind of entry it
 * is while it is being given rather than after.
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
export function SlideAction({ width, label, tint, onCommit }: SlideActionProps) {
  const travel = Math.max(width - THUMB - PAD * 2, 1)
  const x = useSharedValue(0)
  const held = useSharedValue(0)
  /** Latched at the commit point so the haptic fires once, not every frame. */
  const armed = useSharedValue(0)

  const at = useDerivedValue(() => x.get() / travel)

  const commit = () => {
    if (onCommit()) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
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
      if (x.get() / travel >= COMMIT) {
        x.set(withSpring(travel, { ...SPRING_SETTLE, velocity: e.velocityX }))
        scheduleOnRN(commit)
        return
      }
      x.set(withSpring(0, { ...SPRING_SETTLE, velocity: e.velocityX }))
    })

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { scale: interpolate(held.get(), [0, 1], [1, 1.03]) }],
    /* Grey at rest, white once it is being carried — the reference's tell. */
    backgroundColor: interpolateColor(at.get(), [0, 0.25], ['#9A9A9A', '#FFFFFF']),
  }))

  /* The fill follows the thumb, so the colour is something being drawn out. */
  const fill = useAnimatedStyle(() => ({
    width: PAD + THUMB / 2 + x.get(),
    opacity: interpolate(at.get(), [0, 0.05], [0, 1], 'clamp'),
  }))

  /*
   * The caption stays and takes the colour on rather than fading out. The
   * reference keeps it legible the whole way across, which is what lets you
   * read what you are committing to while committing to it.
   */
  const caption = useAnimatedStyle(() => ({
    color: interpolateColor(at.get(), [0, 0.6], [color.textDim, tint]),
  }))

  return (
    <GestureDetector gesture={pan}>
      <View style={[s.track, { width }]}>
        <Animated.View style={[s.fill, fill]} pointerEvents="none">
          <LinearGradient
            colors={[`${tint}00`, `${tint}2E`, `${tint}5C`]}
            locations={[0, 0.6, 1]}
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
          <View style={s.grip} />
          <View style={s.grip} />
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

const s = StyleSheet.create({
  track: {
    height: TRACK_H,
    borderRadius: radius.soft,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { ...StyleSheet.absoluteFillObject, right: undefined },
  caption: {
    fontFamily: font.r500,
    fontSize: sp(16),
    ...capTrim(sp(16)),
    textAlign: 'center',
  },
  thumb: {
    position: 'absolute',
    left: PAD,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB_R,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(3),
  },
  /* Two bars, which is a grip and not an instruction to read. */
  grip: {
    width: sp(2),
    height: sp(14),
    borderRadius: sp(1),
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
})
