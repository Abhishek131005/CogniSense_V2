/**
 * src/hooks/useTimer.js
 *
 * Session timer hook — counts elapsed time since the session started.
 * Auto-starts on first use, can be reset.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { formatDuration } from '../utils/formatters'

/**
 * @param {boolean} active — whether the timer should be running
 * @returns {{ elapsedMs: number, elapsedFormatted: string, isWarning: boolean }}
 */
export function useTimer(active) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef  = useRef(null)
  const rafRef    = useRef(null)

  useEffect(() => {
    if (!active) {
      // Pause: store elapsed so far
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    // Start fresh from current elapsed
    const base = elapsedMs
    startRef.current = performance.now() - base

    function tick() {
      setElapsedMs(performance.now() - startRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setElapsedMs(0)
    startRef.current = null
  }, [])

  return {
    elapsedMs,
    elapsedFormatted: formatDuration(elapsedMs),
    isWarning: elapsedMs > 180_000, // 3 minutes
    reset,
  }
}
