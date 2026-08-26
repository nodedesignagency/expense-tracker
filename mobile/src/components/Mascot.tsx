import { useEffect, useRef } from 'react'
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
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
import type { Direction } from '../lib/types'
import {
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
  EASE_ENTER,
  EASE_LAND,
} from '../motion'
import { sp } from '../theme'

const SHEET = require('../../assets/art/mascot-idle.png')

/*
 * The sheet's own geometry, in the source pixels it was packed at. Every one
 * of these is printed by the packer, and none of them may be guessed: a tile
 * size one pixel out shears the whole animation sideways as it advances.
 *
 *   49 frames, 7 x 7, tile 226 x 220, art at 2x
 *   the tile sits at (87, 43) inside the mascot's own 392 x 294 box
 */
const FRAMES = 49
const COLS = 7
const FPS = 12
const ART = 2 // the artwork is drawn at twice the size it is displayed

const TILE_W = sp(226 / ART)
const TILE_H = sp(220 / ART)
const OFF_X = sp(87 / ART)
const OFF_Y = sp(43 / ART)
const SHEET_W = TILE_W * COLS
const SHEET_H = TILE_H * Math.ceil(FRAMES / COLS)
const LOOP_MS = (FRAMES / FPS) * 1000

/*
 * Scaled once, at module load. A worklet cannot call `sp()` — an ordinary
 * function reached from the UI thread aborts the app on the spot, with no red
 * box and nothing in the log. The same rule `Figure.tsx` follows.
 */
const RISE = sp(PIG_HOP_RISE)
const FALL = sp(PIG_DIP_FALL)

export interface Arrival {
  /** Bumped once per entry that lands. Nothing happens while it is 0. */
  nonce: number
  direction: Direction
}

interface MascotProps {
  /** The absolutely-positioned 196 x 147 box the card already gives it. */
  style?: StyleProp<ViewStyle>
  arrival?: Arrival
}

/**
 * The pig, alive.
 *
 * The idle is **real frame animation**, not a transform on a still: 49 frames
 * generated from the app's own `mascot.png` and keyed off a green screen, so
 * he blinks and breathes rather than merely moving about. They are packed into
 * one sheet and played by sliding it behind a window the size of one tile —
 * so every frame of this is a `translate`, on the UI thread, with no image
 * decoding, no source swapping and no new native dependency.
 *
 * The loop is seamless because the clip was generated with `mascot.png` as
 * **both** its start and its end keyframe: measured, the last frame differs
 * from the first by 1.03/255.
 *
 * The arrival reaction is still a transform over the top — a hop on a credit,
 * a slump on a debit — because there are no generated reaction clips yet. It
 * is deliberately kept on **separate shared values that are summed** with
 * nothing else, so that when reaction clips do arrive it lifts out cleanly.
 *
 * **No rotation.** `TILT` is `false` everywhere else in this app for the
 * reason that applies here too: flat art with the depth painted in has no side
 * face to reveal.
 */
export function Mascot({ style, arrival }: MascotProps) {
  const frame = useSharedValue(0)
  const reactY = useSharedValue(0)
  const reactScale = useSharedValue(1)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    /*
     * Linear, and to the frame *count* rather than the last index: the floor
     * below turns this into a step, so it must sweep the whole of the last
     * frame's slot rather than arriving at it and stopping.
     */
    frame.set(
      withRepeat(withTiming(FRAMES, { duration: LOOP_MS, easing: Easing.linear }), -1, false),
    )
    return () => cancelAnimation(frame)
  }, [reduced, frame])

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

  /* Which tile is showing. A step, so the sheet never sits between frames. */
  const sheet = useAnimatedStyle(() => {
    const i = Math.min(FRAMES - 1, Math.max(0, Math.floor(frame.get())))
    return {
      transform: [
        { translateX: -(i % COLS) * TILE_W },
        { translateY: -Math.floor(i / COLS) * TILE_H },
      ],
    }
  })

  const react = useAnimatedStyle(() => ({
    transform: [{ translateY: reactY.get() }, { scale: reactScale.get() }],
  }))

  return (
    <Animated.View style={[style, react]} pointerEvents="none">
      {/* One tile's worth of window, where the artwork sits in its own box. */}
      <View style={[s.window, { left: OFF_X, top: OFF_Y, width: TILE_W, height: TILE_H }]}>
        <Animated.Image
          source={SHEET}
          style={[{ width: SHEET_W, height: SHEET_H }, sheet]}
          resizeMode="stretch"
          fadeDuration={0}
        />
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  /*
   * `overflow: hidden` is what makes this a sprite player at all — without it
   * the whole sheet draws and you get 49 pigs in a grid.
   */
  window: { position: 'absolute', overflow: 'hidden' },
})
