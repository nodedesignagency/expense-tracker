import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { LinearGradient } from 'expo-linear-gradient'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { BottomNav, NAV_HEIGHT } from './src/components/BottomNav'
import { Composer } from './src/components/Composer'
import { DetailSheet } from './src/components/DetailSheet'
import { TopBar } from './src/components/TopBar'
import { HomeScreen } from './src/screens/HomeScreen'
import { InsightsScreen } from './src/screens/InsightsScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { StoreProvider, useAppState } from './src/store'
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
  )
}

function Shell() {
  const { tab } = useAppState()
  const insets = useSafeAreaInsets()

  return (
    <View style={s.screen}>
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
       * which floats 24 above the safe area and stands 40 tall — so 64 up from
       * the bottom, plus the inset. The frame's own 163-tall gradient lands
       * solid at roughly 68, which clears that by four points on a phone with
       * no gesture bar and misses it entirely on one that has one, leaving an
       * entry legible right behind the nav. Taller, and solid sooner.
       */}
      <LinearGradient
        colors={['rgba(4,4,4,0)', color.scrim, color.scrim]}
        locations={[0, 0.5, 1]}
        style={[s.scrim, { height: 200 + insets.bottom }]}
        pointerEvents="none"
      />

      <BottomNav inset={insets.bottom} />

      <Composer />
      <DetailSheet />
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  scroll: { flex: 1 },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 15 },
})
