/**
 * src/pages/DrawingPage.jsx
 *
 * Route: /cdt/draw
 * Active drawing session page with:
 * - Patient info bar
 * - Task instruction
 * - DrawingCanvas (core component)
 * - CanvasControls (undo / clear / timer / submit)
 * - LiveFeatureBar
 * - Full submission flow with processing overlay
 * - localStorage draft fallback
 */

import { useRef, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Navbar from '../components/layout/Navbar'
import { PatientInfoBar } from '../components/patient/PatientInfoBar'
import { DrawingCanvas } from '../components/cdt/DrawingCanvas'
import { CanvasControls } from '../components/cdt/CanvasControls'
import { LiveFeatureBar } from '../components/cdt/LiveFeatureBar'
import { ToastContainer } from '../components/ui/Toast'
import Spinner from '../components/ui/Spinner'
import { SessionProvider, useSession } from '../context/SessionContext'
import { useApp } from '../context/AppContext'
import { useCanvasExport } from '../hooks/useCanvasExport'
import { useToast } from '../hooks/useToast'
import { computeFeatures } from '../utils/featureComputer'
import { scoreCDTAssessment } from '../services/scoring'
import { uploadCDTImage } from '../services/storage'
import { createAssessment } from '../services/firestore'

// ── Clinically validated randomized test times ──────────────────────────────
const CLINICAL_TIMES = [
  { text: '10 minutes past 11', hour: 11, minute: 10 },
  { text: '20 minutes past 8',  hour: 8,  minute: 20 },
  { text: '45 minutes past 2',  hour: 2,  minute: 45 },
]

// ── Submission orchestrator (inner component has session context) ─────────────

function DrawingPageInner() {
  const navigate  = useNavigate()
  const canvasRef = useRef(null)
  const { exportToPNG } = useCanvasExport(canvasRef)
  const { toasts, showToast, dismissToast } = useToast()

  const { currentPatient } = useApp()
  const {
    strokes,
    pauseEvents,
    revisionCount,
    hasStarted,
    startTime,
    dispatch,
  } = useSession()

  const [submitting, setSubmitting]     = useState(false)
  const [showOverlay, setShowOverlay]   = useState(false)
  const [overlayText, setOverlayText]   = useState('ANALYZING DRAWING...')
  const [targetTime, setTargetTime]     = useState(CLINICAL_TIMES[0])

  // Randomize prompt on mount
  useEffect(() => {
    const randomTime = CLINICAL_TIMES[Math.floor(Math.random() * CLINICAL_TIMES.length)]
    setTargetTime(randomTime)
  }, [])

  // Guard: redirect if no patient selected
  useEffect(() => {
    if (!currentPatient) {
      navigate('/cdt', { replace: true })
    }
  }, [currentPatient, navigate])

  // localStorage draft — save on every stroke change
  useEffect(() => {
    if (strokes.length === 0) return
    try {
      localStorage.setItem('cdt_session_draft', JSON.stringify({
        strokes,
        pauseEvents,
        revisionCount,
        patientId: currentPatient?.id,
        savedAt: Date.now(),
      }))
    } catch {
      // localStorage may be full — ignore silently
    }
  }, [strokes, pauseEvents, revisionCount, currentPatient])

  // ── Submission flow ──────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (strokes.length < 3) return
    if (submitting) return

    setSubmitting(true)
    setShowOverlay(true)
    setOverlayText('ANALYZING DRAWING...')

    try {
      // 1. Export canvas as PNG
      const imageBase64 = exportToPNG()

      // 2. Compute dynamic features
      const totalDurationMs = startTime
        ? Date.now() - startTime
        : (strokes.length > 0
            ? strokes[strokes.length - 1].endTime - strokes[0].startTime
            : 0)

      const features = computeFeatures(
        strokes.map(s => ({ ...s, isRevision: false })), // revision tracking is in context
        pauseEvents,
        totalDurationMs,
      )
      // Add revision count from context (undo events)
      features.revisionCount = revisionCount
      // Add dynamic time accuracy constraints for the ML geometric backend
      features.targetHour = targetTime.hour
      features.targetMinute = targetTime.minute

      // 3. Score assessment (mock)
      setOverlayText('COMPUTING RISK SCORE...')
      const scoringResult = await scoreCDTAssessment(features, imageBase64)

      // 4. Upload image
      setOverlayText('SAVING ASSESSMENT...')
      const imageUrl = await uploadCDTImage(
        currentPatient.id,
        'new', // will be replaced by actual assessmentId below
        imageBase64,
      )

      // 5. Write to Firestore
      const assessmentData = {
        type: 'cdt',
        startTimestamp: new Date(startTime ?? Date.now()),
        submitTimestamp: new Date(),
        administeredBy: 'GP_MOCK',
        patientId: currentPatient.id,
        imageUrl,
        imageBase64,
        features,
        strokes: strokes.map(s => ({
          strokeId:    s.strokeId,
          durationMs:  s.durationMs,
          pixelLength: s.pixelLength,
          velocity:    s.velocity,
          // Don't store raw points in Firestore (too large) — store count only
          pointCount:  s.points.length,
        })),
        pauseEvents,
        ...scoringResult,
      }

      const assessmentId = await createAssessment(currentPatient.id, assessmentData)

      // 6. Clear localStorage draft
      localStorage.removeItem('cdt_session_draft')

      // 7. Navigate to result page
      navigate(`/cdt/result/${assessmentId}`)

    } catch (err) {
      console.error('Submission failed:', err)
      setSubmitting(false)
      setShowOverlay(false)
      showToast({
        type: 'error',
        message: `Submission failed: ${err.message || 'Unknown error'}. Your strokes are saved locally.`,
      })
    }
  }, [
    strokes, pauseEvents, revisionCount, startTime, targetTime,
    exportToPNG, currentPatient, navigate, showToast, submitting,
  ])

  if (!currentPatient) return null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Minimal navbar with session badge */}
      <Navbar minimal sessionBadge />

      {/* Patient info bar */}
      <PatientInfoBar patient={currentPatient} />

      <main className="flex-1 py-8">
        <div
          className="mx-auto px-4"
          style={{ maxWidth: 'var(--max-width-canvas)' }}
        >

          {/* Task instruction */}
          <div className="mb-5 animate-fade-up">
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: 'var(--accent-primary)', fontSize: '0.6875rem' }}>•</span>
              <span className="label-mono">Task Instruction</span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
                fontWeight: 500,
                fontStyle: 'italic',
                color: 'var(--text-primary)',
                lineHeight: 1.3,
              }}
            >
              "Draw a clock face showing{' '}
              <em style={{ color: 'var(--accent-italic)' }}>{targetTime.text}</em>"
            </p>
          </div>

          {/* Canvas card */}
          <div
            className="rounded-xl p-4 md:p-6 mb-4 animate-fade-up delay-1"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-card)',
              position: 'relative',
            }}
          >
            {/* Processing overlay */}
            {showOverlay && (
              <div className="canvas-overlay">
                <Spinner size="lg" />
                <p className="canvas-overlay-text">{overlayText}</p>
              </div>
            )}

            <DrawingCanvas ref={canvasRef} />

            <CanvasControls
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          </div>

          {/* Live feature bar */}
          <div className="animate-fade-up delay-2">
            <LiveFeatureBar />
          </div>

          {/* Stroke count hint */}
          {!hasStarted && (
            <p
              className="text-center mt-4 animate-fade-in"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.8125rem',
                color: 'var(--text-muted)',
              }}
            >
              Start drawing on the canvas above
            </p>
          )}

        </div>
      </main>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

// Wrap with SessionProvider
export function DrawingPage() {
  return (
    <SessionProvider>
      <DrawingPageInner />
    </SessionProvider>
  )
}

export default DrawingPage
