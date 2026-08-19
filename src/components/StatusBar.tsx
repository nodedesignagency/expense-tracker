import './StatusBar.css'

/**
 * Cosmetic iOS-style status bar. The app renders inside a phone frame on
 * desktop, so the chrome is drawn rather than borrowed from the OS.
 */
export function StatusBar({ time = '9:41', battery = 82 }: { time?: string; battery?: number }) {
  return (
    <div className="statusbar" aria-hidden="true">
      <div className="statusbar__time">
        <span>{time}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21.4 3.6 4.1 10.3c-1.2.5-1.1 2.2.1 2.5l6.6 1.9 1.9 6.6c.3 1.2 2 1.3 2.5.1l6.7-17.3c.4-1-.5-1.9-1.5-1.5Z" />
        </svg>
      </div>

      <div className="statusbar__notch" />

      <div className="statusbar__right">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
          <rect x="0" y="7" width="3" height="5" rx="1" />
          <rect x="5" y="4.5" width="3" height="7.5" rx="1" />
          <rect x="10" y="2" width="3" height="10" rx="1" opacity=".35" />
          <rect x="15" y="0" width="3" height="12" rx="1" opacity=".35" />
        </svg>
        <svg width="20" height="12" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <path d="M10 4.5H7a2.5 2.5 0 0 0 0 5h3M14 4.5h3a2.5 2.5 0 0 1 0 5h-3M8.5 7h7" />
        </svg>
        <span className="statusbar__battery">
          <span className="statusbar__battery-fill" style={{ width: `${battery}%` }} />
          <span className="statusbar__battery-label">{battery}</span>
        </span>
      </div>
    </div>
  )
}
