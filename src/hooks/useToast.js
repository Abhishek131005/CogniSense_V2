/**
 * src/hooks/useToast.js
 *
 * Toast notification state management hook.
 * Used together with the Toast component.
 */

import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

/**
 * @returns {{ toasts, showToast, dismissToast }}
 */
export function useToast() {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback(({ message, type = 'success', duration = 4000 }) => {
    const id = uuidv4()
    setToasts(prev => [...prev, { id, message, type, duration }])

    // Auto-dismiss
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)

    return id
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, showToast, dismissToast }
}
