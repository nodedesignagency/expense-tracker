import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import type { Direction } from '../lib/types'
import { EASE_ENTER, MENU, MENU_STAGGER } from '../motion'
import { capTrim, color, font, metric } from '../theme'
import { NAV_BOTTOM, NAV_HEIGHT } from './BottomNav'
import { ArrowLeftDownIcon, ArrowRightUpIcon } from './Icons'

/*
 * The Add button asks which side first.
 *
 * An entry is a credit or a debit before it is anything else, and the composer
 * was opening on debit every time and making the user correct it. So the
 * button no longer opens the sheet — it opens two choices, and the sheet comes
 * up already set to the one that was picked.
 *
 * Transcribed from the Credit and Debit frames, nodes 21:106 and 21:100. Both
 * are one width — they do not hug their names the way a nav destination does,
 * so the pair squares off on the right and the two labels start on the same
 * line. Sizes are the frame's, unscaled, for the reason set out in BottomNav:
 * a height is not bound by the width of the screen.
 *
 * Carrying the same 1.3 the bar does, and for the same reason: the frame's 40
 * is under what either platform asks of a touch target, and these are the two
 * controls a wrong tap costs the most on. The type is held back to 16 rather
 * than taken to the full 19.5, which keeps them the weight of the bar below.
 *
 * The width is not 100 lifted. With the label held back the content no longer
 * fills a lifted box, so it is measured out instead: the padding, the chip,
 * the gap, the longer of the two names, and the frame's own 10.67 of air on
 * the right, all lifted. That comes to 120.
 */
const LIFT = 1.3
const PILL_W = 120
const PILL_H = 40 * LIFT
/** The frame says 42.667, which on a box this deep is as round as it goes. */
const PILL_R = PILL_H / 2
const PILL_PAD_L = 3.333 * LIFT
const PILL_GAP = 6 * LIFT
/** Flat and opaque, not glass: the chip inside is what carries the light. */
const PILL_BG = '#262626'

const CHIP_W = 40 * LIFT
const CHIP_H = 33.333 * LIFT
/** 60 in the frame, so again the full round. */
const CHIP_R = CHIP_H / 2
const GLYPH = 20 * LIFT

const LABEL = 16
const STACK_GAP = 12 * LIFT

interface Tint {
  /** The chip's flat wash. */
  base: string
  /** The light caught around its edge. */
  edge: string
  /** The arrow, which is the ledger's own colour rather than the wash's. */
  glyph: string
}

/*
 * The wash and the edge are this component's own reds and greens, a step
 * cleaner than the ledger's; the arrow inside is the ledger's exactly. The two
 * alphas are not the same either — green reads weaker than red at the same
 * strength, and the frame corrects for it.
 */
const TINT: Record<Direction, Tint> = {
  debit: { base: 'rgba(255,84,84,0.15)', edge: '#FF5454', glyph: color.debit },
  credit: { base: 'rgba(84,255,84,0.2)', edge: '#54FF54', glyph: color.credit },
}

/*
 * The chip's edge light. The frame gives it as a radial ramp that is nothing
 * at all until 81% and solid by 100, painted at 60% — so what shows is a band
 * around the outside and almost nothing through the middle. Worked through,
 * the ramp ends exactly on the bottom edge of the chip and is still clear at
 * the top, so the light gathers underneath, where a thing sitting in a lit box
 * would catch it.
 *
 * The frame's own transform, carried across rather than resolved into radii.
 * An ellipse written as rx/ry is not a thing SVG gradients have: react-native-
 * svg takes the props and hands them straight to the DOM, where the browser
 * drops them and falls back to a default radius — the chip came out flooded
 * rather than rimmed. A matrix is SVG 1.1, and both targets read it the same.
 *
 * It is quoted in the frame's own 40 by 33.333, so the chip's viewBox carries
 * it up to the lifted size rather than the numbers being multiplied through.
 * The lift is the same on both axes, so nothing is stretched.
 */
const GLOW = {
  /** A unit circle at the origin, put where it belongs by the transform. */
  cx: 0,
  cy: 0,
  r: 10,
  transform: 'matrix(0.033325, 2.1166, -2.54, 0.03999, 19.667, 12.167)',
  from: 0.81158,
  opacity: 0.6,
  /** The space the transform above is written in. */
  boxW: 40,
  boxH: 33.333,
}

interface Choice {
  direction: Direction
  label: string
  Icon: typeof ArrowRightUpIcon
}

/* Credit above debit, so debit — the entry made most — is nearest the thumb. */
const CHOICES: Choice[] = [
  { direction: 'credit', label: 'Credit', Icon: ArrowLeftDownIcon },
  { direction: 'debit', label: 'Debit', Icon: ArrowRightUpIcon },
]

/**
 * The chooser: a scrim over the screen and the two choices stacked above the
 * button, right-aligned to the same gutter it sits on.
 *
 * Mounted under the nav, so the bar stays lit and reachable while the scrim
 * takes the content back. Tapping anywhere off a choice shuts it.
 */
export function QuickAdd({
  inset = 0,
  open,
  onDismiss,
  onChoose,
}: {
  inset?: number
  open: boolean
  onDismiss: () => void
  onChoose: (direction: Direction) => void
}) {
  const t = useSharedValue(0)

  useEffect(() => {
    t.set(withTiming(open ? 1 : 0, { duration: MENU, easing: EASE_ENTER }))
  }, [open, t])

  const scrim = useAnimatedStyle(() => ({ opacity: t.get() }))

  return (
    <View style={[StyleSheet.absoluteFill, s.root]} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, s.scrim, scrim]} pointerEvents="none" />

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />

      <View
        style={[s.stack, { bottom: NAV_BOTTOM + inset + NAV_HEIGHT + STACK_GAP }]}
        pointerEvents="box-none"
      >
        {CHOICES.map((choice, i) => (
          <Option
            key={choice.direction}
            choice={choice}
            /* 0 is the one nearest the button, which is the one that leads. */
            order={CHOICES.length - 1 - i}
            t={t}
            onPress={() => onChoose(choice.direction)}
          />
        ))}
      </View>
    </View>
  )
}

/**
 * One choice.
 *
 * It rises out from under the button rather than fading in place — the far one
 * further than the near one, so the pair reads as coming from the thing that
 * was tapped. Scaled up slightly as it goes, which is the same arrival the nav
 * glyphs use.
 */
function Option({
  choice,
  order,
  t,
  onPress,
}: {
  choice: Choice
  order: number
  t: SharedValue<number>
  onPress: () => void
}) {
  const from = (order + 1) * (PILL_H + STACK_GAP)

  const style = useAnimatedStyle(() => {
    const at = interpolate(
      t.get(),
      [order * MENU_STAGGER, order * MENU_STAGGER + (1 - MENU_STAGGER)],
      [0, 1],
      'clamp',
    )
    return {
      opacity: at,
      transform: [
        { translateY: interpolate(at, [0, 1], [from, 0]) },
        { scale: interpolate(at, [0, 1], [0.86, 1]) },
      ],
    }
  })

  return (
    <Animated.View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${choice.label.toLowerCase()} entry`}
        onPress={onPress}
        style={s.pill}
      >
        <Chip choice={choice} />
        <Text style={s.label} numberOfLines={1}>
          {choice.label}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

/** The tinted chip the arrow sits in: flat wash, lit around its edge. */
function Chip({ choice }: { choice: Choice }) {
  const tint = TINT[choice.direction]
  const id = `chipEdge${choice.direction}`

  return (
    <View style={[s.chip, { backgroundColor: tint.base }]}>
      <Svg
        width={CHIP_W}
        height={CHIP_H}
        viewBox={`0 0 ${GLOW.boxW} ${GLOW.boxH}`}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient
            id={id}
            gradientUnits="userSpaceOnUse"
            cx={GLOW.cx}
            cy={GLOW.cy}
            r={GLOW.r}
            gradientTransform={GLOW.transform}
          >
            <Stop offset={GLOW.from} stopColor={tint.edge} stopOpacity={0} />
            <Stop offset={1} stopColor={tint.edge} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={GLOW.boxW}
          height={GLOW.boxH}
          fill={`url(#${id})`}
          opacity={GLOW.opacity}
        />
      </Svg>

      <choice.Icon size={GLYPH} color={tint.glyph} />
    </View>
  )
}

const s = StyleSheet.create({
  /*
   * Between the app's own bottom scrim, which stands at 15 and would otherwise
   * paint straight over the lower choice, and the nav at 20, which stays lit.
   */
  root: { zIndex: 18 },
  scrim: { backgroundColor: 'rgba(4,4,4,0.72)' },
  stack: {
    position: 'absolute',
    right: metric.gutter,
    alignItems: 'flex-end',
    gap: STACK_GAP,
  },
  pill: {
    width: PILL_W,
    height: PILL_H,
    borderRadius: PILL_R,
    backgroundColor: PILL_BG,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: PILL_PAD_L,
    gap: PILL_GAP,
    overflow: 'hidden',
  },
  chip: {
    width: CHIP_W,
    height: CHIP_H,
    borderRadius: CHIP_R,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontFamily: font.r500,
    fontSize: LABEL,
    ...capTrim(LABEL),
    color: color.textBright,
  },
})
