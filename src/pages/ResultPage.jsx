/**
 * src/pages/ResultPage.jsx
 *
 * Route: /cdt/result/:assessmentId
 * CDT assessment result page with:
 * - Breadcrumb navigation
 * - Dark Risk Score Card (left)
 * - Clock thumbnail + findings + recommendation (right)
 * - Full feature grid (below)
 * - Print support
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronRight, Printer, PenLine, User } from 'lucide-react'

import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import { RiskScoreCard } from '../components/cdt/RiskScoreCard'
import { ClockThumbnail } from '../components/cdt/ClockThumbnail'
import { FeatureGrid } from '../components/cdt/FeatureGrid'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import { ToastContainer } from '../components/ui/Toast'
import { useApp } from '../context/AppContext'
import { getAssessment } from '../services/firestore'
import { useToast } from '../hooks/useToast'
import { formatDate } from '../utils/formatters'
import { getRiskColor } from '../utils/riskUtils'

// ── Feature detail table (all computed features with normal ranges) ────────────

function FeatureTable({ features = {} }) {
  const rows = [
    {
      label: 'Total Duration',
      value: features.totalDurationMs
        ? `${(features.totalDurationMs / 1000).toFixed(1)}s`
        : '—',
      normal: '< 120s',
      flag: features.totalDurationMs > 120_000,
    },
    {
      label: 'Stroke Count',
      value: features.strokeCount ?? '—',
      normal: '10–30',
      flag: features.strokeCount < 10 || features.strokeCount > 40,
    },
    {
      label: 'Revision Count',
      value: features.revisionCount ?? '—',
      normal: '0–2',
      flag: features.revisionCount > 2,
    },
    {
      label: 'Pause Events (> 2s)',
      value: features.pauseCount ?? '—',
      normal: '0–2',
      flag: features.pauseCount > 2,
    },
    {
      label: 'Total Pause Duration',
      value: features.totalPauseDurationMs
        ? `${(features.totalPauseDurationMs / 1000).toFixed(1)}s`
        : '—',
      normal: '< 5s',
      flag: features.totalPauseDurationMs > 5000,
    },
    {
      label: 'Mean Stroke Velocity',
      value: features.meanStrokeVelocity
        ? `${features.meanStrokeVelocity.toFixed(1)} px/s`
        : '—',
      normal: '> 40 px/s',
      flag: features.meanStrokeVelocity < 40,
    },
    {
      label: 'Velocity Std. Dev.',
      value: features.velocityStdDev
        ? `${features.velocityStdDev.toFixed(1)} px/s`
        : '—',
      normal: '< 40 px/s',
      flag: features.velocityStdDev > 40,
    },
  ]

  return (
    <div
      className="rounded-xl overflow-hidden animate-fade-up delay-3"
      style={{
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        className="px-6 py-4"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-light)' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--accent-primary)', fontSize: '0.6875rem' }}>•</span>
          <span className="label-mono">Feature Reference Table</span>
        </div>
      </div>
      <div style={{ background: 'var(--bg-surface)' }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              {['Feature', 'Observed Value', 'Normal Range', 'Status'].map(h => (
                <th
                  key={h}
                  className="px-6 py-3 text-left"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.625rem',
                    fontWeight: 500,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.label}
                style={{
                  borderBottom: i < rows.length - 1 ? '1px solid var(--border-light)' : 'none',
                  background: 'transparent',
                }}
              >
                <td className="px-6 py-3">
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {row.label}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {row.value}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {row.normal}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.625rem',
                      fontWeight: 500,
                      letterSpacing: '0.10em',
                      textTransform: 'uppercase',
                      color: row.flag ? 'var(--risk-high)' : 'var(--risk-low)',
                    }}
                  >
                    {row.flag ? '⚠ Flagged' : '✓ Normal'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ResultPage() {
  const { assessmentId } = useParams()
  const navigate = useNavigate()
  const { currentPatient } = useApp()
  const { toasts, showToast, dismissToast } = useToast()

  const [assessment, setAssessment] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  // Load assessment from Firestore
  useEffect(() => {
    if (!currentPatient || !assessmentId) {
      setError('Missing patient or assessment ID.')
      setLoading(false)
      return
    }

    getAssessment(currentPatient.id, assessmentId)
      .then(data => {
        if (!data) {
          setError('Assessment not found.')
        } else {
          setAssessment(data)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load assessment:', err)
        setError('Failed to load assessment. Please try again.')
        setLoading(false)
      })
  }, [assessmentId, currentPatient])

  // ── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <p className="label-mono">Loading Assessment...</p>
          </div>
        </main>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────────────────────

  if (error || !assessment) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 text-center max-w-sm">
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.5rem',
                color: 'var(--text-primary)',
              }}
            >
              {error || 'Assessment not found'}
            </p>
            <Button
              variant="primary"
              onClick={() => navigate('/cdt')}
            >
              ← Back to CDT
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const riskColor = getRiskColor(assessment.riskClass ?? 0)
  const sessionNum = (currentPatient?.sessionCount ?? 0) + 1

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Navbar />

      <main className="flex-1">
        <div className="container py-8">

          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 mb-8 animate-fade-up no-print"
          >
            {[
              { label: 'Patient Registry', href: '/cdt' },
              { label: currentPatient?.name ?? 'Patient', href: '/cdt' },
              { label: `CDT Assessment #${sessionNum}`, href: null },
            ].map((crumb, i, arr) => (
              <span key={crumb.label} className="flex items-center gap-1.5">
                {crumb.href ? (
                  <Link
                    to={crumb.href}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6875rem',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6875rem',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                    }}
                  >
                    {crumb.label}
                  </span>
                )}
                {i < arr.length - 1 && (
                  <ChevronRight size={12} color="var(--text-muted)" />
                )}
              </span>
            ))}
          </nav>

          {/* Two-column layout */}
          <div className="grid md:grid-cols-[55%_1fr] gap-6 mb-10">

            {/* Left: Risk Score Card */}
            <div>
              <RiskScoreCard assessment={assessment} />
            </div>

            {/* Right: Thumbnail + Findings + CTAs */}
            <div className="flex flex-col gap-6">

              {/* Clock thumbnail */}
              <ClockThumbnail imageUrl={assessment.imageUrl} />

              {/* Recommendation */}
              {assessment.recommendation && (
                <div
                  className="rounded-xl p-5 animate-fade-up delay-2"
                  style={{
                    background: 'var(--bg-dark)',
                    boxShadow: 'var(--shadow-dark)',
                  }}
                >
                  <p
                    className="mb-2"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.625rem',
                      fontWeight: 500,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'var(--text-on-dark-muted)',
                    }}
                  >
                    Clinical Recommendation
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.9375rem',
                      fontWeight: 300,
                      color: 'var(--text-on-dark)',
                      lineHeight: 1.6,
                    }}
                  >
                    {assessment.recommendation}
                  </p>
                </div>
              )}

              {/* CTA buttons */}
              <div className="flex flex-col gap-2 no-print animate-fade-up delay-3">
                <Button
                  id="btn-view-profile"
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/cdt')}
                  icon={<User size={14} />}
                  className="w-full justify-center"
                >
                  View Patient Profile
                </Button>
                <Button
                  id="btn-new-screening"
                  variant="ghost"
                  size="md"
                  onClick={() => navigate('/cdt')}
                  icon={<PenLine size={14} />}
                  className="w-full justify-center"
                >
                  New Screening
                </Button>
                <Button
                  id="btn-print-report"
                  variant="ghost"
                  size="md"
                  onClick={() => window.print()}
                  icon={<Printer size={14} />}
                  className="w-full justify-center"
                >
                  Print Report
                </Button>
              </div>

              {/* Session meta */}
              <div
                className="rounded-xl p-4 animate-fade-up delay-3"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <p className="label-mono mb-3">Session Metadata</p>
                {[
                  { label: 'Assessment ID', value: assessmentId.slice(0, 8).toUpperCase() },
                  { label: 'Patient', value: currentPatient?.name },
                  { label: 'Submitted', value: formatDate(assessment.submitTimestamp) },
                  { label: 'Administered by', value: 'General Physician' },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-1.5"
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                      {label}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {value ?? '—'}
                    </span>
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* Feature Grid */}
          <div className="mb-10">
            <FeatureGrid features={assessment.features} />
          </div>

          {/* Feature table */}
          <div className="mb-10">
            <FeatureTable features={assessment.features} />
          </div>

        </div>
      </main>

      <Footer />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default ResultPage
