import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import {
  EASE_ENTER,
  LAND_FROM,
  LAND_GHOSTS,
  LAND_GHOST_ALPHA,
  LAND_MS,
  LAND_RISE,
  LAND_SMEAR,
} from '../motion'
import { color, font, sp } from '../theme'

/*
 * Scaled once, at module load, because a worklet cannot call `sp()` — an
 * ordinary function called from the UI thread aborts the app on the spot, with
 * no red box and nothing in the log. Constants and numbers are safe; functions
 * are not.
 */
const RISE = sp(LAND_RISE)
const SMEAR = sp(LAND_SMEAR)

/** Where each copy sits along the trail: evenly spread behind the glyph. */
const TRAIL = Array.from({ length: LAND_GHOSTS }, (_, i) => (i + 1) / LAND_GHOSTS)

/**
 * One copy of the glyph, trailing the real one.
 *
 * Placed by arithmetic at the cell's own origin rather than centred by Yoga —
 * it draws the same character at the same size as the glyph in flow above it,
 * so sharing an origin is all it takes for the two to coincide exactly. An
 * absolutely-positioned child centred by alignment has drawn nothing at all
 * here before.
 */
function Ghost({ t, k, ch }: { t: SharedValue<number>; k: number; ch: string }) {
  const style = useAnimatedStyle(() => {
    const p = t.get()
    const away = 1 - p
    return {
      /* Fades as it slows, so the smear is only ever there while it moves. */
      opacity: away * LAND_GHOST_ALPHA,
      transform: [
        { translateY: away * (RISE + SMEAR * k) },
        { scale: LAND_FROM + (1 - LAND_FROM) * p },
      ],
    }
  })
  return (
    <Animated.Text style={[s.glyph, s.ghost, style]} numberOfLines={1}>
      {ch}
    </Animated.Text>
  )
}

/**
 * The digit just typed, arriving.
 *
 * It holds its own driver and replays it whenever `token` changes, which the
 * parent bumps only when the figure has grown. Backspacing hands this the
 * character underneath without touching the token, so deleting is instant and
 * the digit revealed does not re-announce itself.
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

  const main = useAnimatedStyle(() => {
    const p = t.get()
    return {
      opacity: p,
      transform: [
        { translateY: (1 - p) * RISE },
        { scale: LAND_FROM + (1 - LAND_FROM) * p },
      ],
    }
  })

  return (
    <View style={s.cell}>
      {TRAIL.map((k) => (
        <Ghost key={k} t={t} k={k} ch={ch} />
      ))}
      <Animated.Text style={[s.glyph, main]} numberOfLines={1}>
        {ch}
      </Animated.Text>
    </View>
  )
}

/**
 * The amount, typed a character at a time.
 *
 * One `Text` held the whole string before this. It cannot animate a digit on
 * its own, so the figure is split into a cell per character and only the last
 * one — the one just typed — is ever animated. Everything already set is a
 * plain `Text` and costs nothing.
 *
 * **What each cell must not do is change width while it holds text.** Android
 * measures a string against its box and elides it to fit, and a box caught
 * mid-animation measures short: that is how the Add button once drew as "A…"
 * on the phone while iOS drew it in full. Nothing here animates a width — a
 * cell is sized by the character in flow inside it, and every animated
 * property is a transform or an opacity.
 *
 * `adjustsFontSizeToFit` is gone with the single `Text`, and does not need
 * replacing: the keypad caps the figure at seven digits, which is the most the
 * hero can set without shrinking, and both the type and the panel are scaled
 * by the same `sp()` — so a figure that fits at the frame's 393 fits at 360.
 */
export function Figure({ value }: { value: string }) {
  const [token, setToken] = useState(0)
  const seen = useRef(value)

  useEffect(() => {
    const grew = value.length > seen.current.length
    seen.current = value
    if (grew) setToken((n) => n + 1)
  }, [value])

  const chars = value.split('')
  const last = chars.length - 1

  return (
    <View style={s.row}>
      {chars.map((ch, i) =>
        i === last ? (
          /*
           * A stable key, so this keeps its driver across keystrokes and
           * replays rather than remounting. Remounting on every digit would
           * restart from the default and lose the guard above.
           */
          <Landing key="landing" ch={ch} token={token} />
        ) : (
          <Text key={i} style={s.glyph} numberOfLines={1}>
            {ch}
          </Text>
        ),
      )}
    </View>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  /* Hugs the character in flow; the trail hangs off it without sizing it. */
  cell: { justifyContent: 'center' },
  glyph: {
    fontFamily: font.r600,
    fontSize: sp(60),
    color: color.text,
    letterSpacing: sp(-1.4),
  },
  ghost: { position: 'absolute', left: 0, top: 0 },
})
