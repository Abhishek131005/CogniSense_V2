import { useState } from 'react'
import { Eye, Layers3, MousePointer2 } from 'lucide-react'

const DEFAULT_HOUR = 11
const DEFAULT_MINUTE = 10

function clockHand(hour, minute, length, width, isMinuteHand = false) {
  const clockDegrees = isMinuteHand
    ? minute * 6
    : ((hour % 12) * 30) + (minute * 0.5)
  const angle = (clockDegrees - 90) * (Math.PI / 180)
  return {
    x: 100 + Math.cos(angle) * length,
    y: 100 + Math.sin(angle) * length,
    width,
  }
}

function IdealClock({ hour, minute }) {
  const hourHand = clockHand(hour, minute, 32, 4)
  const minuteHand = clockHand(0, minute, 50, 3, true)
  const numerals = Array.from({ length: 12 }, (_, index) => {
    const value = index + 1
    const angle = ((value / 12) * 360 - 90) * (Math.PI / 180)
    return {
      value,
      x: 100 + Math.cos(angle) * 70,
      y: 100 + Math.sin(angle) * 70 + 5,
    }
  })

  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={`Ideal clock showing ${hour}:${String(minute).padStart(2, '0')}`}>
      <rect width="200" height="200" fill="var(--canvas-bg)" />
      <circle cx="100" cy="100" r="78" fill="none" stroke="var(--canvas-outline)" strokeWidth="2" />
      {numerals.map(number => (
        <text
          key={number.value}
          x={number.x}
          y={number.y}
          textAnchor="middle"
          fill="var(--canvas-stroke)"
          fontFamily="var(--font-body)"
          fontSize="12"
          fontWeight="500"
        >
          {number.value}
        </text>
      ))}
      <line x1="100" y1="100" x2={minuteHand.x} y2={minuteHand.y} stroke="var(--canvas-stroke)" strokeWidth={minuteHand.width} strokeLinecap="round" />
      <line x1="100" y1="100" x2={hourHand.x} y2={hourHand.y} stroke="var(--canvas-stroke)" strokeWidth={hourHand.width} strokeLinecap="round" />
      <circle cx="100" cy="100" r="4" fill="var(--accent-primary)" />
    </svg>
  )
}

function explanationForFlag(flag) {
  const normalized = flag.toLowerCase()
  if (normalized.includes('quadrant') || normalized.includes('numeral')) return 'Check whether numbers are distributed around the full circle and remain close to their expected positions.'
  if (normalized.includes('hand')) return 'Check whether two hands meet at the centre and point to the requested time.'
  if (normalized.includes('pause')) return 'Pauses show where the drawing process slowed between strokes.'
  if (normalized.includes('revision')) return 'Revisions indicate that a previous stroke was undone before continuing.'
  if (normalized.includes('velocity')) return 'Stroke speed is compared with the overall movement pattern, not judged from one point alone.'
  if (normalized.includes('duration')) return 'Completion time is compared with the expected duration for this task.'
  return 'This finding is derived from the drawing image or recorded drawing behaviour.'
}

export function ClockComparison({ assessment }) {
  const [mode, setMode] = useState('split')
  const [opacity, setOpacity] = useState(50)
  const features = assessment.features || {}
  const hour = Number(features.targetHour ?? DEFAULT_HOUR)
  const minute = Number(features.targetMinute ?? DEFAULT_MINUTE)
  const image = assessment.imageUrl || assessment.imageBase64
  const flags = Array.isArray(assessment.flags) ? assessment.flags.slice(0, 3) : []

  return (
    <section
      className="rounded-xl p-5 md:p-6 animate-fade-up"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-card)' }}
      aria-labelledby="clock-comparison-title"
    >
      <div className="flex flex-col gap-4 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: 'var(--accent-primary)', fontSize: '0.6875rem' }}>•</span>
              <span className="label-mono">Visual Explanation</span>
            </div>
            <h2 id="clock-comparison-title" className="display-title" style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)' }}>
              Your clock beside the <em>target</em>
            </h2>
            <p className="body-description mt-1">
              The reference shows the requested time: <strong>{hour}:{String(minute).padStart(2, '0')}</strong>.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-light)' }} role="group" aria-label="Comparison view">
            <button type="button" onClick={() => setMode('split')} aria-pressed={mode === 'split'} title="Side-by-side comparison" className="p-2 rounded-md" style={{ color: mode === 'split' ? 'var(--text-primary)' : 'var(--text-muted)', background: mode === 'split' ? 'var(--bg-surface)' : 'transparent' }}>
              <Layers3 size={16} />
            </button>
            <button type="button" onClick={() => setMode('overlay')} aria-pressed={mode === 'overlay'} title="Overlay comparison" className="p-2 rounded-md" style={{ color: mode === 'overlay' ? 'var(--text-primary)' : 'var(--text-muted)', background: mode === 'overlay' ? 'var(--bg-surface)' : 'transparent' }}>
              <Eye size={16} />
            </button>
          </div>
        </div>
      </div>

      {mode === 'split' ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="label-mono mb-2">Submitted drawing</p>
            <div className="rounded-lg overflow-hidden" style={{ aspectRatio: '1 / 1', background: 'var(--canvas-bg)', border: '1px solid var(--canvas-border)' }}>
              {image ? <img src={image} alt="Submitted clock drawing for comparison" className="w-full h-full object-contain" /> : <div className="h-full flex items-center justify-center label-mono">Image unavailable</div>}
            </div>
          </div>
          <div>
            <p className="label-mono mb-2">Ideal reference</p>
            <div className="rounded-lg overflow-hidden" style={{ aspectRatio: '1 / 1', background: 'var(--canvas-bg)', border: '1px solid var(--canvas-border)' }}>
              <IdealClock hour={hour} minute={minute} />
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="relative rounded-lg overflow-hidden" style={{ aspectRatio: '1 / 1', background: 'var(--canvas-bg)', border: '1px solid var(--canvas-border)' }}>
            <IdealClock hour={hour} minute={minute} />
            {image && <img src={image} alt="Submitted clock drawing over ideal reference" className="absolute inset-0 w-full h-full object-contain" style={{ opacity: opacity / 100 }} />}
          </div>
          <label className="flex items-center gap-3 mt-4" style={{ color: 'var(--text-secondary)' }}>
            <MousePointer2 size={15} aria-hidden="true" />
            <span className="label-mono" style={{ minWidth: 82 }}>Your drawing</span>
            <input type="range" min="0" max="100" value={opacity} onChange={event => setOpacity(Number(event.target.value))} aria-label="Adjust submitted drawing opacity" className="w-full" />
            <span className="text-data" style={{ minWidth: 42, textAlign: 'right' }}>{opacity}%</span>
          </label>
        </div>
      )}

      <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border-light)' }}>
        <p className="label-mono mb-3">What to look for</p>
        {flags.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-3">
            {flags.map(flag => (
              <div key={flag} className="rounded-lg p-3" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-light)' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>{flag}</p>
                <p className="mt-2" style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{explanationForFlag(flag)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="body-description">No prominent differences were flagged by the assessment.</p>
        )}
      </div>
    </section>
  )
}

export default ClockComparison
