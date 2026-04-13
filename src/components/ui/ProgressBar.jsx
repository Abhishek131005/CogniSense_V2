/**
 * src/components/ui/ProgressBar.jsx
 *
 * Animated horizontal progress bar.
 * Animates from 0% → value% on mount using CSS transition.
 */

import { useEffect, useState } from 'react'

/**
 * @param {{
 *   value: number,     — 0–100
 *   color?: string,    — CSS color string
 *   height?: number,   — bar height in px (default 3)
 *   delay?: number,    — animation delay in ms
 *   className?: string
 * }} props
 */
export function ProgressBar({
  value = 0,
  color = 'var(--accent-primary)',
  height = 3,
  delay = 200,
  className = '',
}) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => {
      setWidth(Math.min(100, Math.max(0, value)))
    }, delay)
    return () => clearTimeout(t)
  }, [value, delay])

  return (
    <div
      className={`w-full rounded-pill overflow-hidden ${className}`}
      style={{
        height: `${height}px`,
        backgroundColor: 'rgba(255,255,255,0.08)',
      }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        style={{
          width: `${width}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: 'inherit',
          transition: 'width 0.6s ease-out',
        }}
      />
    </div>
  )
}

export default ProgressBar
