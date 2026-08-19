import { useEffect, type ReactNode } from 'react'
import { CloseIcon } from './Icons'
import './Sheet.css'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** Optional footer pinned under the scrollable body. */
  footer?: ReactNode
}

/** Bottom sheet used for the composer, entry details and filters. */
export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="sheet-layer">
      <button className="sheet-scrim" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__grabber" aria-hidden="true" />
        <header className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button className="sheet__close" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer ? <div className="sheet__footer">{footer}</div> : null}
      </div>
    </div>
  )
}
