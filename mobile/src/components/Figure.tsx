import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { EASE_LAND, GLIDE_MS, LAND_FADE, LAND_FROM, LAND_MS, LAND_RISE } from '../motion'
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
 * The character just typed, arriving.
 *
 * It rises into its seat, grows the last of the way into full size, and fades
 * up as it goes. **Transform and opacity, and nothing else.**
 *
 * There is no blur in here and there is not going to be one. Faking it by
 * stacking offset copies showed the copies as ridges; React Native's own
 * `filter: [{ blur }]` drew a solid grey rectangle the size of the view on the
 * owner's simulator, with no glyph in it at all. Both bundled clean and both
 * were only caught on a device. What is left is the reference's motion minus
 * the one part of it the platform cannot be trusted to draw — and it cannot
 * glitch, because there is nothing in it to decline.
 *
 * The scale is small and it ends at exactly 1: text rasterises at its
 * laid-out size and is stretched from there, so anything still scaled at rest
 * is a permanently soft glyph.
 *
 * A timing curve, not a spring — nothing here has had a finger on it. The
 * driver runs **linear** and the cubic ease-out is applied along it, so the
 * fade is measured against real time rather than against an eased value that
 * would have finished it inside ninety milliseconds.
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
    /* Linear; the shape is applied along it below. See `LAND_FADE`. */
    t.set(withTiming(1, { duration: LAND_MS, easing: Easing.linear }))
  }, [token, t])

  const style = useAnimatedStyle(() => {
    const p = t.get()
    /* Cubic ease-out, applied along a linear run rather than baked into it. */
    const e = 1 - (1 - p) * (1 - p) * (1 - p)
    return {
      opacity: interpolate(p, [0, LAND_FADE], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: (1 - e) * RISE },
        { scale: LAND_FROM + (1 - LAND_FROM) * e },
      ],
    }
  })

  return (
    <Animated.Text style={[s.glyph, style]} numberOfLines={1}>
      {ch}
    </Animated.Text>
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
 * **Nothing here animates a width.** Android measures a string against its box
 * and elides it to fit, which is how the Add button once drew as "A…" on the
 * phone; every character is sized by itself and everything animated is a
 * transform or an opacity.
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
      shift.set(withTiming(0, { duration: GLIDE_MS, easing: EASE_LAND }))
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

const s = StyleSheet.create({
  amount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp(3) },
  sign: { fontFamily: font.r600, fontSize: sp(36) },
  currency: { fontFamily: font.r600, fontSize: sp(36), color: color.textDim },
  row: { flexDirection: 'row', alignItems: 'center' },
  glyph: {
    fontFamily: font.r600,
    fontSize: SIZE,
    color: color.text,
    letterSpacing: TRACK,
    /* Tabular, so the figure does not change width per digit as it is typed. */
    fontVariant: ['tabular-nums'],
  },
})
