import { useLayoutEffect, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { EASE_LAND, GLIDE_MS, LAND_FADE, LAND_MS, LAND_RISE } from '../motion'
import { color, font, sp } from '../theme'

/*
 * Scaled once, at module load. A worklet cannot call `sp()` — an ordinary
 * function reached from the UI thread aborts the app on the spot, with no red
 * box and nothing in the log. Constants and numbers are safe; functions are not.
 */
const SIZE = sp(60)
const TRACK = sp(-1.4)
const RISE = sp(LAND_RISE)
const MARK = sp(36)
const GAP = sp(3)

/*
 * Advance widths in ems, read out of `sf-pro-rounded-600.ttf` by
 * `scratchpad/ttf.py`. '+', '−' and '$' are all one width, so switching
 * direction cannot move the figure.
 */
const EM_DIGIT = 0.631348
const EM_PUNCT = 0.269043
const EM_MARK = 0.631348

/** The slot each character occupies, tracking folded in. */
const DIGIT_W = EM_DIGIT * SIZE + TRACK
const PUNCT_W = EM_PUNCT * SIZE + TRACK
const MARK_W = EM_MARK * MARK

/**
 * The figure is **placed, not laid out.**
 *
 * Everything before this let flexbox position the characters and then tried to
 * correct for wherever it had put them — one transform to undo the re-centring,
 * another to undo a comma shoving its neighbours along. Every one of those
 * corrections is a race against the frame that already moved the character, and
 * each was its own hop to the UI thread; on the keystroke that inserts a
 * separator there were six at once. Whichever lost the race snapped, and that
 * is what kept coming back as "still jerky".
 *
 * So nothing is laid out any more. Every piece is an absolutely-positioned
 * overlay filling the anchor with its glyph centred, and a single `translateX`
 * puts it where it belongs. That one number is an **absolute target**, solved
 * from slot arithmetic at render, and it changes everything:
 *
 *   - **Layout never moves a character**, so an animation that starts a frame
 *     late is a frame late, not a jump. The race is gone rather than won.
 *   - **The target is absolute**, so nothing needs to know where the animation
 *     currently is. `withTiming` starts from wherever it got to, which handles
 *     an interrupted slide natively — no accumulating a remainder, no
 *     `scheduleOnUI`, no reading a shared value from the wrong thread.
 *   - **A new character mounts with its target already set**, so the first
 *     frame it is ever painted in is already right.
 *   - There is no group transform at all. The centring is inside every target.
 *
 * It also drops the last dependency on the font: a glyph is *centred on* its
 * slot rather than filling a box, so its own width cannot matter. Whether
 * `tabular-nums` takes or not, the figure is tabular and the arithmetic holds.
 */
interface Piece {
  key: string
  ch: string
  /** Where its centre goes, measured from the middle of the whole figure. */
  target: number
  /** How far it rises on arrival. Separators and the marks do not. */
  lift: number
  /** Whether it plays an entrance at all. */
  lands: boolean
  size: number
  tint?: string
}

/**
 * Break the figure into pieces and solve where each one's centre goes.
 *
 * Digits are keyed by their place among the *typed* characters, so a digit
 * keeps its key however the grouping shifts it about. Separators are keyed
 * **from the right**, by how many digits follow, because that is what a group
 * separator is: a comma sits three from the end for as long as the number has
 * three. Keyed from the left instead, "123,456" becoming "1,234,567" makes the
 * first separator a *different* separator, with 73pt to travel to catch up.
 *
 * The standing zero is keyed apart from a typed one, or the first press of the
 * pad is the one keystroke in the whole figure that does not animate.
 */
function pieces(value: string, empty: boolean, sign: string, tint: string): Piece[] {
  type Raw = Omit<Piece, 'target'> & { w: number }
  const raw: Raw[] = [
    { key: 'sign', ch: sign, w: MARK_W, lift: 0, lands: false, size: MARK, tint },
    { key: 'mark', ch: '$', w: MARK_W, lift: 0, lands: false, size: MARK, tint: color.textDim },
  ]

  if (empty) {
    raw.push({ key: 'z', ch: value, w: DIGIT_W, lift: 0, lands: true, size: SIZE })
  } else {
    /* How many digits follow each position, so separators can be keyed by it. */
    const after: number[] = []
    let rest = 0
    for (let i = value.length - 1; i >= 0; i--) {
      after[i] = rest
      if (value[i] !== ',') rest++
    }
    let typed = 0
    for (let i = 0; i < value.length; i++) {
      const ch = value[i]
      if (ch === ',') {
        raw.push({ key: `s${after[i]}`, ch, w: PUNCT_W, lift: 0, lands: true, size: SIZE })
      } else {
        const w = ch === '.' ? PUNCT_W : DIGIT_W
        raw.push({ key: `c${typed++}`, ch, w, lift: RISE, lands: true, size: SIZE })
      }
    }
  }

  /* The two marks carry a gap after them; the characters simply abut. */
  const advance = (i: number) => raw[i].w + (i < 2 ? GAP : 0)
  let total = 0
  for (let i = 0; i < raw.length; i++) total += advance(i)

  const out: Piece[] = []
  let x = 0
  for (let i = 0; i < raw.length; i++) {
    const { w, ...rest2 } = raw[i]
    out.push({ ...rest2, target: x + w / 2 - total / 2 })
    x += advance(i)
  }
  return out
}

/**
 * One piece of the figure, at its own place.
 *
 * `translateX` is an absolute target, so mounting with it already set puts the
 * piece right on its first painted frame, and a change animates from wherever
 * the last one got to. Nothing here reads layout and nothing reads the UI
 * thread.
 *
 * The entrance is a rise and a fade, and no scale: scaled text rasterises at
 * its laid-out size and stretches from there, so a glyph that changes size
 * while it moves reads as wobble rather than as arrival. The driver runs
 * **linear** with the cubic ease-out applied along it, so the fade is measured
 * against real time rather than an eased value that would finish it inside
 * ninety milliseconds.
 */
function Mark({ ch, target, lift, lands, size, tint }: Omit<Piece, 'key'>) {
  const x = useSharedValue(target)
  const t = useSharedValue(lands ? 0 : 1)
  const started = useRef(false)

  useLayoutEffect(() => {
    if (started.current) return
    started.current = true
    if (lands) t.set(withTiming(1, { duration: LAND_MS, easing: Easing.linear }))
  }, [lands, t])

  /* An absolute target: no remainder to carry, and nothing to read back. */
  useLayoutEffect(() => {
    x.set(withTiming(target, { duration: GLIDE_MS, easing: EASE_LAND }))
  }, [target, x])

  const style = useAnimatedStyle(() => {
    const p = t.get()
    const e = 1 - (1 - p) * (1 - p) * (1 - p)
    return {
      opacity: interpolate(p, [0, LAND_FADE], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateX: x.get() }, { translateY: (1 - e) * lift }],
    }
  })

  /*
   * **No `numberOfLines`.** It is the prop that turns an overflowing glyph into
   * an ellipsis — the "A…" trap. Nothing here constrains a glyph's width, so
   * there is nothing to overflow, and a single character has nowhere to wrap.
   */
  return (
    <Animated.View style={[s.piece, style]} pointerEvents="none">
      <Text style={[s.glyph, { fontSize: size }, tint ? { color: tint } : null]}>{ch}</Text>
    </Animated.View>
  )
}

interface FigureProps {
  /** The formatted figure, e.g. "1,234.5". */
  value: string
  /** '+' or '−'. */
  sign: string
  /** What colour the sign takes — the direction's own. */
  tint: string
  /** Nothing typed yet, so the figure is a standing zero rather than a total. */
  empty: boolean
}

/**
 * The amount, typed a character at a time.
 *
 * The anchor spans the stage and holds nothing in flow but an invisible zero,
 * which is there to give the row exactly the height a 60pt line has always
 * given it — taken from the same `Text` rather than assumed from metrics, so
 * the figure sits where it has always sat. Every piece is an overlay on top of
 * it, placed by `translateX` alone.
 */
export function Figure({ value, sign, tint, empty }: FigureProps) {
  return (
    <View style={s.anchor}>
      {/* Sets the row's height, and nothing else. */}
      <Text style={[s.glyph, s.gauge]}>0</Text>
      {pieces(value, empty, sign, tint).map(({ key, ...p }) => (
        <Mark key={key} {...p} />
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  /* Spans the stage, so no piece is ever outside its parent and liable to clip. */
  anchor: { alignSelf: 'stretch' },
  gauge: { opacity: 0, width: 0 },
  /*
   * All four edges spelled out. An absolute child left to find its own box has
   * drawn nothing at all in this project before; this one fills the anchor and
   * centres its glyph, and the transform does the placing.
   */
  piece: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontFamily: font.r600,
    fontSize: SIZE,
    color: color.text,
    /*
     * Kept for the glyphs' own side bearings. Nothing depends on it any more:
     * the slots are what make this tabular, and the arithmetic holds whether
     * or not the feature takes.
     */
    fontVariant: ['tabular-nums'],
  },
})
