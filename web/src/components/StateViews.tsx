import { useEffect, useState, type ReactNode } from 'react'
import { AppError } from '../api/client'
import { errorMessage } from '../lib/format'
import { t } from '../lib/i18n'
import { AlertIcon } from './Icons'

const WAKE_UP_HINT_DELAY_MS = 4000

export function Loading() {
  return (
    <div className="state-view" role="status">
      <div className="spinner" />
      <WakeUpHint />
    </div>
  )
}

/** Only shown when loading is unusually slow, which in practice means the server is cold-starting. */
export function WakeUpHint() {
  const [showHint, setShowHint] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(true), WAKE_UP_HINT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])
  return showHint ? <p className="muted state-hint">{t.serverWakingUp}</p> : null
}

/** With onBack, a record that no longer exists offers a way out instead of a retry that can only fail again. */
export function ErrorState({ error, onRetry, onBack }: { error: unknown; onRetry: () => void; onBack?: () => void }) {
  const gone = onBack != null && error instanceof AppError && error.kind === 'notFound'
  return (
    <MessageState icon={<AlertIcon size={32} />} title={errorMessage(error)}>
      <button className="btn btn-tonal" onClick={gone ? onBack : onRetry}>
        {gone ? t.goBack : t.retry}
      </button>
    </MessageState>
  )
}

export function MessageState({ icon, title, body, children }: { icon: ReactNode; title: ReactNode; body?: string; children?: ReactNode }) {
  return (
    <div className="state-view">
      <div className="state-icon" aria-hidden>
        {icon}
      </div>
      <h2 className="state-title">{title}</h2>
      {body && <p className="muted state-body">{body}</p>}
      {children}
    </div>
  )
}
