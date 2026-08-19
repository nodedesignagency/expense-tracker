import { CheckIcon } from '../components/Icons'
import { formatDateHeading } from '../lib/dates'
import { filterLedger } from '../lib/selectors'
import { useAppState, useDispatch, useToday } from '../store'
import type { Scope } from '../lib/types'
import './SettingsScreen.css'

export function SettingsScreen() {
  const state = useAppState()
  const dispatch = useDispatch()
  const today = useToday()

  const counts: Record<Scope, number> = {
    business: filterLedger(state.transactions, { scope: 'business' }).length,
    personal: filterLedger(state.transactions, { scope: 'personal' }).length,
  }

  return (
    <div className="settings">
      <h1 className="settings__title">Settings</h1>

      <section className="settings__group">
        <p className="settings__label">Default ledger</p>
        <div className="settings__card">
          {(['business', 'personal'] as Scope[]).map((scope) => (
            <button
              key={scope}
              className="settings__row"
              onClick={() => dispatch({ type: 'setScope', scope })}
            >
              <span className="settings__row-main">
                <span className="settings__row-title">
                  {scope === 'business' ? 'Business' : 'Personal'}
                </span>
                <span className="settings__row-sub">
                  {counts[scope].toLocaleString('en-US')} entries
                </span>
              </span>
              {state.scope === scope ? <CheckIcon size={18} /> : null}
            </button>
          ))}
        </div>
      </section>

      <section className="settings__group">
        <p className="settings__label">Ledger</p>
        <div className="settings__card">
          <div className="settings__row settings__row--static">
            <span className="settings__row-main">
              <span className="settings__row-title">Today</span>
              <span className="settings__row-sub">
                The demo ledger is pinned to {formatDateHeading(today)}
              </span>
            </span>
          </div>
          <div className="settings__row settings__row--static">
            <span className="settings__row-main">
              <span className="settings__row-title">Storage</span>
              <span className="settings__row-sub">
                Entries you add are kept in this browser only
              </span>
            </span>
          </div>
        </div>
      </section>

      <button className="settings__reset" onClick={() => dispatch({ type: 'resetLedger' })}>
        Reset to the seeded ledger
      </button>

      <p className="settings__foot">Piggy · dark-mode expense tracker</p>
    </div>
  )
}
