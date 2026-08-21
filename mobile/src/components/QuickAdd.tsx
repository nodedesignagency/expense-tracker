import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import type { Direction } from '../lib/types'
import { EASE_ENTER, MENU, MENU_STAGGER } from '../motion'
import { capTrim, color, fill, font, metric, radius, rim } from '../theme'
import { NAV_BOTTOM, NAV_HEIGHT } from './BottomNav'
import { Glass } from './Glass'
import { ArrowDownLeftIcon, ArrowUpRightIcon } from './Icons'

/*
 * The Add button asks which side first.
 *
 * An entry is a credit or a debit before it is anything else, and the composer
 * was opening on debit every time and making the user correct it. So the
 * button no longer opens the sheet — it opens two choices, and the sheet comes
 * up already set to the one that was picked.
 *
 * Sizes are the frame's, unscaled, for the reason set out in BottomNav: a
 * height is not bound by the width of the screen. The pill is the nav's own
 * 40 so the two read as one family, and each hugs its name the same way a
 * destination does.
 */
const PILL_H = 40
const ORB = 32
/** The orb sits almost against the edge — it is the thing you aim at. */
const ORB_INSET = 4
const ORB_GAP = 10
const PAD_R = 20
const LABEL = 15
const STACK_GAP = 12

interface Choice {
  direction: Direction
  label: string
  /** The name's advance at 15pt medium, read out of the font we ship. */
  nameW: number
  Icon: typeof ArrowUpRightIcon
}

/*
 * Debit above credit, which is the order the composer's own toggle uses. Money
 * out is the entry people make most, and it is the one nearest the thumb.
 */
const CHOICES: Choice[] = [
  { direction: 'debit', label: 'Debit', nameW: 34.819, Icon: ArrowUpRightIcon },
  { direction: 'credit', label: 'Credit', nameW: 39.866, Icon: ArrowDownLeftIcon },
]

/*
 * Each orb is a lit sphere, not a flat disc: a light core up and to the left,
 * the ledger colour through the middle, and the same hue in shadow at the rim.
 * A single flat fill next to the nav's 3D renders reads as a placeholder.
 */
const ORB_STOPS: Record<Direction, [string, string, string]> = {
  debit: ['#FFD2D2', '#FF6E6E', '#D14B4B'],
  credit: ['#B4F8CC', '#2BE86A', '#12A84A'],
}

function width(choice: Choice) {
  return ORB_INSET + ORB + ORB_GAP + choice.nameW + PAD_R
}

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
  const w = width(choice)
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
      >
        <Glass
          rim={rim.button}
          fill={fill.raised}
          radius={radius.pill}
          w={w}
          h={PILL_H}
          style={{ width: w, height: PILL_H }}
          innerStyle={s.row}
          stretch
        >
          <View style={s.orb}>
            <Orb direction={choice.direction} />
            <View style={s.orbGlyph} pointerEvents="none">
              <choice.Icon size={18} color={color.text} />
            </View>
          </View>
          <Text style={s.label} numberOfLines={1}>
            {choice.label}
          </Text>
        </Glass>
      </Pressable>
    </Animated.View>
  )
}

function Orb({ direction }: { direction: Direction }) {
  const [light, mid, deep] = ORB_STOPS[direction]
  const id = `orb-${direction}`

  return (
    <Svg width={ORB} height={ORB} viewBox={`0 0 ${ORB} ${ORB}`}>
      <Defs>
        <RadialGradient
          id={id}
          cx={ORB * 0.38}
          cy={ORB * 0.32}
          r={ORB * 0.92}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={light} />
          <Stop offset="0.3" stopColor={mid} />
          <Stop offset="0.78" stopColor={mid} />
          <Stop offset="1" stopColor={deep} />
        </RadialGradient>
      </Defs>
      <Circle cx={ORB / 2} cy={ORB / 2} r={ORB / 2} fill={`url(#${id})`} />
    </Svg>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: ORB_INSET,
    gap: ORB_GAP,
  },
  orb: { width: ORB, height: ORB, alignItems: 'center', justifyContent: 'center' },
  orbGlyph: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: font.r500,
    fontSize: LABEL,
    ...capTrim(LABEL),
    color: color.textBright,
  },
})
