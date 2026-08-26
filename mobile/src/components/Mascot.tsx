import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { PIG_REACT_DELAY } from '../motion'
import { sp } from '../theme'

const FPS = 12
/** The artwork is drawn at twice the size it is displayed. */
const ART = 2

interface Clip {
  source: ImageSourcePropType
  frames: number
  cols: number
  rows: number
  /** Already scaled: one tile, and where it sits inside the mascot's box. */
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
 * The offsets are quoted against the mascot's own 392 x 294 box, so all three
 * clips land in the same place however differently they were framed. They were
 * framed differently: the idle and the cheer came off a 4:3 canvas, the hide
 * off a square one, because Kling does not offer 4:3.
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
    tileW: sp(tw / ART),
    tileH: sp(th / ART),
    offX: sp(ox / ART),
    offY: sp(oy / ART),
    ms: (frames / FPS) * 1000,
  }
}

const CLIPS = {
  idle: clip(require('../../assets/art/mascot-idle.png'), 49, 7, 226, 220, 87, 43),
  cheer: clip(require('../../assets/art/mascot-cheer.png'), 32, 6, 257, 263, 63, 0),
  hide: clip(require('../../assets/art/mascot-hide.png'), 46, 6, 247, 221, 67, 43),
} as const

export type Reaction = 'cheer' | 'hide'

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
 * The pig, alive.
 *
 * Three generated clips, each keyed off a green screen and packed into its own
 * sheet: an idle he blinks and breathes through on a loop, a cheer for a
 * credit, and a covers-his-eyes for a debit bigger than usual. They are played
 * by sliding a sheet behind a window the size of one of its tiles, so every
 * frame is a `translate` on the UI thread — no decoding per frame, and **no
 * new native dependency**, which is why this runs in Expo Go unchanged.
 *
 * Every clip was generated with `mascot.png` as **both** its start and its end
 * keyframe, so each one begins and ends on the same neutral pose. That is what
 * lets a reaction cut in and hand back to the idle without a pop, and it is
 * why the reactions are trimmed where they come **to rest** rather than where
 * the motion stops — trimming at the last movement hands back a pose the idle
 * cannot continue from.
 *
 * The hop and slump that used to be done with a transform are gone: the clips
 * carry the reaction now.
 */
export function Mascot({ style, arrival }: MascotProps) {
  const [playing, setPlaying] = useState<'idle' | Reaction>('idle')
  const frame = useSharedValue(0)
  const reduced = useReducedMotion()
  const clipNow = CLIPS[playing]

  useEffect(() => {
    frame.set(0)
    if (reduced) return
    /*
     * Linear, and to the frame *count* rather than the last index: the floor
     * below turns this into a step, so it has to sweep the whole of the last
     * frame's slot rather than arriving at it and stopping.
     */
    const timing = withTiming(
      clipNow.frames,
      { duration: clipNow.ms, easing: Easing.linear },
      playing === 'idle'
        ? undefined
        : (done) => {
            'worklet'
            /* scheduleOnRN, not runOnJS — the latter is gone in Reanimated 4. */
            if (done) scheduleOnRN(setPlaying, 'idle')
          },
    )
    frame.set(playing === 'idle' ? withRepeat(timing, -1, false) : timing)
    return () => cancelAnimation(frame)
  }, [playing, reduced, clipNow, frame])

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
     * bloom, which still has this long left to run over the top of everything
     * — a pig that reacts the instant it lands reacts behind a veil at its
     * brightest and is finished before it lifts.
     */
    timer.current = setTimeout(() => setPlaying(kind), PIG_REACT_DELAY)
  }, [arrival])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  /* Which tile is showing. A step, so the sheet never sits between frames. */
  const sheet = useAnimatedStyle(() => {
    const i = Math.min(clipNow.frames - 1, Math.max(0, Math.floor(frame.get())))
    return {
      transform: [
        { translateX: -(i % clipNow.cols) * clipNow.tileW },
        { translateY: -Math.floor(i / clipNow.cols) * clipNow.tileH },
      ],
    }
  })

  return (
    <View style={style} pointerEvents="none">
      {/* One tile's worth of window, where this clip's artwork sits in the box. */}
      <View
        style={[
          s.window,
          { left: clipNow.offX, top: clipNow.offY, width: clipNow.tileW, height: clipNow.tileH },
        ]}
      >
        <Animated.Image
          source={clipNow.source}
          style={[
            { width: clipNow.tileW * clipNow.cols, height: clipNow.tileH * clipNow.rows },
            sheet,
          ]}
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
  window: { position: 'absolute', overflow: 'hidden' },
})
