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
import { EASE_ENTER, EASE_MOVE, MENU, MOVE, PRESS } from '../motion'
import {
  RIM_DEG,
  RIM_STOPS,
  RIM_WIDTH,
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
  { id: 'home', label: 'Home', nameW: 33.909, Icon: HomeIcon, art: require('../../assets/nav/home-3d.png') },
  { id: 'insights', label: 'Insights', nameW: 44.307, Icon: ReportIcon, art: require('../../assets/nav/report-3d.png') },
  { id: 'settings', label: 'Settings', nameW: 46.624, Icon: SettingsIcon, art: require('../../assets/nav/settings-3d.png') },
]

/*
 * The bar, transcribed from Frame 2147239311 — node 11:19 — with two things
 * changed from what the frame draws, and a note on how they scale.
 *
 * The first is size. The frame's 40 is under the 44 both platforms ask of a
 * touch target, and on a 393 phone, where it renders at exactly the height it
 * was drawn, it still read small. So the bar is lifted to 52 and everything in
 * it goes up by the same 1.3 — except the type, which moves 12 to 13 and 15 to
 * 16 rather than to 15.6 and 19.5, because the full lift would have eaten the
 * width the names need.
 *
 * The second is that all of it goes through sp(), including the heights and
 * the type. That is a reversal: for a while they did not, on the reasoning
 * that a height is bound by nothing. True in itself, and wrong in company —
 * everything else on the screen is quoted at 393 and scaled, so a bar held at
 * its full size on a 360 phone is 9% larger against its own surroundings than
 * the same bar on a 393 one. At 40 that read as slightly generous. At 52 it
 * read as cluttered, and it was the only thing on the screen not shrinking.
 *
 * So the fit is solved once, in frame units, at the frame's own 393 — and then
 * the whole bar is scaled by how much narrower the screen actually is. A 393
 * phone gets these numbers exactly; a 360 phone gets the same bar at 91.6%,
 * which is the proportion everything around it is already drawn at.
 *
 * Note what this replaces: three identical 58-wide boxes, 56 tall, each
 * reserving room for a name it only showed when selected. The frame shows all
 * three names at all times, which is what lets each box be its own width.
 */

/* Frame units, all of them, down as far as PAD_H. */
const FRAME_H = 52
/** How much bigger than the frame the bar is drawn, before the screen scale. */
const LIFT = FRAME_H / 40
/** "Add" at 16pt medium, measured out of the font we ship. */
const FRAME_ADD_NAME = 28.641
/** Add's contents: the plus, the gap, and the name. */
const FRAME_ADD_CONTENT = 12 * LIFT + 4 * LIFT + FRAME_ADD_NAME

/*
 * Everything across the bar that is not padding, and so cannot give: the three
 * names, the button's contents, both gutters, and the gap the frame leaves
 * between the two groups. What is left is shared by four boxes with two sides
 * each — 20 where there is room for 20, and about 19 at the frame's width.
 */
const IMMOVABLE =
  TABS.reduce((w, t) => w + t.nameW, 0) + FRAME_ADD_CONTENT + 24 * 2 + 18.84
const PAD_H = Math.min(20, (metric.appW - IMMOVABLE) / 8)

/* And from here on, what actually gets drawn. */
const ITEM_H = sp(FRAME_H)
const STACK_GAP = sp(6 * LIFT)
const LABEL = sp(13)
const ADD_LABEL = sp(16)
const PLUS = sp(12 * LIFT)
const ADD_GAP = sp(4 * LIFT)
const ADD_NAME_W = sp(FRAME_ADD_NAME)

const WIDTHS = TABS.map((t) => sp(PAD_H * 2 + t.nameW))
const OFFSETS = WIDTHS.map((_, i) => WIDTHS.slice(0, i).reduce((a, b) => a + b, 0))
const GROUP_W = WIDTHS.reduce((a, b) => a + b, 0)
const ADD_W = sp(PAD_H * 2 + FRAME_ADD_CONTENT)

/*
 * Where the button's contents sit.
 *
 * Both are placed rather than laid out in a row, and this is the second go at
 * it. The first collapsed the name's box to nothing to close the button down
 * to a circle — which works, until a platform decides the box it has been
 * given is the width to measure the string against. Android did, found "Add"
 * would not fit, and ellipsised it to "A…".
 *
 * So nothing here is ever measured against a box that moves. The name has a
 * fixed place and a box with room to spare, and it leaves by fading; the plus
 * has a fixed place and slides the point or so between where it sits in the
 * row and the middle of the circle. The button's own width is the only thing
 * animating, and it clips.
 */
const ROW_LEFT = sp(PAD_H)
const PLUS_SHIFT = ITEM_H / 2 - (ROW_LEFT + PLUS / 2)
const NAME_LEFT = ROW_LEFT + PLUS + ADD_GAP
/** Room to spare, so no platform's own measurement of "Add" can come up short. */
const NAME_ROOM = ADD_NAME_W + sp(8)

/** What the pill interpolates over: one entry per destination. */
const TRACK = TABS.map((_, i) => i)
const PILL_MAX = Math.max(...WIDTHS)

/** The frame says 48, which on a box 40 deep is as round as it goes. */
const PILL_R = ITEM_H / 2

/** The whole bar, so the scroll view knows how much room to leave under it. */
export const NAV_HEIGHT = ITEM_H

/** How far the bar floats above the safe area — the chooser stacks off this. */
export const NAV_BOTTOM = sp(24)

/**
 * Two floating groups: destinations pinned left, the primary action right.
 *
 * One pill, and it travels. The alternative — each destination carrying its
 * own pill, opening and shutting — cannot be made coherent however well it is
 * eased, because two shapes change at once and neither is the thing that moved.
 */
export function BottomNav({ inset = 0 }: { inset?: number }) {
  const { tab, quickAddOpen } = useAppState()
  const dispatch = useDispatch()

  const index = Math.max(0, TABS.findIndex((t) => t.id === tab))
  const slide = useSharedValue(index)

  useEffect(() => {
    slide.set(withTiming(index, { duration: MOVE, easing: EASE_MOVE }))
  }, [index, slide])

  /*
   * The button and the chooser run off the same value, so the pills leaving
   * and the button growing its name back are one movement rather than two
   * that happen to have the same duration.
   */
  const menu = useSharedValue(0)

  useEffect(() => {
    menu.set(withTiming(quickAddOpen ? 1 : 0, { duration: MENU, easing: EASE_ENTER }))
  }, [quickAddOpen, menu])

  /* Open, it is a circle: the name collapses and the button closes down on it. */
  const addBox = useAnimatedStyle(() => ({
    width: interpolate(menu.get(), [0, 1], [ADD_W, ITEM_H]),
  }))
  const addAccent = useAnimatedStyle(() => ({ opacity: 1 - menu.get() }))
  const addNeutral = useAnimatedStyle(() => ({ opacity: menu.get() }))
  /* A plus turned through 45 is a cross. Same glyph, so it cannot jump. */
  const addGlyph = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(menu.get(), [0, 1], [0, PLUS_SHIFT]) },
      { rotate: `${interpolate(menu.get(), [0, 1], [0, 45])}deg` },
    ],
  }))
  const addName = useAnimatedStyle(() => ({
    opacity: interpolate(menu.get(), [0, 0.45], [1, 0], 'clamp'),
  }))

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

      {/*
        * Add: 84 x 40, the accent ramp, a 25% white edge, its name at 15 — and
        * on a tap it becomes the close for the chooser it opens. The accent
        * goes out as the glass comes up, rather than the button being swapped
        * for a different one, so there is nothing to appear or disappear.
        */}
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={quickAddOpen ? 'Close' : 'Add entry'}
        onPress={() => dispatch({ type: 'toggleQuickAdd' })}
        style={[s.add, addBox]}
      >
        {/*
          * Cut to the whole button and hung a unit outside it, so it covers
          * the border box however the border is being measured.
          *
          * absoluteFill puts a child against the padding box, inside the
          * border — but whether the clip is taken there or at the border box
          * is not something to rely on, and a ramp cut to fit the first showed
          * a hairline of the ground beneath it along the bottom edge. With a
          * unit of overhang there is nothing left to show through, and what
          * falls outside is clipped either way.
          */}
        <Animated.View style={[StyleSheet.absoluteFill, addAccent]} pointerEvents="none">
          <AccentFill width={ADD_W} height={ITEM_H} overhang={RIM_WIDTH} />
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, addNeutral]} pointerEvents="none">
          <LinearGradient
            colors={fill.raised.colors}
            start={neutralAxis.start}
            end={neutralAxis.end}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={[s.addGlyph, addGlyph]} pointerEvents="none">
          <PlusIcon size={PLUS} color={color.text} />
        </Animated.View>

        <Animated.View style={[s.addName, addName]} pointerEvents="none">
          <Text style={s.addLabel} numberOfLines={1} ellipsizeMode="clip">
            Add
          </Text>
        </Animated.View>
      </AnimatedPressable>
    </View>
  )
}

const AnimatedRect = Animated.createAnimatedComponent(Rect)
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/* The close state's surface, on the button's own proportions. */
const neutralAxis = axisFor(fill.raised.deg, ADD_W, ITEM_H)

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
  },
  addGlyph: {
    position: 'absolute',
    left: ROW_LEFT,
    top: 0,
    bottom: 0,
    width: PLUS,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  addName: {
    position: 'absolute',
    left: NAME_LEFT,
    top: 0,
    bottom: 0,
    width: NAME_ROOM,
    justifyContent: 'center',
    zIndex: 1,
  },
  addLabel: { ...type.nav, fontSize: ADD_LABEL, ...capTrim(ADD_LABEL), color: color.textBright },
})
