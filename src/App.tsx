import { BottomNav } from './components/BottomNav'
import { Composer } from './components/Composer'
import { DetailSheet } from './components/DetailSheet'
import { StatusBar } from './components/StatusBar'
import { TopBar } from './components/TopBar'
import { HomeScreen } from './screens/HomeScreen'
import { InsightsScreen } from './screens/InsightsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { StoreProvider, useAppState } from './store'
import './App.css'

function Shell() {
  const { tab } = useAppState()

  return (
    <div className="phone">
      <div className="phone__screen">
        <StatusBar />
        {tab === 'home' ? <TopBar /> : null}

        <main className="phone__scroll" key={tab}>
          {tab === 'home' ? <HomeScreen /> : null}
          {tab === 'insights' ? <InsightsScreen /> : null}
          {tab === 'settings' ? <SettingsScreen /> : null}
          <div className="phone__spacer" />
        </main>

        <BottomNav />
        <Composer />
        <DetailSheet />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
