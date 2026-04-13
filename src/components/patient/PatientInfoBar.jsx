/**
 * src/components/patient/PatientInfoBar.jsx
 *
 * Compact patient information strip displayed at the top of the drawing page.
 * Shows: name, age, gender, ID, session count.
 */

import { User } from 'lucide-react'
import { formatPatientId } from '../../utils/formatters'

export function PatientInfoBar({ patient }) {
  if (!patient) return null

  return (
    <div
      className="w-full py-3"
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-light)',
      }}
      role="region"
      aria-label="Current patient information"
    >
      <div className="container flex items-center gap-4 flex-wrap">
        {/* Patient icon */}
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-full"
          style={{ width: 28, height: 28, background: 'var(--accent-glow)' }}
        >
          <User size={13} color="var(--accent-primary)" />
        </div>

        {/* Name */}
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          {patient.name}
        </span>

        {/* Divider dot */}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.5rem' }}>●</span>

        {/* Metadata chips */}
        <div className="flex items-center gap-3 flex-wrap">
          {[
            `${patient.age}y`,
            patient.gender,
            formatPatientId(patient.id),
          ].map((item, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                fontWeight: 500,
                letterSpacing: '0.06em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              {item}
            </span>
          ))}
        </div>

        {/* Session count */}
        <div className="ml-auto hidden md:flex items-center gap-1.5">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.625rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
            }}
          >
            Session #{(patient.sessionCount ?? 0) + 1}
          </span>
        </div>
      </div>
    </div>
  )
}

export default PatientInfoBar
