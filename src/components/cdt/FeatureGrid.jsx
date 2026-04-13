/**
 * src/components/cdt/FeatureGrid.jsx
 *
 * 2×3 grid of light cards displaying computed dynamic features.
 * Each card animates to dark background on hover.
 */

import { useState } from 'react'
import { Clock, PenLine, Undo2, Pause, Activity, BarChart2 } from 'lucide-react'
import { formatDurationHuman, formatVelocity } from '../../utils/formatters'

function FeatureCard({ index, icon: Icon, title, value, unit, description }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="rounded-xl p-5 cursor-default transition-all duration-200"
      style={{
        background:  hovered ? 'var(--bg-dark)' : 'var(--bg-surface)',
        border:      hovered ? 'none' : '1px solid var(--border-light)',
        boxShadow:   hovered ? 'var(--shadow-dark)' : 'var(--shadow-card)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Index + Icon */}
      <div className="flex items-center justify-between mb-4">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.10em',
            color: hovered ? 'var(--text-on-dark-muted)' : 'var(--text-muted)',
            transition: 'color 0.2s',
          }}
        >
          {String(index).padStart(2, '0')}
        </span>
        <Icon
          size={16}
          style={{ color: hovered ? 'var(--accent-primary)' : 'var(--text-muted)', transition: 'color 0.2s' }}
        />
      </div>

      {/* Value */}
      <p
        className="mb-1"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.75rem',
          fontWeight: 500,
          lineHeight: 1.1,
          color: hovered ? 'var(--text-on-dark)' : 'var(--text-primary)',
          transition: 'color 0.2s',
        }}
      >
        {value}
        {unit && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              marginLeft: 4,
              color: hovered ? 'var(--text-on-dark-muted)' : 'var(--text-muted)',
            }}
          >
            {unit}
          </span>
        )}
      </p>

      {/* Title */}
      <p
        className="mb-2"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.9375rem',
          fontWeight: 500,
          color: hovered ? 'var(--text-on-dark)' : 'var(--text-primary)',
          transition: 'color 0.2s',
        }}
      >
        {title}
      </p>

      {/* Description */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.8125rem',
          color: hovered ? 'var(--text-on-dark-muted)' : 'var(--text-secondary)',
          lineHeight: 1.5,
          transition: 'color 0.2s',
        }}
      >
        {description}
      </p>
    </div>
  )
}

export function FeatureGrid({ features = {} }) {
  const {
    totalDurationMs    = 0,
    strokeCount        = 0,
    revisionCount      = 0,
    pauseCount         = 0,
    meanStrokeVelocity = 0,
    velocityStdDev     = 0,
  } = features

  const cards = [
    {
      icon: Clock,
      title: 'Drawing Duration',
      value: formatDurationHuman(totalDurationMs),
      unit: '',
      description: 'Total time from first stroke to submission',
    },
    {
      icon: PenLine,
      title: 'Stroke Count',
      value: strokeCount,
      unit: 'strokes',
      description: 'Total number of pen-lift segments drawn',
    },
    {
      icon: Undo2,
      title: 'Revision Count',
      value: revisionCount,
      unit: 'revisions',
      description: 'Number of undo events — indicates uncertainty',
    },
    {
      icon: Pause,
      title: 'Pause Events',
      value: pauseCount,
      unit: 'pauses',
      description: 'Inter-stroke pauses exceeding 2 seconds',
    },
    {
      icon: Activity,
      title: 'Mean Velocity',
      value: formatVelocity(meanStrokeVelocity),
      unit: '',
      description: 'Average stroke speed — motor fluency indicator',
    },
    {
      icon: BarChart2,
      title: 'Velocity Variation',
      value: formatVelocity(velocityStdDev),
      unit: '',
      description: 'Std. deviation of stroke speed — consistency metric',
    },
  ]

  return (
    <div className="animate-fade-up delay-2">
      {/* Section label */}
      <div className="flex items-center gap-2 mb-6">
        <span style={{ color: 'var(--accent-primary)', fontSize: '0.6875rem' }}>•</span>
        <span className="label-mono">Dynamic Feature Analysis</span>
      </div>

      {/* 2×3 grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <FeatureCard
            key={card.title}
            index={i + 1}
            icon={card.icon}
            title={card.title}
            value={card.value}
            unit={card.unit}
            description={card.description}
          />
        ))}
      </div>
    </div>
  )
}

export default FeatureGrid
