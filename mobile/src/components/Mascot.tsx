import { useEffect, useRef } from 'react'
import { Image, type StyleProp, type ImageStyle } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { MASCOT_SRC } from '../assets/registry'
import type { Direction } from '../lib/types'
import {
  PIG_BOB,
  PIG_BOB_MS,
  PIG_BREATH,
  PIG_BREATH_MS,
  PIG_DIP_BACK,
  PIG_DIP_DOWN,
  PIG_DIP_FALL,
  PIG_DIP_SHRINK,
  PIG_HOP_DIP,
  PIG_HOP_RISE,
  PIG_HOP_SETTLE,
  PIG_HOP_SQUASH,
  PIG_HOP_STRETCH,
  PIG_HOP_UP,
  PIG_REACT_DELAY,
} from '../motion'
import { EASE_ENTER, EASE_LAND } from '../motion'
import { sp } from '../theme'

const AnimatedImage = Animated.createAnimatedComponent(Image)

/*
 * Scaled once, at module load. A worklet cannot call `sp()` — an ordinary
 * function reached from the UI thread aborts the app on the spot, with no red
 * box and nothing in the log. The same rule `Figure.tsx` follows.
 */
const RISE = sp(PIG_HOP_RISE)
const FALL = sp(PIG_DIP_FALL)
const BOB = sp(PIG_BOB)
/* The drawn height, which the breath's counter-translate is solved against. */
const H = sp(147)

const EASE_IDLE = Easing.inOut(Easing.sin)

export interface Arrival {
  /** Bumped once per entry that lands. Nothing happens while it is 0. */
  nonce: number
  direction: Direction
}

interface MascotProps {
  style?: StyleProp<ImageStyle>
  arrival?: Arrival
}

/**
 * The pig, alive.
 *
 * Two things move it, and they are kept on **separate shared values that are
 * summed** rather than one value they take turns owning. An entry landing
 * mid-breath must add to the breath, not replace it — replacing it snaps the
 * idle loop to wherever the reaction starts, and snaps back when it ends.
 * (The same lesson as the figure's glide: add to what is in flight.)
 *
 * Only transform and opacity, so every frame of this is on the UI thread.
 *
 * **No rotation.** `TILT` is `false` everywhere else in this app for the
 * reason that applies here too: these are flat images with the depth painted
 * in, so turning one reveals no side face and it simply squashes.
 */
export function Mascot({ style, arrival }: MascotProps) {
  const idleY = useSharedValue(0)
  const breath = useSharedValue(1)
  const reactY = useSharedValue(0)
  const reactScale = useSharedValue(1)

  /*
   * Honoured rather than ignored: this loop never stops, and a permanently
   * moving thing is exactly what the setting is for. The reactions still play
   * — they are brief and they are a response to something the user just did.
   */
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    idleY.set(
      withRepeat(withTiming(-BOB, { duration: PIG_BOB_MS / 2, easing: EASE_IDLE }), -1, true),
    )
    breath.set(
      withRepeat(
        withTiming(PIG_BREATH, { duration: PIG_BREATH_MS / 2, easing: EASE_IDLE }),
        -1,
        true,
      ),
    )
    return () => {
      cancelAnimation(idleY)
      cancelAnimation(breath)
    }
  }, [reduced, idleY, breath])

  /*
   * Keyed on the nonce, not on the entry: the ledger re-sorts and re-filters
   * constantly, and reacting to the newest *row* would have the pig hop every
   * time the scope toggle moved.
   */
  const seen = useRef(0)
  useEffect(() => {
    const nonce = arrival?.nonce ?? 0
    if (!nonce || nonce === seen.current) return
    seen.current = nonce

    if (arrival?.direction === 'credit') {
      /* Anticipation down, then up, then home. */
      reactScale.set(
        withDelay(
          PIG_REACT_DELAY,
          withSequence(
            withTiming(PIG_HOP_SQUASH, { duration: PIG_HOP_DIP, easing: EASE_ENTER }),
            withTiming(PIG_HOP_STRETCH, { duration: PIG_HOP_UP, easing: EASE_LAND }),
            withTiming(1, { duration: PIG_HOP_SETTLE, easing: EASE_LAND }),
          ),
        ),
      )
      reactY.set(
        withDelay(
          PIG_REACT_DELAY,
          withSequence(
            withTiming(0, { duration: PIG_HOP_DIP }),
            withTiming(-RISE, { duration: PIG_HOP_UP, easing: EASE_LAND }),
            withTiming(0, { duration: PIG_HOP_SETTLE, easing: EASE_ENTER }),
          ),
        ),
      )
    } else {
      reactScale.set(
        withDelay(
          PIG_REACT_DELAY,
          withSequence(
            withTiming(PIG_DIP_SHRINK, { duration: PIG_DIP_DOWN, easing: EASE_ENTER }),
            withTiming(1, { duration: PIG_DIP_BACK, easing: EASE_LAND }),
          ),
        ),
      )
      reactY.set(
        withDelay(
          PIG_REACT_DELAY,
          withSequence(
            withTiming(FALL, { duration: PIG_DIP_DOWN, easing: EASE_ENTER }),
            withTiming(0, { duration: PIG_DIP_BACK, easing: EASE_LAND }),
          ),
        ),
      )
    }
  }, [arrival, reactY, reactScale])

  const animated = useAnimatedStyle(() => {
    const s = breath.get() * reactScale.get()
    /*
     * Scaling about the centre pushes the bottom edge down by H(s-1)/2, which
     * reads as the whole pig inflating. Cancelling that keeps its feet planted
     * and puts the swell into its chest, which is what a breath looks like.
     */
    const plant = (H * (s - 1)) / 2
    return { transform: [{ translateY: idleY.get() + reactY.get() - plant }, { scale: s }] }
  })

  return (
    <AnimatedImage source={MASCOT_SRC} style={[style, animated]} resizeMode="contain" />
  )
}
