import type { ComponentType } from 'react'
import { useAppState, useDispatch, type Tab } from '../store'
import { ChartIcon, GearIcon, PlusIcon } from './Icons'
import './BottomNav.css'

interface TabDef {
  id: Tab
  label: string
  /** The home destination uses the 3D glyph; the rest are inline vectors. */
  art?: string
  Icon?: ComponentType<{ size?: number }>
}

const TABS: TabDef[] = [
  { id: 'home', label: 'Home', art: '/art/home-icon.png' },
  { id: 'insights', label: 'Insights', Icon: ChartIcon },
  { id: 'settings', label: 'Settings', Icon: GearIcon },
]

/** Two floating groups: destinations pinned left, the primary action right. */
export function BottomNav() {
  const { tab } = useAppState()
  const dispatch = useDispatch()

  return (
    <nav className="nav" aria-label="Primary">
      <div className="nav__group">
        {TABS.map(({ id, label, art, Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              className={active ? 'nav__item raised glass glass--strong' : 'nav__item'}
              data-active={active}
              aria-current={active ? 'page' : undefined}
              onClick={() => dispatch({ type: 'setTab', tab: id })}
            >
              <span className="nav__glyph" data-art={Boolean(art)}>
                {art ? <img src={art} alt="" /> : Icon ? <Icon size={16} /> : null}
              </span>
              {active ? <span>{label}</span> : <span className="sr-only">{label}</span>}
            </button>
          )
        })}
      </div>

      <button className="nav__add accent" onClick={() => dispatch({ type: 'openComposer' })}>
        <PlusIcon size={12} />
        <span>Add</span>
      </button>
    </nav>
  )
}
