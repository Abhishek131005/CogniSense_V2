/**
 * src/components/ui/Toast.jsx
 *
 * Toast notification container + individual toast item.
 * Renders a fixed bottom-right stack of toast messages.
 */

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

/** Individual toast item */
function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Slide in
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const isSuccess = toast.type === 'success'

  return (
    <div
      role="alert"
      className="flex items-start gap-3 p-4 rounded-xl shadow-dark min-w-[280px] max-w-[360px]"
      style={{
        background: 'var(--bg-dark)',
        borderLeft: `3px solid ${isSuccess ? 'var(--accent-primary)' : 'var(--risk-critical)'}`,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
      }}
    >
      {/* Icon */}
      <span className="flex-shrink-0 mt-0.5">
        {isSuccess
          ? <CheckCircle size={16} color="var(--accent-primary)" />
          : <XCircle size={16} color="var(--risk-critical)" />
        }
      </span>

      {/* Message */}
      <p
        className="flex-1 text-sm leading-snug"
        style={{ color: 'var(--text-on-dark)', fontFamily: 'var(--font-body)' }}
      >
        {toast.message}
      </p>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 opacity-40 hover:opacity-70 transition-opacity"
      >
        <X size={14} color="var(--text-on-dark)" />
      </button>
    </div>
  )
}

/** Container for all active toasts */
export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-6 right-6 flex flex-col gap-2 z-50"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

export default ToastContainer
