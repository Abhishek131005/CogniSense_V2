/**
 * src/components/cdt/RiskScoreCard.jsx
 *
 * Dark card displaying CDT risk score after submission.
 * Features:
 * - Count-up animation for score number
 * - Risk class label and badge
 * - 4 animated progress bars for key features
 * - Flag bullet list
 */

import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import ProgressBar from '../ui/ProgressBar'
import Badge from '../ui/Badge'
import { getRiskColor, toPercent } from '../../utils/riskUtils'
import { formatDurationHuman, formatVelocity } from '../../utils/formatters'

/**
 * Animates a number from 0 to `target` over `duration` ms.
 */
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target === 0) return
    const start = performance.now()
    function step(now) {
      const t = Math.min(1, (now - start) / duration)
      // ease-out
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(+(target * eased).toFixed(1))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])

  return value
}

export function RiskScoreCard({ assessment }) {
  const {
    cdtRiskScore = 0,
    riskClass = 0,
    riskLabel = 'Cognitively Normal',
    flags = [],
    features = {},
  } = assessment

  const animatedScore = useCountUp(cdtRiskScore, 800)
  const riskColor = getRiskColor(riskClass)

  // Feature rows for progress bars
  const featureRows = [
    {
      label: 'Drawing Duration',
      display: formatDurationHuman(features.totalDurationMs ?? 0),
      percent: toPercent(features.totalDurationMs ?? 0, 300_000), // 5min max
      color: riskColor,
    },
    {
      label: 'Pause Ratio',
      display: features.pauseCount ?? 0,
      percent: toPercent(features.pauseCount ?? 0, 10),
      color: riskColor,
    },
    {
      label: 'Revision Count',
      display: features.revisionCount ?? 0,
      percent: toPercent(features.revisionCount ?? 0, 10),
      color: riskColor,
    },
    {
      label: 'Stroke Velocity',
      display: formatVelocity(features.meanStrokeVelocity ?? 0),
      percent: toPercent(features.meanStrokeVelocity ?? 0, 200),
      color: 'var(--accent-primary)',
    },
  ]

  return (
    <div
      className="rounded-xl p-8 animate-slide-up"
      style={{
        background: 'var(--bg-dark)',
        boxShadow: 'var(--shadow-dark)',
      }}
      role="region"
      aria-label="CDT Risk Score Card"
    >
      {/* Header label */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-on-dark-muted)',
            }}
          >
            CDT Risk Score
          </p>
        </div>
        <Badge riskClass={riskClass} />
      </div>

      {/* Score number */}
      <div className="mb-2">
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(3rem, 8vw, 4.5rem)',
            fontWeight: 500,
            lineHeight: 1,
            color: riskColor,
          }}
          aria-label={`Risk score: ${cdtRiskScore}`}
        >
          {animatedScore.toFixed(1)}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.875rem',
            color: 'var(--text-on-dark-muted)',
            marginLeft: 8,
          }}
        >
          / 100
        </span>
      </div>

      {/* Risk label */}
      <p
        className="mb-8"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.875rem',
          fontWeight: 300,
          color: 'var(--text-on-dark-muted)',
        }}
      >
        Class {riskClass} — {riskLabel}
      </p>

      {/* Feature progress bars */}
      <div className="flex flex-col gap-4 mb-8">
        {featureRows.map((row, i) => (
          <div key={row.label} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: 'var(--text-on-dark-muted)',
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-on-dark)',
                }}
              >
                {row.display}
              </span>
            </div>
            <ProgressBar
              value={row.percent}
              color={row.color}
              height={3}
              delay={300 + i * 100}
            />
          </div>
        ))}
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div
          className="pt-6"
          style={{ borderTop: '1px solid var(--border-dark)' }}
        >
          <p
            className="mb-3 flex items-center gap-2"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: 'var(--text-on-dark-muted)',
            }}
          >
            <AlertCircle size={12} />
            Clinical Flags
          </p>
          <ul className="flex flex-col gap-2">
            {flags.map((flag, i) => (
              <li
                key={i}
                className="flex items-start gap-2"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.875rem',
                  fontWeight: 300,
                  color: 'var(--text-on-dark)',
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 2 }}>•</span>
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default RiskScoreCard
