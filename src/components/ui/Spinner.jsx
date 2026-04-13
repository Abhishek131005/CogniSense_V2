/**
 * src/components/ui/Spinner.jsx
 *
 * Animated SVG arc spinner in accent green.
 * Sizes: sm (16px), md (32px), lg (48px).
 */

const sizes = {
  sm: { dim: 16, stroke: 2 },
  md: { dim: 32, stroke: 2.5 },
  lg: { dim: 48, stroke: 3 },
}

export function Spinner({ size = 'md', color = 'var(--accent-primary)', className = '' }) {
  const { dim, stroke } = sizes[size] ?? sizes.md
  const r = (dim - stroke * 2) / 2
  const circ = 2 * Math.PI * r

  return (
    <svg
      width={dim}
      height={dim}
      viewBox={`0 0 ${dim} ${dim}`}
      className={`animate-spin ${className}`}
      style={{ animationDuration: '0.8s' }}
      aria-label="Loading"
      role="status"
    >
      {/* Background track */}
      <circle
        cx={dim / 2}
        cy={dim / 2}
        r={r}
        fill="none"
        stroke="rgba(0,0,0,0.08)"
        strokeWidth={stroke}
      />
      {/* Animated arc */}
      <circle
        cx={dim / 2}
        cy={dim / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * 0.75}
        transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
      />
    </svg>
  )
}

export default Spinner
