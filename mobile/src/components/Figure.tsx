import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View, type TextStyle } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import {
  EASE_ENTER,
  GLIDE_MS,
  LAND_BLUR_FAR,
  LAND_BLUR_NEAR,
  LAND_MS,
  LAND_RISE,
} from '../motion'
import { color, font, sp } from '../theme'

/*
 * Scaled once, at module load. A worklet cannot call `sp()` — an ordinary
 * function reached from the UI thread aborts the app on the spot, with no red
 * box and nothing in the log. Constants and numbers are safe; functions are not.
 */
const SIZE = sp(60)
const TRACK = sp(-1.4)
const RISE = sp(LAND_RISE)

/*
 * The three layers, from softest to sharp. Each carries a *fixed* blur; only
 * their opacities are ever animated, because `filter` is neither a transform
 * nor an opacity and cannot be driven per frame.
 */
const BLURS = [sp(LAND_BLUR_FAR), sp(LAND_BLUR_NEAR), 0]

/*
 * Room for the blur to fall off in.
 *
 * A `RenderEffect` is clipped to the view it is set on, so a blurred glyph in
 * a box its own size comes out as a blurred rectangle with cut edges. Three
 * standard deviations is where a gaussian is spent, so each layer is given
 * that much padding and pulled back by it, leaving the glyph where it was.
 */
const PAD = sp(LAND_BLUR_FAR * 3)

/*
 * Advance widths, in ems, read out of `sf-pro-rounded-600.ttf` itself by
 * `scratchpad/ttf.py` — not estimated, and not measured at runtime.
 *
 * The figure is set in **tabular** figures. SF Pro Rounded's proportional
 * digits are not one width — a '1' is 0.467em against a '0' at 0.638em — so a
 * number set in them changes width by a different amount per keystroke and
 * jitters as it is typed. The font carries a `tnum` feature and under it every
 * digit is exactly 0.631348em, which is what makes the glide below solvable in
 * closed form as well as what stops the jitter.
 */
const EM_DIGIT = 0.631348
const EM_PUNCT = 0.269043

/** How wide a figure will be, before it has been laid out. */
function span(text: string): number {
  let w = 0
  for (const ch of text) w += (ch === ',' || ch === '.' ? EM_PUNCT : EM_DIGIT) * SIZE + TRACK
  return w
}

interface FigureProps {
  /** The formatted figure, e.g. "1,234.5". */
  value: string
  /** '+' or '−'. */
  sign: string
  /** What colour the sign takes — the direction's own. */
  tint: string
}

/**
 * One character, arriving.
 *
 * Three copies of the same glyph at three fixed blurs, handed from the softest
 * to the sharp one by opacity alone while all three rise together. Rendered
 * against a true gaussian at matched times this is very close; the stack of
 * offset copies it replaces was not, and showed its seams.
 *
 * Nothing scales. Scaled text rasterises at its laid-out size and is stretched
 * from there, which softens exactly the glyph this is trying to sharpen.
 */
function Layer({ t, i, ch }: { t: SharedValue<number>; i: number; ch: string }) {
  const style = useAnimatedStyle(() => {
    const p = t.get()
    /* Still fading in while the blur resolves, the way the reference does. */
    const fade = interpolate(p, [0, 0.45], [0, 1], Extrapolation.CLAMP)
    const share =
      i === 0
        ? interpolate(p, [0, 0.35], [1, 0], Extrapolation.CLAMP)
        : i === 1
          ? interpolate(p, [0, 0.35, 0.7], [0, 1, 0], Extrapolation.CLAMP)
          : interpolate(p, [0.35, 0.7], [0, 1], Extrapolation.CLAMP)
    return {
      opacity: fade * share,
      transform: [{ translateY: (1 - p) * RISE }],
    }
  })

  return (
    <Animated.View style={[s.layer, BLUR[i], style]} pointerEvents="none">
      <Text style={s.padded} numberOfLines={1}>
        {ch}
      </Text>
    </Animated.View>
  )
}

/**
 * The character just typed.
 *
 * Holds its own driver and replays it whenever `token` changes, which the
 * parent bumps only when the figure has grown. Backspacing hands this the
 * character underneath without touching the token, so deleting is instant and
 * the character revealed does not re-announce itself.
 *
 * A timing curve, not a spring: nothing here has had a finger on it.
 */
function Landing({ ch, token }: { ch: string; token: number }) {
  const t = useSharedValue(1)
  const started = useRef(false)

  useEffect(() => {
    /* The figure standing there at rest is not an arrival. */
    if (!started.current) {
      started.current = true
      return
    }
    t.set(0)
    t.set(withTiming(1, { duration: LAND_MS, easing: EASE_ENTER }))
  }, [token, t])

  return (
    <View style={s.cell}>
      {/* Sizes the cell and is never seen; the three layers are all absolute. */}
      <Text style={[s.glyph, s.gauge]} numberOfLines={1}>
        {ch}
      </Text>
      {BLURS.map((_, i) => (
        <Layer key={i} t={t} i={i} ch={ch} />
      ))}
    </View>
  )
}

/**
 * The amount, typed a character at a time.
 *
 * One `Text` held the whole figure before this and cannot animate a character
 * on its own, so it is a cell per character and only the last — the one just
 * typed — is ever animated. Everything already set is a plain `Text`.
 *
 * The sign and the currency mark live in here too, rather than beside it, so
 * that the glide below moves the whole group. Sliding only the digits would
 * leave the "−$" standing still and pull the amount apart.
 *
 * **No cell ever animates its width.** Android measures a string against its
 * box and elides it to fit, which is how the Add button once drew as "A…" on
 * the phone; a cell is sized by the character in flow inside it and everything
 * animated is a transform or an opacity.
 *
 * `adjustsFontSizeToFit` went with the single `Text` and is not needed back:
 * the keypad caps the figure at seven digits, the most the hero can set
 * without shrinking, and type and panel scale by the same `sp()`, so what fits
 * at the frame's 393 fits at 360.
 */
export function Figure({ value, sign, tint }: FigureProps) {
  const [token, setToken] = useState(0)
  const seen = useRef(value)
  const shift = useSharedValue(0)

  useEffect(() => {
    const before = seen.current
    if (before === value) return
    seen.current = value

    /*
     * The figure is centred, so a character added on the right takes half its
     * width off the left. Start the group back where it was and let it settle,
     * rather than letting it snap. Solved from the font's own advances, in the
     * same tick as the character — `onLayout` would paint a frame at the new
     * position first, which is a flicker, not a fix. Shrinking glides too, so
     * backspace is the same motion in reverse.
     */
    const d = (span(value) - span(before)) / 2
    if (d !== 0) {
      shift.set(d)
      shift.set(withTiming(0, { duration: GLIDE_MS, easing: EASE_ENTER }))
    }
    if (value.length > before.length) setToken((n) => n + 1)
  }, [value, shift])

  const glide = useAnimatedStyle(() => ({ transform: [{ translateX: shift.get() }] }))

  const chars = value.split('')
  const last = chars.length - 1

  return (
    <Animated.View style={[s.amount, glide]}>
      <Text style={[s.sign, { color: tint }]}>{sign}</Text>
      <Text style={s.currency}>$</Text>
      <View style={s.row}>
        {chars.map((ch, i) =>
          i === last ? (
            /*
             * A stable key, so this keeps its driver across keystrokes and
             * replays rather than remounting — remounting would restart from
             * the default and lose the guard inside.
             */
            <Landing key="landing" ch={ch} token={token} />
          ) : (
            <Text key={i} style={s.glyph} numberOfLines={1}>
              {ch}
            </Text>
          ),
        )}
      </View>
    </Animated.View>
  )
}

/* Built once: a fixed blur is a static style, and must never be animated. */
const BLUR: (TextStyle | null)[] = BLURS.map((b) => (b ? { filter: [{ blur: b }] } : null))

const s = StyleSheet.create({
  amount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp(3) },
  sign: { fontFamily: font.r600, fontSize: sp(36) },
  currency: { fontFamily: font.r600, fontSize: sp(36), color: color.textDim },
  row: { flexDirection: 'row', alignItems: 'center' },
  /* Hugs the character in flow; the three layers hang off it without sizing it. */
  cell: { justifyContent: 'center' },
  glyph: {
    fontFamily: font.r600,
    fontSize: SIZE,
    color: color.text,
    letterSpacing: TRACK,
    /* Tabular, so the figure does not change width per digit as it is typed. */
    fontVariant: ['tabular-nums'],
  },
  gauge: { opacity: 0 },
  /* Pulled back by the padding its own blur needs, so the glyph lands at 0. */
  layer: { position: 'absolute', left: -PAD, top: -PAD },
  padded: {
    fontFamily: font.r600,
    fontSize: SIZE,
    color: color.text,
    letterSpacing: TRACK,
    fontVariant: ['tabular-nums'],
    padding: PAD,
  },
})
