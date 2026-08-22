import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { EASE_SHEET, RECEDE, SHEET, recedeLift } from './src/motion'
import { radius } from './src/theme'
import { BottomNav, NAV_HEIGHT } from './src/components/BottomNav'
import { QuickAdd } from './src/components/QuickAdd'
import { Composer } from './src/components/Composer'
import { DetailSheet } from './src/components/DetailSheet'
import { TopBar } from './src/components/TopBar'
import { HomeScreen } from './src/screens/HomeScreen'
import { InsightsScreen } from './src/screens/InsightsScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { StoreProvider, useAppState, useDispatch } from './src/store'
import { color } from './src/theme'

/*
 * Expo Go runs a prebuilt binary, so the expo-font config plugin — which embeds
 * fonts at build time — never applies. These load at runtime instead.
 */
const FONTS = {
  'SFRounded-400': require('./assets/fonts/sf-pro-rounded-400.ttf'),
  'SFRounded-500': require('./assets/fonts/sf-pro-rounded-500.ttf'),
  'SFRounded-600': require('./assets/fonts/sf-pro-rounded-600.ttf'),
  'SFRounded-700': require('./assets/fonts/sf-pro-rounded-700.ttf'),
  'Geist-400': require('./assets/fonts/geist-400.ttf'),
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONTS)

  /*
   * Render on the error too. Waiting only on fontsLoaded means a font the
   * platform rejects leaves the app on an empty screen for good, with nothing
   * to say why — and Android is much stricter about what it will load than a
   * browser is, so this is a real state and not a theoretical one. Better to
   * come up in the fallback face and log it.
   */
  if (fontError) {
    console.warn('Fonts failed to load; falling back to the system face.', fontError)
  }

  return (
    /*
     * Gesture handler needs this at the root or gestures do nothing at all,
     * and say nothing about it either — no warning, no error, just a control
     * that never responds.
     */
    <GestureHandlerRootView style={s.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {fontsLoaded || fontError ? (
          <StoreProvider>
            <Shell />
          </StoreProvider>
        ) : (
          <View style={s.screen} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

function Shell() {
  const { tab, quickAddOpen, composerOpen, detailId } = useAppState()
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()

  /*
   * The page recedes while a sheet is up — iOS's own page-sheet behaviour,
   * where what you came from does not merely dim but goes back, taking on
   * rounded corners as it leaves the edges of the screen. It is the thing
   * that makes a sheet read as in front of something rather than pasted on.
   *
   * Transform and opacity only: a scale is free, where animating the size of
   * a view this big would re-run layout on the whole tree every frame.
   */
  const behind = useSharedValue(0)

  useEffect(() => {
    const under = composerOpen || detailId !== null
    behind.set(withTiming(under ? 1 : 0, { duration: SHEET, easing: EASE_SHEET }))
  }, [composerOpen, detailId, behind])

  /*
   * Worked out here, not in the worklet below.
   *
   * A useAnimatedStyle body runs on the UI thread, and the only things it can
   * call there are other worklets. An ordinary function imported from another
   * module is not one: it gets captured in the closure and calling it aborts
   * the app on the spot, before anything has drawn. A number captured the same
   * way is just a number. It also saves a call every frame for a figure that
   * cannot change without the insets changing.
   */
  const lift = recedeLift(insets.top)

  const page = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(behind.get(), [0, 1], [0, lift]) },
      { scale: interpolate(behind.get(), [0, 1], [1, RECEDE]) },
    ],
    borderRadius: interpolate(behind.get(), [0, 1], [0, radius.sheet]),
    opacity: interpolate(behind.get(), [0, 1], [1, 0.72]),
  }))

  return (
    <View style={s.root}>
      <Animated.View style={[s.screen, s.recede, page]}>
      <View style={{ paddingTop: insets.top }}>
        {tab === 'home' ? <TopBar /> : null}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + NAV_HEIGHT + 48 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'home' ? <HomeScreen /> : null}
        {tab === 'insights' ? <InsightsScreen /> : null}
        {tab === 'settings' ? <SettingsScreen /> : null}
      </ScrollView>

      {/*
       * The scrim has to be fully solid before it reaches the top of the nav,
       * which floats 24 above the safe area and now stands 52 tall — so 76 up
       * from the bottom, plus the inset. The frame's own 163-tall gradient
       * lands solid at roughly 68, which does not reach that on any phone,
       * leaving an entry legible right behind the nav. So: taller, and solid
       * sooner. At 200 it is opaque by 100, which clears the bar on a phone
       * with no gesture bar and by more on one that has one.
       */}
      <LinearGradient
        colors={['rgba(4,4,4,0)', color.scrim, color.scrim]}
        locations={[0, 0.5, 1]}
        style={[s.scrim, { height: 200 + insets.bottom }]}
        pointerEvents="none"
      />

      {/*
       * Under the nav, so the bar stays lit and reachable with the chooser up
       * — the scrim is for the ledger behind it, not for the button that
       * opened it. Over the app's own bottom scrim, and under the sheets.
       */}
      <QuickAdd
        inset={insets.bottom}
        open={quickAddOpen}
        onDismiss={() => dispatch({ type: 'toggleQuickAdd', open: false })}
        onChoose={(direction) => dispatch({ type: 'openComposer', direction })}
      />

      <BottomNav inset={insets.bottom} />

      </Animated.View>

      <Composer />
      <DetailSheet />
    </View>
  )
}

const s = StyleSheet.create({
  /* Black behind the page, so its corners have something to round against. */
  root: { flex: 1, backgroundColor: '#000' },
  screen: { flex: 1, backgroundColor: color.bg },
  recede: { overflow: 'hidden' },
  scroll: { flex: 1 },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 15 },
})
