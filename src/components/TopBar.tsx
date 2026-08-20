import { useAppState, useDispatch } from '../store'
import type { Scope } from '../lib/types'
import { GridIcon, SearchIcon } from './Icons'
import './TopBar.css'

const SCOPES: Scope[] = ['business', 'personal']

/** Scope switch on the left, three round utility actions on the right. */
export function TopBar() {
  const { scope, searchOpen, filterOpen, categories } = useAppState()
  const dispatch = useDispatch()

  return (
    <div className="topbar">
      <div className="scope glass" role="tablist" aria-label="Ledger scope">
        <span className="scope__thumb raised glass glass--strong" data-scope={scope} aria-hidden="true" />
        {SCOPES.map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={scope === value}
            className="scope__option"
            data-active={scope === value}
            onClick={() => dispatch({ type: 'setScope', scope: value })}
          >
            <GridIcon size={14} />
            <span>{value === 'business' ? 'Business' : 'Personal'}</span>
          </button>
        ))}
      </div>

      <div className="topbar__actions">
        <RoundButton
          label="Search entries"
          active={searchOpen}
          onClick={() => dispatch({ type: 'toggleSearch' })}
        >
          <SearchIcon size={20} />
        </RoundButton>
        <RoundButton
          label="Filter by category"
          active={filterOpen || categories.length > 0}
          badge={categories.length || undefined}
          onClick={() => dispatch({ type: 'toggleFilter' })}
        >
          <SearchIcon size={20} />
        </RoundButton>
        <RoundButton
          label="Jump to today"
          onClick={() => dispatch({ type: 'selectDate', date: null })}
        >
          <SearchIcon size={20} />
        </RoundButton>
      </div>
    </div>
  )
}

interface RoundButtonProps {
  label: string
  onClick: () => void
  active?: boolean
  badge?: number
  children: React.ReactNode
}

function RoundButton({ label, onClick, active, badge, children }: RoundButtonProps) {
  return (
    <button className="round-btn surface glass" data-active={active} onClick={onClick} aria-label={label}>
      {children}
      {badge ? <span className="round-btn__badge">{badge}</span> : null}
    </button>
  )
}
