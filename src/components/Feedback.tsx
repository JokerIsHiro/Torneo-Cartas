import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { FeedbackContext, type ConfirmOptions, type Toast, type ToastTone } from './feedbackContext'

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null)

  const notify = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts(current => [...current.slice(-3), { ...toast, id }])
    window.setTimeout(() => {
      setToasts(current => current.filter(item => item.id !== id))
    }, 3200)
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      setConfirmState({ ...options, resolve })
    })
  }, [])

  const contextValue = useMemo(() => ({ notify, confirm }), [confirm, notify])

  function closeConfirm(value: boolean) {
    confirmState?.resolve(value)
    setConfirmState(null)
  }

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map(toast => (
          <article key={toast.id} className={`toast-card toast-${toast.tone}`}>
            <i className={getToastIcon(toast.tone)} aria-hidden="true" />
            <div>
              <strong>{toast.title}</strong>
              {toast.message && <span>{toast.message}</span>}
            </div>
            <button type="button" onClick={() => setToasts(current => current.filter(item => item.id !== toast.id))} aria-label="Cerrar aviso">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>

      {confirmState && (
        <div className="confirm-backdrop" role="presentation" onMouseDown={() => closeConfirm(false)}>
          <section
            className={`confirm-card ${confirmState.tone === 'danger' ? 'danger' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={confirmState.title}
            onMouseDown={event => event.stopPropagation()}
          >
            <header>
              <i className={confirmState.tone === 'danger' ? 'ti ti-alert-triangle' : 'ti ti-help-circle'} aria-hidden="true" />
              <div>
                <strong>{confirmState.title}</strong>
                {confirmState.message && <span>{confirmState.message}</span>}
              </div>
            </header>
            <footer>
              <button type="button" onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel ?? 'Cancelar'}
              </button>
              <button type="button" onClick={() => closeConfirm(true)}>
                {confirmState.confirmLabel ?? 'Confirmar'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </FeedbackContext.Provider>
  )
}

function getToastIcon(tone: ToastTone) {
  if (tone === 'success') return 'ti ti-circle-check'
  if (tone === 'warning') return 'ti ti-alert-triangle'
  if (tone === 'danger') return 'ti ti-circle-x'
  return 'ti ti-info-circle'
}
