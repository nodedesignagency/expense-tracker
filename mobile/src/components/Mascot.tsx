import { useEffect, useRef, useState } from 'react'
import { PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { PIG_REACT_DELAY } from '../motion'
import { sp } from '../theme'

const SHEET = require('../../assets/art/mascot-sheet.png')

const FPS = 12
/** The artwork is drawn at twice the size it is displayed. */
const ART = 2

/*
 * **One sheet, one tile, one window — nothing is ever swapped.**
 *
 * Every clip is packed into a single texture against a single union crop, so
 * the source, the window's size and its position are fixed for the life of the
 * component and the only thing that changes is a `translate`. That is what
 * removes the blink: a still and a sheet were two different elements, so React
 * unmounted one and mounted the other, and the new texture had to decode
 * before it could paint. There is nothing left to decode mid-flight.
 *
 * Printed by the packer in `scratchpad/pig/`; **none of it may be guessed** —
 * a tile one pixel out shears the animation as it advances, and an offset one
 * pixel out slides the pig in the card.
 */
const FRAMES = 53
const COLS = 8
const TILE_W_ART = 257
const TILE_H_ART = 220 + 43 // 263, the union across every clip
const OFF_X_ART = 63
const OFF_Y_ART = 0

/** Where each clip lives in the sheet. Resting is simply parked on frame 0. */
const IDLE = { from: 0, to: 21 }
const CHEER = { from: 21, to: FRAMES }

/** How long he stays still between coming alive, in ms. */
const IDLE_MIN = 25_000
const IDLE_MAX = 32_000

/**
 * Snapped to a whole device pixel.
 *
 * **This is what made him shimmer.** A tile of 257 artwork pixels is
 * `sp(128.5)` — and on the owner's 360pt phone `sp` is 0.916, so every tile
 * boundary landed on a fraction of a pixel, each frame resampled at a slightly
 * different sub-pixel phase, and the pig appeared to shift about while
 * standing still. Rounding to the device's own grid makes every step an exact
 * whole number of pixels.
 */
const px = (n: number) => PixelRatio.roundToNearestPixel(sp(n / ART))

const TILE_W = px(TILE_W_ART)
const TILE_H = px(TILE_H_ART)
const OFF_X = px(OFF_X_ART)
const OFF_Y = px(OFF_Y_ART)
const SHEET_W = TILE_W * COLS
const SHEET_H = TILE_H * Math.ceil(FRAMES / COLS)

export type Reaction = 'cheer'
type Mode = 'rest' | 'idle' | Reaction

export interface Arrival {
  /** Bumped once per entry worth reacting to. Nothing happens while it is 0. */
  nonce: number
  kind: Reaction
}

interface MascotProps {
  /** The absolutely-positioned 196 x 147 box the card already gives it. */
  style?: StyleProp<ViewStyle>
  arrival?: Arrival
}

/**
 * The pig.
 *
 * **He is still most of the time**, parked on the sheet's first frame. Every
 * 25 to 32 seconds he comes alive for 1.75s — a blink and a breath — and parks
 * again. A credit gets the cheer. The interval is jittered rather than fixed,
 * so it never reads as a metronome.
 *
 * Resting is not a different image, it is the same sheet held at frame 0. The
 * clips were generated with `mascot.png` as both their start and end keyframe,
 * so every one of them begins and ends on that exact pose — which is what lets
 * a reaction cut in, and hand back, without anything appearing to jump.
 */
export function Mascot({ style, arrival }: MascotProps) {
  const [mode, setMode] = useState<Mode>('rest')
  const frame = useSharedValue(IDLE.from)
  const reduced = useReducedMotion()

  /*
   * Rescheduled every time he settles, rather than run off one repeating
   * interval: a repeating timer would keep firing behind a reaction and stack.
   */
  useEffect(() => {
    if (mode !== 'rest' || reduced) return
    const wait = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN)
    const t = setTimeout(() => setMode('idle'), wait)
    return () => clearTimeout(t)
  }, [mode, reduced])

  useEffect(() => {
    if (mode === 'rest') {
      frame.set(IDLE.from)
      return
    }
    const { from, to } = mode === 'cheer' ? CHEER : IDLE
    frame.set(from)
    /*
     * Linear, and to the range's end rather than its last index: the floor
     * below turns this into a step, so it has to sweep the whole of the last
     * frame's slot rather than arriving at it and stopping.
     */
    frame.set(
      withTiming(
        to,
        { duration: ((to - from) / FPS) * 1000, easing: Easing.linear },
        (done) => {
          'worklet'
          /* scheduleOnRN, not runOnJS — the latter is gone in Reanimated 4. */
          if (done) scheduleOnRN(setMode, 'rest')
        },
      ),
    )
    return () => cancelAnimation(frame)
  }, [mode, frame])

  /*
   * Keyed on the nonce, not on the entry: the ledger re-sorts and re-filters
   * constantly, and reacting to whichever row is newest would set him off
   * every time the scope toggle moved.
   */
  const seen = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const nonce = arrival?.nonce ?? 0
    if (!nonce || nonce === seen.current || !arrival) return
    seen.current = nonce
    const kind = arrival.kind
    if (timer.current) clearTimeout(timer.current)
    /*
     * Held back on purpose. The entry is filed halfway through the commit
     * bloom, which still has this long left to run over everything — a pig
     * that reacts the instant it lands reacts behind a veil at its brightest
     * and is finished before it lifts.
     */
    timer.current = setTimeout(() => setMode(kind), PIG_REACT_DELAY)
  }, [arrival])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

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

  return (
    <View style={style} pointerEvents="none">
      <View style={s.window}>
        <Animated.Image
          source={SHEET}
          style={[{ width: SHEET_W, height: SHEET_H }, sheet]}
          resizeMode="stretch"
          fadeDuration={0}
        />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  /*
   * `overflow: hidden` is what makes this a sprite player at all — without it
   * the whole sheet draws and you get every frame at once in a grid.
   */
  window: {
    position: 'absolute',
    overflow: 'hidden',
    left: OFF_X,
    top: OFF_Y,
    width: TILE_W,
    height: TILE_H,
  },
})
