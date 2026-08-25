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

/**
 * One cell of the figure, and the identity that decides whether it is new.
 *
 * Keys are the whole trick. A digit is keyed by its place among the *typed*
 * characters, so it keeps that key however the grouping moves it about: '999'
 * becoming '9,999' leaves the three digits already there exactly where they
 * were as far as React is concerned, and only the fourth is new. Key by the
 * position in the rendered string instead and inserting a comma shunts every
 * digit after it onto a fresh key, remounting — and re-animating — half the
 * number at once.
 *
 * Group separators are keyed apart from the digits and never animate. They are
 * not typed; they arrive because the number crossed a thousand, and a comma
 * flying up out of the middle of a figure says something happened there that
 * did not.
 */
interface Cell {
  ch: string
  key: string
  /** Digits and the decimal point are typed. Commas are not. */
  typed: boolean
}

function cells(value: string, empty: boolean): Cell[] {
  /*
   * The nothing-typed-yet zero is keyed apart from a typed one.
   *
   * Sharing a key with the first real digit, it simply had its character
   * swapped underneath it — same cell, new glyph — so the first press of the
   * pad was the one keystroke in the whole figure that did not animate.
   */
  if (empty) return [{ ch: value, key: 'z', typed: false }]

  const out: Cell[] = []
  let typed = 0
  let seps = 0
  for (const ch of value) {
    if (ch === ',') out.push({ ch, key: `s${seps++}`, typed: false })
    else out.push({ ch, key: `c${typed++}`, typed: true })
  }
  return out
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
 * A typed character, arriving.
 *
 * **It animates because it mounted, not because something told it to.** Its
 * driver is 0 on the very first render, so the first frame it is ever painted
 * in is already the start of the animation — there is no state to change, no
 * second render to wait for, and nothing to correct after the fact.
 *
 * That is the whole fix. The version before this reused one component for
 * whichever character was last and reset it from a `useEffect`, which runs
 * after paint; every keystroke drew the digit whole and in place, blinked it
 * out and replayed it. `useLayoutEffect` here runs inside the commit, before
 * the frame is mounted, but even it is only belt and braces: at worst the
 * character waits a frame invisible, which is nothing to look at.
 *
 * A rise and a fade, and no scale. Scaled text rasterises at its laid-out size
 * and stretches from there, and a glyph that changes size while it moves reads
 * as wobble rather than as arrival.
 *
 * The driver runs **linear** and the cubic ease-out is applied along it, so the
 * fade is measured against real time rather than against an eased value that
 * would have finished it inside ninety milliseconds.
 */
function Glyph({ ch }: { ch: string }) {
  const t = useSharedValue(0)
  const started = useRef(false)

  useLayoutEffect(() => {
    if (started.current) return
    started.current = true
    t.set(withTiming(1, { duration: LAND_MS, easing: Easing.linear }))
  }, [t])

  const style = useAnimatedStyle(() => {
    const p = t.get()
    const e = 1 - (1 - p) * (1 - p) * (1 - p)
    return {
      opacity: interpolate(p, [0, LAND_FADE], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: (1 - e) * RISE }],
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
 * on its own, so it is a cell per character — and each cell is keyed by what it
 * *is* rather than where it sits, so only a character that is genuinely new
 * mounts, and only a character that mounts animates. Nothing else in here
 * decides what to animate; the keys do.
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
export function Figure({ value, sign, tint, empty }: FigureProps) {
  const seen = useRef(value)
  const shift = useSharedValue(0)

  /*
   * The figure is centred, so a character added on the right takes half its
   * width off the left. Start the group back where it was and let it settle,
   * rather than letting it snap.
   *
   * Solved from the font's own advances rather than measured, and set in a
   * **layout** effect, which runs inside the commit rather than after the
   * paint. `useEffect` here would paint one frame at the new position before
   * correcting it, and a jump backwards is worse than the jump it was meant to
   * smooth. Shrinking glides too, so backspace is the same motion in reverse.
   */
  useLayoutEffect(() => {
    const before = seen.current
    if (before === value) return
    seen.current = value
    const d = (span(value) - span(before)) / 2
    if (d === 0) return
    shift.set(d)
    shift.set(withTiming(0, { duration: GLIDE_MS, easing: EASE_LAND }))
  }, [value, shift])

  const glide = useAnimatedStyle(() => ({ transform: [{ translateX: shift.get() }] }))

  return (
    <Animated.View style={[s.amount, glide]}>
      <Text style={[s.sign, { color: tint }]}>{sign}</Text>
      <Text style={s.currency}>$</Text>
      <View style={s.row}>
        {cells(value, empty).map((cell) =>
          cell.typed ? (
            <Glyph key={cell.key} ch={cell.ch} />
          ) : (
            <Text key={cell.key} style={s.glyph} numberOfLines={1}>
              {cell.ch}
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
