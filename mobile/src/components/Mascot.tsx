import { useEffect, useRef, useState } from 'react'
import {
  Image,
  PixelRatio,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
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

const FPS = 12
/** The artwork is drawn at twice the size it is displayed. */
const ART = 2

/** How long he stays still between coming alive, in ms. */
const IDLE_MIN = 25_000
const IDLE_MAX = 32_000

/**
 * Snapped to a whole device pixel.
 *
 * **This is what made him shimmer.** A tile is 226 artwork pixels, which is
 * `sp(113)` — and on the owner's 360pt phone `sp` is 0.916, so that is
 * 103.51pt. Every tile boundary then landed on a fraction of a pixel, each
 * frame resampled at a slightly different sub-pixel phase, and the pig
 * appeared to shift about while standing still. Rounding the tile to the
 * device's own grid makes every step an exact whole number of pixels.
 */
const px = (n: number) => PixelRatio.roundToNearestPixel(sp(n / ART))

interface Clip {
  source: ImageSourcePropType
  frames: number
  cols: number
  rows: number
  tileW: number
  tileH: number
  offX: number
  offY: number
  ms: number
}

/*
 * Every number here is printed by the packer in `scratchpad/pig/` and **none
 * may be guessed** — a tile one pixel out shears the animation sideways as it
 * advances, and an offset one pixel out slides the pig in the card.
 *
 * The offsets are quoted against the mascot's own 392 x 294 box, so clips
 * framed differently still land in the same place. `offY` may be negative:
 * the idle's artwork reaches slightly above the box.
 */
function clip(
  source: ImageSourcePropType,
  frames: number,
  cols: number,
  tw: number,
  th: number,
  ox: number,
  oy: number,
): Clip {
  return {
    source,
    frames,
    cols,
    rows: Math.ceil(frames / cols),
    tileW: px(tw),
    tileH: px(th),
    offX: px(ox),
    offY: px(oy),
    ms: (frames / FPS) * 1000,
  }
}

const CLIPS = {
  idle: clip(require('../../assets/art/mascot-idle.png'), 21, 7, 226, 220, 87, -5),
  cheer: clip(require('../../assets/art/mascot-cheer.png'), 32, 6, 257, 263, 63, 0),
} as const

/** Frame 0's tile, so the still and the sheet's first frame are identical. */
const REST = require('../../assets/art/mascot-rest.png')

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
 * **He is still most of the time.** The idle used to loop without stopping,
 * which the owner found both laggy and wearing — a thing that never rests
 * stops being noticed and never stops costing. So at rest nothing animates at
 * all: a single still frame is drawn and no sheet is touched. Every 25 to 32
 * seconds he comes alive for 1.75s — a blink and a breath — and goes back to
 * being still. A credit gets the cheer.
 *
 * The interval is jittered rather than fixed, so it never reads as a metronome.
 *
 * Playback slides a sheet behind a window one tile wide, so every frame is a
 * `translate` on the UI thread — no decoding per frame, and **no new native
 * dependency**, which is why it runs in Expo Go unchanged. Clips were
 * generated with `mascot.png` as both start and end keyframe, so each begins
 * and ends on the resting pose and can hand back without a pop.
 */
export function Mascot({ style, arrival }: MascotProps) {
  const [mode, setMode] = useState<Mode>('rest')
  const frame = useSharedValue(0)
  const reduced = useReducedMotion()
  /* At rest the window keeps the idle's geometry, since the still is its tile. */
  const shape = mode === 'cheer' ? CLIPS.cheer : CLIPS.idle

  /*
   * Rescheduled every time he settles, rather than run off one interval: a
   * repeating timer would keep firing behind a reaction and stack up.
   */
  useEffect(() => {
    if (mode !== 'rest' || reduced) return
    const wait = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN)
    const t = setTimeout(() => setMode('idle'), wait)
    return () => clearTimeout(t)
  }, [mode, reduced])

  useEffect(() => {
    if (mode === 'rest') return
    const c = CLIPS[mode]
    frame.set(0)
    /*
     * Linear, and to the frame *count* rather than the last index: the floor
     * below turns this into a step, so it has to sweep the whole of the last
     * frame's slot rather than arriving at it and stopping.
     */
    frame.set(
      withTiming(c.frames, { duration: c.ms, easing: Easing.linear }, (done) => {
        'worklet'
        /* scheduleOnRN, not runOnJS — the latter is gone in Reanimated 4. */
        if (done) scheduleOnRN(setMode, 'rest')
      }),
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
    const i = Math.min(shape.frames - 1, Math.max(0, Math.floor(frame.get())))
    return {
      transform: [
        { translateX: -(i % shape.cols) * shape.tileW },
        { translateY: -Math.floor(i / shape.cols) * shape.tileH },
      ],
    }
  })

  const window = {
    left: shape.offX,
    top: shape.offY,
    width: shape.tileW,
    height: shape.tileH,
  }

  return (
    <View style={style} pointerEvents="none">
      <View style={[s.window, window]}>
        {mode === 'rest' ? (
          <Image
            source={REST}
            style={{ width: shape.tileW, height: shape.tileH }}
            resizeMode="stretch"
            fadeDuration={0}
          />
        ) : (
          <Animated.Image
            source={shape.source}
            style={[
              { width: shape.tileW * shape.cols, height: shape.tileH * shape.rows },
              sheet,
            ]}
            resizeMode="stretch"
            fadeDuration={0}
          />
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  /*
   * `overflow: hidden` is what makes this a sprite player at all — without it
   * the whole sheet draws and you get every frame at once in a grid.
   */
  window: { position: 'absolute', overflow: 'hidden' },
})
