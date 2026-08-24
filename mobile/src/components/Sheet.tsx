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
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { EASE_SHEET, SHEET, SHEET_FLOAT, pageSheetTop } from '../motion'
import { color, radius, sp, type } from '../theme'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  footer?: ReactNode
  /** Replaces the title row, for a sheet whose header is its own control. */
  header?: ReactNode
  /** Nearly the whole screen, for a sheet that is really a page. */
  tall?: boolean
  children?: ReactNode
  /**
   * Drawn over the panel and outside its scroller, for anything that has to
   * cover the sheet rather than sit in it — the calendar, which inside the
   * scroller would be clipped by it and would push the form around.
   */
  overlay?: ReactNode
  /**
   * Drawn over everything, at the full size of the screen rather than the
   * panel's — the commit bloom, which has to leave the sheet entirely.
   */
  curtain?: ReactNode
  /**
   * Keeps the Modal mounted even once `open` has gone false.
   *
   * A Modal is its own native window and everything in it, the curtain
   * included, dies with it. The commit bloom outlives the sheet on purpose —
   * the panel leaves *behind* the light — so something has to keep the window
   * up until the light has finished. This does.
   */
  hold?: boolean
}

/** How far the panel floats off the three edges it sits against. */
const FLOAT = sp(SHEET_FLOAT)

/*
 * How tall it may get, in points rather than as a share of the parent. As a
 * percentage it resolved against the box the keyboard avoider makes, which is
 * neither the screen nor the panel's own content — the panel came out capped
 * short and then sat at the top of what was left, a hundred points clear of
 * the bottom it was meant to be against. Read once at module load, the way the
 * scale is: the app is locked to portrait.
 */
const MAX_H = Dimensions.get('window').height * 0.86

/*
 * A page rather than a panel takes a height, not a cap on one.
 *
 * It had a maxHeight, which only stops a panel growing — the panel still hugs
 * its content, so it ended wherever the form did and left a third of the
 * screen showing. Given the height outright it fills what it is given.
 */
const WINDOW_H = Dimensions.get('window').height

/**
 * How tall a page sheet is: everything from its shoulder down to the float it
 * leaves at the bottom.
 *
 * "Page" used to mean the whole screen bar the status bar, which covered the
 * app outright — nothing of what you came from was left, so it read as a
 * screen that had been pushed on rather than a sheet raised in front of one.
 * It now stops below the receded page's own top edge, leaving PEEK of it and
 * its rounded corners showing.
 *
 * Derived from the recede rather than given as its own figure, so the two
 * cannot drift: move the page back further and the sheet follows it down.
 */
function pageHeight(insetTop: number, insetBottom: number) {
  /*
   * From just under the receded toggle row to the float at the bottom. The
   * band the page's own padding used to leave on screen is gone — the page
   * slides up to spend it — so the sheet takes everything under the row.
   */
  return WINDOW_H - pageSheetTop(insetTop) - insetBottom - FLOAT
}

/*
 * How dark it gets behind.
 *
 * A page sheet wants far less of this than a panel does. The page behind one
 * has already gone back and dimmed itself, so the scrim is stacking on top of
 * that dimming rather than doing it — and at the panel's own strength the two
 * multiply out to near black, which loses the shoulder the sheet stops short
 * to show — 0.28 here still did, on top of the page's own dim; the pair have
 * to be tuned together. A panel has no such help and keeps the full weight.
 */
const SCRIM_PANEL = 0.6
const SCRIM_PAGE = 0.12

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
export function Sheet({
  open,
  title,
  onClose,
  footer,
  header,
  tall,
  children,
  overlay,
  curtain,
  hold,
}: SheetProps) {
  const insets = useSafeAreaInsets()
  const [mounted, setMounted] = useState(open)
  /* The panel's own height, so it starts exactly its own height below. */
  const [height, setHeight] = useState(0)
  const t = useSharedValue(0)

  useEffect(() => {
    if (open) setMounted(true)
    t.set(
      withTiming(open ? 1 : 0, { duration: SHEET, easing: EASE_SHEET }, (done) => {
        'worklet'
        /* scheduleOnRN, not runOnJS — the latter is gone in Reanimated 4. */
        if (done && !open) scheduleOnRN(setMounted, false)
      }),
    )
  }, [open, t])

  const scrim = useAnimatedStyle(() => ({
    opacity: t.get() * (tall ? SCRIM_PAGE : SCRIM_PANEL),
  }))

  /*
   * Its own height is not far enough to leave by: the panel floats clear of
   * the bottom, so travelling exactly its height leaves that float still on
   * screen as a strip of the panel, right as the modal unmounts. Add what sits
   * below it. Until it has been measured, a screenful is far enough.
   */
  const exit = (height || WINDOW_H) + insets.bottom + FLOAT

  const panel = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(t.get(), [0, 1], [exit, 0]) }],
  }))

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height
    setHeight((prev) => (Math.abs(prev - next) < 1 ? prev : next))
  }

  return (
    <Modal
      visible={mounted || Boolean(hold)}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/*
        * Its own gesture root. A Modal is a separate native window, and on
        * Android the GestureHandlerRootView wrapping the app does not reach
        * into it: every gesture inside is silently dead — the slider dragged
        * on iOS and simply did not respond on the owner's phone. iOS works
        * either way, which is exactly why it slipped through.
        */}
      <GestureHandlerRootView style={s.root}>
        <Animated.View style={[s.scrim, scrim]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.avoider}
        >
          <Animated.View
            style={[
              s.panel,
              tall
                ? {
                    marginBottom: insets.bottom + FLOAT,
                    height: pageHeight(insets.top, insets.bottom),
                  }
                : { marginBottom: insets.bottom + FLOAT, maxHeight: MAX_H },
              panel,
            ]}
            onLayout={onLayout}
          >
            <View style={s.grabber} />

            {header ?? (
              <View style={s.head}>
                <Text style={s.title}>{title}</Text>
                <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
                  <Text style={s.close}>Close</Text>
                </Pressable>
              </View>
            )}

            <ScrollView
              style={[s.body, tall ? s.bodyTall : null]}
              contentContainerStyle={[s.bodyContent, tall ? s.bodyContentTall : null]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {footer ? <View style={s.footer}>{footer}</View> : null}

            {overlay}
          </Animated.View>
        </KeyboardAvoidingView>

        {curtain}
      </GestureHandlerRootView>
    </Modal>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  /* Hugs the panel: no flex, so it cannot stretch and strand it at the top. */
  avoider: { justifyContent: 'flex-end' },
  /* The strength is animated, so the colour here is flat black. */
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  panel: {
    /*
     * Flat, and opaque. This was glass — blurred, washed warm, with a lit
     * edge — and against a screen that is one enormous number the effect was
     * competing with the number. What the reference does instead is get out
     * of the way: a single dark surface, a hairline so it parts from the black
     * behind it, and nothing else on it that is not information.
     */
    backgroundColor: '#141414',
    /* Floating, so every corner rounds and the border goes all the way round. */
    marginHorizontal: FLOAT,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    overflow: 'hidden',
  },
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
  /*
   * A page's body takes the room the page has, so the middle can breathe.
   *
   * Spelled out rather than `flex: 1`. `flex` and `flexGrow` are separate keys
   * to the style merger, so the shorthand does not replace the `flexGrow: 0`
   * above it — the body kept collapsing to nothing and the footer rode up
   * under the header, sitting over the pad.
   */
  bodyTall: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  bodyContent: { paddingBottom: 12 },
  /* And the content has to be allowed to fill, or nothing inside can stretch. */
  bodyContentTall: { flexGrow: 1 },
  footer: { paddingTop: 12 },
})
