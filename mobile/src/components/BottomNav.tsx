import { useEffect, type ComponentType } from 'react'
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg'
import { useAppState, useDispatch, type Tab } from '../store'
import { EASE_ENTER, EASE_MOVE, MOVE, PRESS } from '../motion'
import {
  RIM_DEG,
  RIM_STOPS,
  RIM_WIDTH,
  SCALE,
  axisFor,
  capTrim,
  color,
  fill,
  metric,
  radius,
  rim,
  sp,
  type,
} from '../theme'
import { AccentFill } from './Accent'
import { splitAlpha } from './Glass'
import { PlusIcon } from './Icons'
import { NavGlyph } from './NavGlyph'
import { HomeIcon, ReportIcon, SettingsIcon } from './NavIcons'

interface TabDef {
  id: Tab
  label: string
  /**
   * How wide the name actually is at 12pt medium, read out of the font file we
   * ship. The destination hugs it, so this is the figure that sets the box.
   */
  nameW: number
  /** Outline when idle, the 3D render when selected. */
  Icon: ComponentType<{ size?: number; color?: string }>
  art: ImageSourcePropType
}

const TABS: TabDef[] = [
  { id: 'home', label: 'Home', nameW: 31.301, Icon: HomeIcon, art: require('../../assets/nav/home-3d.png') },
  { id: 'insights', label: 'Insights', nameW: 40.898, Icon: ReportIcon, art: require('../../assets/nav/report-3d.png') },
  { id: 'settings', label: 'Settings', nameW: 43.037, Icon: SettingsIcon, art: require('../../assets/nav/settings-3d.png') },
]

/*
 * The bar, transcribed from Frame 2147239311 — node 11:19 — and a note on
 * which of its numbers scale, because they do not all get to.
 *
 * A width has no choice. The gutters are the frame's 24 and the screen is 360,
 * so a 345 card is drawn at 316 and everything laid out across it follows.
 * That is what sp() is for.
 *
 * A height is bound by nothing. Neither is a type size, nor the space between
 * a glyph and the name under it. Put through sp() with everything else they
 * came out at 91.6% — a 40 pill drawn 36.6, 12pt type set at 11, a 16 glyph at
 * 14.7 — and the bar read small and cramped against a design that is neither.
 * So every vertical measurement here, and every type size, is the frame's own
 * number, unscaled.
 *
 * The horizontal padding is the one figure that cannot be. At the frame's 20 a
 * side the three destinations come to 237; 237 plus an 84 button plus two 24
 * gutters is 369 on a screen that has 360, so it does not fit with any gap at
 * all, let alone the frame's. So the padding takes whatever is left once
 * everything that cannot move has been paid for — 20 where there is room for
 * 20, and 17.59 on this phone.
 *
 * Note what this replaces: three identical 58-wide boxes, 56 tall, each
 * reserving room for a name it only showed when selected. The frame shows all
 * three names at all times, which is what lets each box be its own width.
 */
const ITEM_H = 40
const STACK_GAP = 6
const LABEL = 12
const ADD_LABEL = 15
const PLUS = 12
const ADD_GAP = 4

/** The gap the frame leaves between the destinations and the button. */
const GROUP_GAP = sp(18.84)

/** Add's contents: the plus, the gap, and "Add" at 15pt medium. */
const ADD_CONTENT = PLUS + ADD_GAP + 26.851

/*
 * Everything across the bar that is not padding, and so cannot give: the three
 * names, the button's contents, both gutters, and the gap between the groups.
 * What is left is shared by four boxes with two sides each.
 */
const IMMOVABLE =
  TABS.reduce((w, t) => w + t.nameW, 0) + ADD_CONTENT + metric.gutter * 2 + GROUP_GAP
const PAD_H = Math.min(20, (metric.appW * SCALE - IMMOVABLE) / 8)

const WIDTHS = TABS.map((t) => PAD_H * 2 + t.nameW)
const OFFSETS = WIDTHS.map((_, i) => WIDTHS.slice(0, i).reduce((a, b) => a + b, 0))
const GROUP_W = WIDTHS.reduce((a, b) => a + b, 0)
const ADD_W = PAD_H * 2 + ADD_CONTENT

/** What the pill interpolates over: one entry per destination. */
const TRACK = TABS.map((_, i) => i)
const PILL_MAX = Math.max(...WIDTHS)

/** The frame says 48, which on a box 40 deep is as round as it goes. */
const PILL_R = ITEM_H / 2

/** The whole bar, so the scroll view knows how much room to leave under it. */
export const NAV_HEIGHT = ITEM_H

/**
 * Two floating groups: destinations pinned left, the primary action right.
 *
 * One pill, and it travels. The alternative — each destination carrying its
 * own pill, opening and shutting — cannot be made coherent however well it is
 * eased, because two shapes change at once and neither is the thing that moved.
 */
export function BottomNav({ inset = 0 }: { inset?: number }) {
  const { tab } = useAppState()
  const dispatch = useDispatch()

  const index = Math.max(0, TABS.findIndex((t) => t.id === tab))
  const slide = useSharedValue(index)

  useEffect(() => {
    slide.set(withTiming(index, { duration: MOVE, easing: EASE_MOVE }))
  }, [index, slide])

  return (
    <View style={[s.nav, { bottom: sp(24) + inset }]} pointerEvents="box-none">
      <View style={s.group}>
        <NavPill slide={slide} />

        {TABS.map((def, i) => (
          <NavItem
            key={def.id}
            def={def}
            index={i}
            slide={slide}
            onPress={() => dispatch({ type: 'setTab', tab: def.id })}
          />
        ))}
      </View>

      {/* Add: 84 x 40, the accent ramp, a 25% white edge, its name at 15. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add entry"
        onPress={() => dispatch({ type: 'openComposer' })}
        style={s.add}
      >
        <AccentFill width={ADD_W} height={ITEM_H} />
        <View style={s.addContent}>
          <PlusIcon size={PLUS} color={color.text} />
          <Text style={s.addLabel}>Add</Text>
        </View>
      </Pressable>
    </View>
  )
}

const AnimatedRect = Animated.createAnimatedComponent(Rect)

/**
 * The travelling pill.
 *
 * The destinations are not all one width, so the pill has to resize as well as
 * move — and both have to run on the UI thread, because a tab change is the
 * one moment JS is certain to be busy mounting the next screen.
 *
 * Which is why this does not use Glass. Glass measures itself with onLayout,
 * which is right for a panel laid out once and wrong for a shape whose width
 * changes every frame: it would post a layout event and re-render its SVG
 * sixty times a second, on exactly that thread. The construction here is still
 * Glass's — a gradient surface with a gradient-stroked rounded rect over it —
 * but the size comes from the shared value instead of from measuring.
 *
 * The canvas is cut to the widest destination and never changes size; only the
 * rect inside it does. Scaling the canvas would take the stroke and the corner
 * radius with it, and the rim would thin and stretch as the pill moved.
 */
function NavPill({ slide }: { slide: SharedValue<number> }) {
  const surface = fill.navRaised

  /*
   * Both ramps are laid out for the middle width. An angle is a direction in
   * real space divided through by the box, so it does shift a little between a
   * 72-wide pill and an 84-wide one — around four percent of the box height,
   * on a ramp from 25% white to 12%. Animating the endpoints to chase that
   * would add two more animated props for something the screen cannot show.
   */
  const nominal = WIDTHS[1]
  const fillAxis = axisFor(surface.deg, nominal, ITEM_H)
  const rimAxis = axisFor(RIM_DEG, nominal, ITEM_H)

  /* Half a unit in from each edge, so the stroke sits wholly inside the shape. */
  const half = RIM_WIDTH / 2

  const box = useAnimatedStyle(() => ({
    width: interpolate(slide.get(), TRACK, WIDTHS),
    transform: [{ translateX: interpolate(slide.get(), TRACK, OFFSETS) }],
  }))

  const edge = useAnimatedProps(() => ({
    width: Math.max(interpolate(slide.get(), TRACK, WIDTHS) - RIM_WIDTH, 0),
  }))

  return (
    <Animated.View style={[s.pill, box]} pointerEvents="none">
      <LinearGradient
        colors={surface.colors}
        start={fillAxis.start}
        end={fillAxis.end}
        style={StyleSheet.absoluteFill}
      />

      <Svg width={PILL_MAX} height={ITEM_H} style={s.pillRim} pointerEvents="none">
        <Defs>
          <SvgGradient
            id="navPillRim"
            gradientUnits="userSpaceOnUse"
            x1={rimAxis.start.x * nominal}
            y1={rimAxis.start.y * ITEM_H}
            x2={rimAxis.end.x * nominal}
            y2={rimAxis.end.y * ITEM_H}
          >
            {rim.raised.map((css, i) => {
              const stop = splitAlpha(css)
              return (
                <Stop
                  key={i}
                  offset={RIM_STOPS[i] ?? i / (rim.raised.length - 1)}
                  stopColor={stop.color}
                  stopOpacity={stop.opacity}
                />
              )
            })}
          </SvgGradient>
        </Defs>

        <AnimatedRect
          x={half}
          y={half}
          height={ITEM_H - RIM_WIDTH}
          rx={PILL_R - half}
          ry={PILL_R - half}
          fill="none"
          stroke="url(#navPillRim)"
          strokeWidth={RIM_WIDTH}
          animatedProps={edge}
        />
      </Svg>
    </Animated.View>
  )
}

interface NavItemProps {
  def: TabDef
  index: number
  slide: SharedValue<number>
  onPress: () => void
}

/**
 * One destination: glyph above its name.
 *
 * The glyph is not animated on its own clock — it reads how near the pill is.
 * A tab a whole step away is idle, one the pill sits on is lit, and everything
 * between follows the shape as it passes. That coupling is what makes the swap
 * and the slide read as a single movement rather than two things that happen
 * to start together.
 *
 * The name is simply always there. The frame lights all three at once and only
 * the glyph changes on selection, so there is nothing here to animate.
 */
function NavItem({ def, index, slide, onPress }: NavItemProps) {
  const press = useSharedValue(0)

  const swap = useDerivedValue(() => {
    'worklet'
    return 1 - Math.min(Math.abs(slide.get() - index), 1)
  })

  const feedback = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.get(), [0, 1], [1, 0.94], 'clamp') }],
  }))

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: index === Math.round(slide.get()) }}
      accessibilityLabel={def.label}
      onPress={onPress}
      onPressIn={() => press.set(withTiming(1, { duration: PRESS, easing: EASE_ENTER }))}
      onPressOut={() => press.set(withTiming(0, { duration: PRESS, easing: EASE_ENTER }))}
      hitSlop={8}
    >
      <Animated.View style={[s.item, { width: WIDTHS[index] }, feedback]}>
        <NavGlyph swap={swap} Icon={def.Icon} art={def.art} />
        <Text style={s.itemLabel} numberOfLines={1}>
          {def.label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  /*
   * Two groups floating 24 from the bottom. No container behind either.
   *
   * The frame draws the bar 339.84 wide and pushes its two groups apart. On a
   * 393 screen the gutters leave 345, so the 5 the frame does not account for
   * falls into the gap between them — which puts both groups on the same edges
   * as every card above, rather than leaving the bar floating 3 inside them.
   */
  nav: {
    position: 'absolute',
    left: metric.gutter,
    right: metric.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  group: {
    width: GROUP_W,
    height: ITEM_H,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: ITEM_H,
    borderRadius: PILL_R,
    overflow: 'hidden',
  },
  pillRim: { position: 'absolute', left: 0, top: 0 },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: STACK_GAP,
  },
  itemLabel: {
    ...type.nav,
    fontSize: LABEL,
    ...capTrim(LABEL),
    color: color.textBright,
    textAlign: 'center',
  },
  add: {
    width: ADD_W,
    height: ITEM_H,
    borderRadius: radius.pill,
    borderWidth: RIM_WIDTH,
    borderColor: color.strokeAccent,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ADD_GAP,
    zIndex: 1,
  },
  addLabel: { ...type.nav, fontSize: ADD_LABEL, ...capTrim(ADD_LABEL), color: color.textBright },
})
