import { useMemo, useRef } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { EASE_ENTER, EASE_MOVE, MOVE } from '../motion'
import { capTrim, color, font, radius, sp } from '../theme'
import { ChevronRightIcon } from './Icons'

const TRACK_H = sp(60)
const PAD = sp(5)
const THUMB = TRACK_H - PAD * 2
/** How far along it has to get before letting go counts as meaning it. */
const COMMIT = 0.86

interface SlideActionProps {
  /** The whole control's width, so the travel can be worked out up front. */
  width: number
  label: string
  /** What the fill glows with — the ledger's own red or green. */
  tint: string
  /**
   * Called once the thumb has been carried far enough and let go. Return false
   * to refuse it: the thumb goes back and the caller says why.
   */
  onCommit: () => boolean
}

/**
 * Slide to add.
 *
 * A tap is one event and this one writes to the ledger, so it asks for a
 * gesture with some length in it instead — the same reason a payment sheet
 * does. Carrying the thumb across lights the track in the direction's own
 * colour, so the confirmation says which kind of entry it is while it is being
 * given rather than after.
 *
 * Driven from PanResponder rather than a gesture library. It is a plain
 * left-to-right drag with nothing else moving on screen while it happens, and
 * the alternative is a native dependency and a root wrapper around the whole
 * app for one control.
 */
export function SlideAction({ width, label, tint, onCommit }: SlideActionProps) {
  const travel = Math.max(width - THUMB - PAD * 2, 1)
  /* 0 at rest, 1 carried the whole way. Shared, so the paint stays off JS. */
  const at = useSharedValue(0)
  const held = useSharedValue(0)

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2,
        onPanResponderGrant: () => {
          held.set(withTiming(1, { duration: 120, easing: EASE_ENTER }))
        },
        onPanResponderMove: (_, g) => {
          at.set(Math.min(Math.max(g.dx / travel, 0), 1))
        },
        onPanResponderRelease: (_, g) => {
          held.set(withTiming(0, { duration: 160, easing: EASE_ENTER }))
          const reached = Math.min(Math.max(g.dx / travel, 0), 1)
          /* Carried far enough and accepted: run it home rather than snap. */
          if (reached >= COMMIT && onCommit()) {
            at.set(withTiming(1, { duration: 140, easing: EASE_ENTER }))
            return
          }
          at.set(withTiming(0, { duration: MOVE, easing: EASE_MOVE }))
        },
        onPanResponderTerminate: () => {
          held.set(withTiming(0, { duration: 160, easing: EASE_ENTER }))
          at.set(withTiming(0, { duration: MOVE, easing: EASE_MOVE }))
        },
      }),
    [at, held, onCommit, travel],
  )

  const thumb = useAnimatedStyle(() => ({
    transform: [
      { translateX: at.get() * travel },
      { scale: interpolate(held.get(), [0, 1], [1, 1.04]) },
    ],
  }))

  /* The lit part follows the thumb, so the colour is something being drawn. */
  const fill = useAnimatedStyle(() => ({
    width: PAD + THUMB / 2 + at.get() * travel,
    opacity: interpolate(at.get(), [0, 0.06], [0, 1], 'clamp'),
  }))

  /* The instruction goes as the gesture takes over from it. */
  const caption = useAnimatedStyle(() => ({
    opacity: interpolate(at.get(), [0, 0.55], [1, 0], 'clamp'),
  }))

  return (
    <View style={[s.track, { width }]}>
      <Animated.View style={[s.fill, fill]} pointerEvents="none">
        <LinearGradient
          colors={[`${tint}00`, `${tint}66`, `${tint}CC`]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.Text style={[s.caption, caption]} pointerEvents="none" numberOfLines={1}>
        {label}
      </Animated.Text>

      <Animated.View style={[s.thumb, thumb]} {...responder.panHandlers}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onCommit}
          style={s.thumbInner}
        >
          <ChevronRightIcon size={sp(22)} color={color.bg} />
        </Pressable>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  track: {
    height: TRACK_H,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { ...StyleSheet.absoluteFillObject, right: undefined },
  caption: {
    fontFamily: font.r500,
    fontSize: sp(16),
    ...capTrim(sp(16)),
    color: color.textSoft,
    textAlign: 'center',
  },
  thumb: {
    position: 'absolute',
    left: PAD,
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
  },
  thumbInner: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: color.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
