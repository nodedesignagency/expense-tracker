import { useEffect, useState, type ReactNode } from 'react'
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { EASE_ENTER, SHEET } from '../motion'
import {
  RIM_STOPS,
  RIM_WIDTH,
  axisFor,
  color,
  radius,
  rim,
  sp,
  type,
  RIM_DEG,
} from '../theme'
import { splitAlpha } from './Glass'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  footer?: ReactNode
  children?: ReactNode
  /**
   * Drawn over the panel and outside its scroller, for anything that has to
   * cover the sheet rather than sit in it — the calendar, which inside the
   * scroller would be clipped by it and would push the form around.
   */
  overlay?: ReactNode
}

/** How far the panel floats off the three edges it sits against. */
const FLOAT = sp(6)

/*
 * How tall it may get, in points rather than as a share of the parent. As a
 * percentage it resolved against the box the keyboard avoider makes, which is
 * neither the screen nor the panel's own content — the panel came out capped
 * short and then sat at the top of what was left, a hundred points clear of
 * the bottom it was meant to be against. Read once at module load, the way the
 * scale is: the app is locked to portrait.
 */
const MAX_H = Dimensions.get('window').height * 0.86

/** What the panel spans once the float has been taken off both sides. */
const PANEL_W = Dimensions.get('window').width - FLOAT * 2

/**
 * A sheet that comes up from the bottom, and floats: it clears the two sides
 * and the bottom of the screen rather than sitting flush into the corner, so
 * all four of its corners round and the ground shows around it.
 *
 * The Modal's own `animationType="slide"` is not used. It moves the whole
 * modal, scrim included, so the dimming arrives travelling upward with the
 * panel instead of coming up in place — which is what made this read as a
 * screen being pushed on rather than a sheet being raised. Here the scrim
 * fades where it is and the panel is the only thing that moves.
 *
 * That means holding the Modal mounted past the close, or the exit is never
 * seen: `visible` follows a flag that is only dropped once the panel has
 * finished travelling back down.
 */
export function Sheet({ open, title, onClose, footer, children, overlay }: SheetProps) {
  const insets = useSafeAreaInsets()
  const [mounted, setMounted] = useState(open)
  /* The panel's own height, so it starts exactly its own height below. */
  const [height, setHeight] = useState(0)
  const t = useSharedValue(0)

  useEffect(() => {
    if (open) setMounted(true)
    t.set(
      withTiming(open ? 1 : 0, { duration: SHEET, easing: EASE_ENTER }, (done) => {
        'worklet'
        if (done && !open) runOnJS(setMounted)(false)
      }),
    )
  }, [open, t])

  const scrim = useAnimatedStyle(() => ({ opacity: t.get() }))

  const panel = useAnimatedStyle(() => ({
    /* Until it has been measured, a screenful is far enough to be off-stage. */
    transform: [{ translateY: interpolate(t.get(), [0, 1], [height || 900, 0]) }],
  }))

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height
    setHeight((prev) => (Math.abs(prev - next) < 1 ? prev : next))
  }

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.root}>
        <Animated.View style={[s.scrim, scrim]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.avoider}
        >
          <Animated.View
            style={[s.panel, { marginBottom: insets.bottom + FLOAT }, panel]}
            onLayout={onLayout}
          >
            {/*
              * The ledger goes soft behind the panel rather than being hidden
              * by it. Android's blur is Expo's experimental one and has to be
              * asked for by name; it also will not take a border radius of its
              * own, which is why the panel clips.
              *
              * A wash goes over the top: blur alone leaves whatever was behind
              * showing through at its own brightness, and the balance figure
              * is bright enough to read through the sheet sitting on it.
              */}
            <BlurView
              intensity={62}
              tint="dark"
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
            <View style={s.wash} pointerEvents="none" />
            {height > 0 ? <LiquidRim height={height} /> : null}

            <View style={s.grabber} />

            <View style={s.head}>
              <Text style={s.title}>{title}</Text>
              <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
                <Text style={s.close}>Close</Text>
              </Pressable>
            </View>

            <ScrollView
              style={s.body}
              contentContainerStyle={s.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {footer ? <View style={s.footer}>{footer}</View> : null}

            {overlay}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

/**
 * The edge, carrying colour.
 *
 * Same construction as every other rim in the app — one gradient traced round
 * a stroked rounded rect, so the light is continuous and the corners are one
 * curve rather than two shapes meeting. The only difference is that the ramp
 * has hue in it, which is what makes an edge read as a pane catching light
 * rather than as a line drawn round a box.
 *
 * Alpha goes in stop-opacity, never inside stop-color: Android reads the three
 * channels there and drops the fourth, and the whole rim paints solid.
 */
function LiquidRim({ height }: { height: number }) {
  const half = RIM_WIDTH / 2
  const axis = axisFor(RIM_DEG, PANEL_W, height)

  return (
    <Svg
      width={PANEL_W}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <SvgGradient
          id="sheetRim"
          gradientUnits="userSpaceOnUse"
          x1={axis.start.x * PANEL_W}
          y1={axis.start.y * height}
          x2={axis.end.x * PANEL_W}
          y2={axis.end.y * height}
        >
          {rim.liquid.map((css, i) => {
            const stop = splitAlpha(css)
            return (
              <Stop
                key={i}
                offset={RIM_STOPS[i] ?? i / (rim.liquid.length - 1)}
                stopColor={stop.color}
                stopOpacity={stop.opacity}
              />
            )
          })}
        </SvgGradient>
      </Defs>
      <Rect
        x={half}
        y={half}
        width={PANEL_W - RIM_WIDTH}
        height={Math.max(height - RIM_WIDTH, 0)}
        rx={radius.sheet - half}
        ry={radius.sheet - half}
        fill="none"
        stroke="url(#sheetRim)"
        strokeWidth={RIM_WIDTH}
      />
    </Svg>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  /* Hugs the panel: no flex, so it cannot stretch and strand it at the top. */
  avoider: { justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  panel: {
    /* Transparent: the blur and the wash under everything are the surface. */
    backgroundColor: 'transparent',
    /* Floating, so every corner rounds and the border goes all the way round. */
    marginHorizontal: FLOAT,
    borderRadius: radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    maxHeight: MAX_H,
    overflow: 'hidden',
  },
  /*
   * Warm rather than neutral. A flat black wash over a blur reads as a screen
   * gone dim; a touch of warmth in it reads as a pane with something behind.
   */
  wash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(30,26,26,0.62)' },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  title: { ...type.title, fontSize: 20, color: color.text },
  close: { ...type.chip, color: color.textSoft },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: 12 },
  footer: { paddingTop: 12 },
})
