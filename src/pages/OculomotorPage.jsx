/**
 * src/pages/OculomotorPage.jsx
 *
 * Route: /oculomotor
 * Integrated oculomotor workflow in the unified CogniSense frontend.
 */

import { useMemo, useState } from 'react'
import { Activity, Camera, Eye, FlaskConical, Save, UploadCloud } from 'lucide-react'

import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { PatientSelector } from '../components/patient/PatientSelector'
import { useApp } from '../context/AppContext'
import { createAssessment } from '../services/firestore'
import {
  analyzeLatestOculomotorReport,
  analyzeOculomotorDemo,
  analyzeOculomotorMetrics,
  startOculomotorCameraTask,
} from '../services/oculomotor'

const DEFAULT_METRICS = {
  trial_count: 20,
  antisaccade_errors: 5,
  avg_latency_ms: 290,
  fixation_rmsd: 0.09,
  pursuit_gain: 0.82,
}

function riskColor(classIdx) {
  if (classIdx === 3) return 'var(--risk-critical)'
  if (classIdx === 2) return 'var(--risk-high)'
  if (classIdx === 1) return 'var(--risk-medium)'
  return 'var(--risk-low)'
}

function toNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export default function OculomotorPage() {
  const { currentPatient } = useApp()

  const [metrics, setMetrics] = useState(DEFAULT_METRICS)
  const [result, setResult] = useState(null)
  const [statusText, setStatusText] = useState('Waiting for oculomotor input metrics.')
  const [error, setError] = useState(null)

  const [analyzing, setAnalyzing] = useState(false)
  const [startingCameraTask, setStartingCameraTask] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAssessmentId, setSavedAssessmentId] = useState(null)

  const busy = analyzing || startingCameraTask

  const errorRate = useMemo(() => {
    const trials = Math.max(1, toNumber(metrics.trial_count, 20))
    const errors = Math.max(0, Math.min(toNumber(metrics.antisaccade_errors, 0), trials))
    return (errors / trials) * 100
  }, [metrics.trial_count, metrics.antisaccade_errors])

  const canSave = !!currentPatient && !!result && !saving && !busy

  const updateMetric = (key, value) => {
    setMetrics((prev) => ({
      ...prev,
      [key]: value,
    }))
    setSavedAssessmentId(null)
  }

  const runAnalysis = async () => {
    setAnalyzing(true)
    setError(null)
    setSavedAssessmentId(null)
    setStatusText('Computing oculomotor risk from submitted metrics...')

    try {
      const payload = {
        trial_count: Math.max(1, Math.round(toNumber(metrics.trial_count, 20))),
        antisaccade_errors: Math.max(0, Math.round(toNumber(metrics.antisaccade_errors, 0))),
        avg_latency_ms: Math.max(0, toNumber(metrics.avg_latency_ms, 280)),
        fixation_rmsd: Math.max(0, toNumber(metrics.fixation_rmsd, 0.08)),
        pursuit_gain: Math.max(0, toNumber(metrics.pursuit_gain, 0.82)),
      }

      if (payload.antisaccade_errors > payload.trial_count) {
        payload.antisaccade_errors = payload.trial_count
      }

      const analysis = await analyzeOculomotorMetrics(payload, 'manual')
      setResult(analysis)
      setStatusText('Oculomotor analysis complete.')
    } catch (err) {
      setResult(null)
      setError(err.message || 'Oculomotor analysis failed.')
      setStatusText('Could not complete oculomotor analysis.')
    } finally {
      setAnalyzing(false)
    }
  }

  const runDemo = async () => {
    setAnalyzing(true)
    setError(null)
    setSavedAssessmentId(null)
    setStatusText('Loading oculomotor demo assessment...')

    try {
      const analysis = await analyzeOculomotorDemo()
      setResult(analysis)
      setMetrics({
        trial_count: analysis.metrics?.trial_count ?? DEFAULT_METRICS.trial_count,
        antisaccade_errors: analysis.metrics?.antisaccade_errors ?? DEFAULT_METRICS.antisaccade_errors,
        avg_latency_ms: analysis.metrics?.avg_latency_ms ?? DEFAULT_METRICS.avg_latency_ms,
        fixation_rmsd: analysis.metrics?.fixation_rmsd ?? DEFAULT_METRICS.fixation_rmsd,
        pursuit_gain: analysis.metrics?.pursuit_gain ?? DEFAULT_METRICS.pursuit_gain,
      })
      setStatusText('Demo oculomotor profile loaded.')
    } catch (err) {
      setResult(null)
      setError(err.message || 'Could not load demo result.')
      setStatusText('Could not load demo oculomotor profile.')
    } finally {
      setAnalyzing(false)
    }
  }

  const runLatestReport = async () => {
    setAnalyzing(true)
    setError(null)
    setSavedAssessmentId(null)
    setStatusText('Reading latest standalone oculomotor report...')

    try {
      const analysis = await analyzeLatestOculomotorReport()
      setResult(analysis)
      setMetrics({
        trial_count: analysis.metrics?.trial_count ?? DEFAULT_METRICS.trial_count,
        antisaccade_errors: analysis.metrics?.antisaccade_errors ?? DEFAULT_METRICS.antisaccade_errors,
        avg_latency_ms: analysis.metrics?.avg_latency_ms ?? DEFAULT_METRICS.avg_latency_ms,
        fixation_rmsd: analysis.metrics?.fixation_rmsd ?? DEFAULT_METRICS.fixation_rmsd,
        pursuit_gain: analysis.metrics?.pursuit_gain ?? DEFAULT_METRICS.pursuit_gain,
      })
      setStatusText('Loaded latest standalone oculomotor report.')
    } catch (err) {
      setResult(null)
      setError(err.message || 'No standalone oculomotor report found.')
      setStatusText('Latest standalone report is unavailable.')
    } finally {
      setAnalyzing(false)
    }
  }

  const runCameraTask = async () => {
    setStartingCameraTask(true)
    setError(null)
    setSavedAssessmentId(null)
    setStatusText('Starting camera task. Follow on-screen instructions in the OpenCV window...')

    try {
      const launch = await startOculomotorCameraTask(900)

      if (launch.status !== 'completed') {
        const stderrLast = Array.isArray(launch.stderr_tail) && launch.stderr_tail.length > 0
          ? launch.stderr_tail[launch.stderr_tail.length - 1]
          : null
        const suffix = stderrLast ? ` Last error: ${stderrLast}` : ''
        throw new Error(`${launch.message}${suffix}`)
      }

      if (!launch.report_available) {
        throw new Error('Camera task finished, but no report was generated. Check webcam permissions and try again.')
      }

      setStatusText('Camera task completed. Importing latest report...')
      const analysis = await analyzeLatestOculomotorReport()
      setResult(analysis)
      setMetrics({
        trial_count: analysis.metrics?.trial_count ?? DEFAULT_METRICS.trial_count,
        antisaccade_errors: analysis.metrics?.antisaccade_errors ?? DEFAULT_METRICS.antisaccade_errors,
        avg_latency_ms: analysis.metrics?.avg_latency_ms ?? DEFAULT_METRICS.avg_latency_ms,
        fixation_rmsd: analysis.metrics?.fixation_rmsd ?? DEFAULT_METRICS.fixation_rmsd,
        pursuit_gain: analysis.metrics?.pursuit_gain ?? DEFAULT_METRICS.pursuit_gain,
      })

      const elapsed = Number(launch.elapsed_seconds || 0)
      setStatusText(`Camera task complete in ${elapsed.toFixed(1)}s. Oculomotor report imported.`)
    } catch (err) {
      setError(err.message || 'Unable to complete camera-based oculomotor task.')
      setStatusText('Camera-based task failed or was interrupted.')
    } finally {
      setStartingCameraTask(false)
    }
  }

  const saveAssessment = async () => {
    if (!currentPatient || !result || saving) return

    setSaving(true)
    setError(null)

    try {
      const now = new Date()
      const assessmentId = await createAssessment(currentPatient.id, {
        type: 'oculomotor',
        source: result.breakdown?.source || 'manual',
        startTimestamp: now,
        submitTimestamp: now,
        administeredBy: 'GP_MOCK',
        patientId: currentPatient.id,
        oculomotorRiskScore: Number(result.risk_score || 0),
        riskClass: Number(result.risk_class || 0),
        riskLabel: result.risk_label || 'Unknown',
        flags: Array.isArray(result.flags) ? result.flags : [],
        recommendation: result.recommendation || '',
        oculomotor: {
          ...result.metrics,
          clinical_risk: result.clinical_risk,
          model_used: result.model_used,
          backend_mode: result.backend_mode,
          breakdown: result.breakdown || null,
        },
      })

      setSavedAssessmentId(assessmentId)
      setStatusText('Oculomotor assessment saved to patient timeline.')
    } catch (err) {
      setError(err.message || 'Failed to save oculomotor assessment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Navbar />

      <main className="flex-1">
        <div className="container py-8">
          <PageHeader
            label="Oculomotor Module"
            title="Integrated Oculomotor Assessment"
            italicWord="Oculomotor"
            description="Run the live camera-based antisaccade and smooth-pursuit task directly from this page, or enter/import metrics, then save outputs to the unified patient timeline."
          />

          <div className="grid lg:grid-cols-[380px_1fr] gap-6">
            <div className="space-y-4">
              <PatientSelector />

              <div
                className="rounded-xl p-4"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <p className="label-mono mb-3">Input Metrics</p>
                <p
                  className="mb-3"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Use these fields for manual entry. For full webcam tracking, use Start Camera Task.
                </p>

                <div className="space-y-3">
                  <label className="block">
                    <span className="label-mono block mb-1">Trials</span>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={metrics.trial_count}
                      onChange={(e) => updateMetric('trial_count', e.target.value)}
                      className="w-full px-3 py-2 rounded-md"
                      style={{
                        border: '1px solid var(--border-light)',
                        background: 'var(--canvas-bg)',
                        fontFamily: 'var(--font-body)',
                      }}
                    />
                  </label>

                  <label className="block">
                    <span className="label-mono block mb-1">Antisaccade Errors</span>
                    <input
                      type="number"
                      min="0"
                      max={Math.max(1, Number(metrics.trial_count) || 20)}
                      value={metrics.antisaccade_errors}
                      onChange={(e) => updateMetric('antisaccade_errors', e.target.value)}
                      className="w-full px-3 py-2 rounded-md"
                      style={{
                        border: '1px solid var(--border-light)',
                        background: 'var(--canvas-bg)',
                        fontFamily: 'var(--font-body)',
                      }}
                    />
                  </label>

                  <label className="block">
                    <span className="label-mono block mb-1">Average Corrective Latency (ms)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={metrics.avg_latency_ms}
                      onChange={(e) => updateMetric('avg_latency_ms', e.target.value)}
                      className="w-full px-3 py-2 rounded-md"
                      style={{
                        border: '1px solid var(--border-light)',
                        background: 'var(--canvas-bg)',
                        fontFamily: 'var(--font-body)',
                      }}
                    />
                  </label>

                  <label className="block">
                    <span className="label-mono block mb-1">Fixation RMSD</span>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={metrics.fixation_rmsd}
                      onChange={(e) => updateMetric('fixation_rmsd', e.target.value)}
                      className="w-full px-3 py-2 rounded-md"
                      style={{
                        border: '1px solid var(--border-light)',
                        background: 'var(--canvas-bg)',
                        fontFamily: 'var(--font-body)',
                      }}
                    />
                  </label>

                  <label className="block">
                    <span className="label-mono block mb-1">Smooth Pursuit Gain</span>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.001"
                      value={metrics.pursuit_gain}
                      onChange={(e) => updateMetric('pursuit_gain', e.target.value)}
                      className="w-full px-3 py-2 rounded-md"
                      style={{
                        border: '1px solid var(--border-light)',
                        background: 'var(--canvas-bg)',
                        fontFamily: 'var(--font-body)',
                      }}
                    />
                  </label>

                  <div
                    className="rounded-md px-3 py-2"
                    style={{
                      background: 'rgba(0,0,0,0.03)',
                      border: '1px dashed var(--border-light)',
                    }}
                  >
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      Estimated error rate: <strong>{errorRate.toFixed(1)}%</strong>
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    onClick={runCameraTask}
                    loading={startingCameraTask}
                    disabled={busy}
                    icon={<Camera size={14} />}
                    className="sm:col-span-2"
                  >
                    Start Camera Task (Follow Ball)
                  </Button>
                  <Button onClick={runAnalysis} loading={analyzing} disabled={busy} icon={<Activity size={14} />}>
                    Analyze
                  </Button>
                  <Button variant="ghost" onClick={runDemo} disabled={busy} icon={<FlaskConical size={14} />}>
                    Demo
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={runLatestReport}
                    disabled={busy}
                    icon={<UploadCloud size={14} />}
                    className="sm:col-span-2"
                  >
                    Use Latest Standalone Report
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div
                className="rounded-xl p-5"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  minHeight: 180,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="label-mono">Analysis Status</p>
                  {busy && <Spinner size="sm" />}
                </div>

                <p
                  className="mt-3"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.95rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {statusText}
                </p>

                {error && (
                  <p
                    className="mt-3"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                      color: 'var(--risk-critical)',
                    }}
                  >
                    {error}
                  </p>
                )}

                {savedAssessmentId && (
                  <p
                    className="mt-3"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                      color: 'var(--risk-low)',
                    }}
                  >
                    Saved as assessment {savedAssessmentId.slice(0, 8).toUpperCase()} for {currentPatient?.name}.
                  </p>
                )}
              </div>

              {result ? (
                <>
                  <div
                    className="rounded-xl p-5"
                    style={{
                      background: 'var(--bg-dark)',
                      color: 'var(--text-on-dark)',
                      boxShadow: 'var(--shadow-dark)',
                    }}
                  >
                    <p className="label-mono" style={{ color: 'var(--text-on-dark-muted)' }}>Oculomotor Risk</p>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <p
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '3rem',
                          lineHeight: 1,
                          color: riskColor(result.risk_class),
                        }}
                      >
                        {Math.round(Number(result.risk_score || 0))}
                      </p>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'var(--text-on-dark-muted)',
                        }}
                      >
                        class {result.risk_class}
                      </span>
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', marginTop: 4 }}>{result.risk_label}</p>
                    <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-on-dark-muted)', marginTop: 8 }}>
                      Clinical Risk: {result.clinical_risk}
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div
                      className="rounded-xl p-4"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}
                    >
                      <p className="label-mono mb-2">Computed Metrics</p>
                      <div className="space-y-2">
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
                          Trials: <strong>{result.metrics?.trial_count ?? '--'}</strong>
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
                          Errors: <strong>{result.metrics?.antisaccade_errors ?? '--'}</strong>
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
                          Error Rate: <strong>{Number(result.metrics?.error_rate_percent || 0).toFixed(2)}%</strong>
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
                          Avg Latency: <strong>{Number(result.metrics?.avg_latency_ms || 0).toFixed(1)} ms</strong>
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
                          Fixation RMSD: <strong>{Number(result.metrics?.fixation_rmsd || 0).toFixed(4)}</strong>
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
                          Pursuit Gain: <strong>{result.metrics?.pursuit_gain == null ? 'N/A' : Number(result.metrics?.pursuit_gain).toFixed(3)}</strong>
                        </p>
                      </div>
                    </div>

                    <div
                      className="rounded-xl p-4"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}
                    >
                      <p className="label-mono mb-2">Clinical Flags</p>
                      {Array.isArray(result.flags) && result.flags.length > 0 ? (
                        <ul className="space-y-2">
                          {result.flags.map((flag) => (
                            <li
                              key={flag}
                              style={{
                                fontFamily: 'var(--font-body)',
                                fontSize: '0.875rem',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              • {flag}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          No flags reported.
                        </p>
                      )}

                      <p
                        className="mt-3"
                        style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}
                      >
                        {result.recommendation}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={saveAssessment} loading={saving} disabled={!canSave} icon={<Save size={14} />}>
                      Save To Patient Timeline
                    </Button>
                    {!currentPatient && (
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.875rem',
                          color: 'var(--risk-high)',
                          alignSelf: 'center',
                        }}
                      >
                        Select a patient to save this assessment.
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div
                  className="rounded-xl p-8 text-center"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <Eye size={26} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
                  <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}>
                    Run analysis to generate oculomotor risk and flags.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
