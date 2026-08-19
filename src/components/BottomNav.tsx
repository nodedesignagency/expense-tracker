import { useAppState, useDispatch, type Tab } from '../store'
import { ChartIcon, GearIcon, HomeIcon, PlusIcon } from './Icons'
import './BottomNav.css'

const TABS: { id: Tab; label: string; icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'insights', label: 'Insights', icon: ChartIcon },
  { id: 'settings', label: 'Settings', icon: GearIcon },
]

/** Floating nav: a pill of destinations on the left, the primary action right. */
export function BottomNav() {
  const { tab } = useAppState()
  const dispatch = useDispatch()

  return (
    <nav className="nav" aria-label="Primary">
      <div className="nav__pill glass">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              className="nav__item"
              data-active={active}
              aria-current={active ? 'page' : undefined}
              onClick={() => dispatch({ type: 'setTab', tab: id })}
            >
              <Icon size={19} />
              {active ? <span>{label}</span> : <span className="sr-only">{label}</span>}
            </button>
          )
        })}
      </div>

      <button className="nav__add" onClick={() => dispatch({ type: 'openComposer' })}>
        <PlusIcon size={17} />
        <span>Add</span>
      </button>
    </nav>
  )
}
