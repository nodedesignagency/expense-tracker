import { useAppState, useDispatch, type Tab } from '../store'
import './BottomNav.css'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '/art/home-icon.png' },
  { id: 'insights', label: 'Insights', icon: '/icons/chart.svg' },
  { id: 'settings', label: 'Settings', icon: '/icons/settings.svg' },
]

/** Two floating groups: destinations pinned left, the primary action right. */
export function BottomNav() {
  const { tab } = useAppState()
  const dispatch = useDispatch()

  return (
    <nav className="nav" aria-label="Primary">
      <div className="nav__group">
        {TABS.map(({ id, label, icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              className={active ? 'nav__item raised glass glass--strong' : 'nav__item'}
              data-active={active}
              aria-current={active ? 'page' : undefined}
              onClick={() => dispatch({ type: 'setTab', tab: id })}
            >
              <span className="nav__glyph" data-art={id === 'home'}>
                <img src={icon} alt="" />
              </span>
              {active ? <span>{label}</span> : <span className="sr-only">{label}</span>}
            </button>
          )
        })}
      </div>

      <button className="nav__add accent" onClick={() => dispatch({ type: 'openComposer' })}>
        <img src="/icons/plus.svg" alt="" width={12} height={12} />
        <span>Add</span>
      </button>
    </nav>
  )
}
