/**
 * src/pages/CDTLandingPage.jsx
 *
 * Route: /cdt
 * Landing page with: page header, patient selector, instructions,
 * "How This Works" section, and Start Test CTA.
 */

import { useNavigate } from 'react-router-dom'
import { Zap, BarChart2, PenLine } from 'lucide-react'
import { useState } from 'react'

import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import PageHeader from '../components/ui/PageHeader'
import { PatientSelector } from '../components/patient/PatientSelector'
import Button from '../components/ui/Button'
import { useApp } from '../context/AppContext'

// ── Instruction Step ──────────────────────────────────────────────────────────

function InstructionStep({ number, title, description }) {
  return (
    <div className="flex gap-4">
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full"
        style={{
          width: 36,
          height: 36,
          border: '1.5px solid var(--accent-primary)',
          color: 'var(--accent-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          fontWeight: 500,
        }}
      >
        {String(number).padStart(2, '0')}
      </div>
      <div>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: '0.9375rem', marginBottom: 4 }}>
          {title}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
    </div>
  )
}

// ── How It Works Card ──────────────────────────────────────────────────────────

function HowItWorksCard({ index, icon: Icon, title, description, dark = false }) {
  const [hovered, setHovered] = useState(dark) // dark cards start hovered

  return (
    <div
      className="rounded-xl p-6 transition-all duration-200 cursor-default"
      style={{
        background: (hovered || dark) ? 'var(--bg-dark)' : 'var(--bg-surface)',
        border: (hovered || dark) ? 'none' : '1px solid var(--border-light)',
        boxShadow: (hovered || dark) ? 'var(--shadow-dark)' : 'var(--shadow-card)',
      }}
      onMouseEnter={() => !dark && setHovered(true)}
      onMouseLeave={() => !dark && setHovered(false)}
    >
      <div className="flex items-center gap-3 mb-4">
        <Icon size={18} color="var(--accent-primary)" />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.625rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: (hovered || dark) ? 'var(--text-on-dark-muted)' : 'var(--text-muted)',
          }}
        >
          Step {String(index).padStart(2, '0')}
        </span>
      </div>
      <h3
        className="mb-2"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.25rem',
          fontWeight: 500,
          color: (hovered || dark) ? 'var(--text-on-dark)' : 'var(--text-primary)',
          transition: 'color 0.2s',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.875rem',
          color: (hovered || dark) ? 'var(--text-on-dark-muted)' : 'var(--text-secondary)',
          lineHeight: 1.6,
          transition: 'color 0.2s',
        }}
      >
        {description}
      </p>
    </div>
  )
}

// ── Clock Illustration SVG ────────────────────────────────────────────────────

function ClockIllustration() {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: '100%',
        aspectRatio: '1/1',
        maxWidth: 220,
        margin: '0 auto',
      }}
    >
      <svg viewBox="0 0 200 200" fill="none" style={{ width: '100%', height: '100%' }}>
        {/* Clock face */}
        <circle cx="100" cy="100" r="88" stroke="var(--canvas-outline)" strokeWidth="2" />
        {/* Hour hand (10 o'clock) */}
        <line x1="100" y1="100" x2="62" y2="45" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />
        {/* Minute hand (2 o'clock = 10 min past 11 → pointing to 2) */}
        <line x1="100" y1="100" x2="145" y2="56" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" />
        {/* Hour numerals at key positions */}
        {[12,3,6,9].map((n, i) => {
          const angles = [-90, 0, 90, 180]
          const r = 72
          const x = 100 + r * Math.cos((angles[i] * Math.PI) / 180)
          const y = 100 + r * Math.sin((angles[i] * Math.PI) / 180)
          return (
            <text
              key={n}
              x={x} y={y + 5}
              textAnchor="middle"
              fill="var(--text-primary)"
              fontFamily="var(--font-display)"
              fontSize="16"
              fontWeight="500"
            >
              {n}
            </text>
          )
        })}
        {/* Center dot */}
        <circle cx="100" cy="100" r="3" fill="var(--text-primary)" />
        {/* Tick marks */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180)
          const x1 = 100 + 82 * Math.cos(angle)
          const y1 = 100 + 82 * Math.sin(angle)
          const x2 = 100 + 75 * Math.cos(angle)
          const y2 = 100 + 75 * Math.sin(angle)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--canvas-outline)" strokeWidth="1.5" />
        })}
      </svg>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function CDTLandingPage() {
  const navigate = useNavigate()
  const { currentPatient } = useApp()

  const handleStartTest = () => {
    if (!currentPatient) return
    navigate('/cdt/draw')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Navbar />

      <main className="flex-1">
        <div className="container">

          {/* Page Header */}
          <PageHeader
            label="CDT MODULE · VISUOSPATIAL"
            title="Clock Drawing Test"
            italicWord="Drawing"
            description="Digitized visuospatial assessment capturing both the final image and real-time drawing process dynamics for pre-clinical Alzheimer's screening."
            className="animate-fade-up"
          />

          {/* Patient Selector */}
          <div className="mb-8 animate-fade-up delay-1 max-w-2xl">
            <PatientSelector />
          </div>

          {/* Instructions + Illustration */}
          <div
            className="grid md:grid-cols-2 gap-8 mb-8 p-8 rounded-xl animate-fade-up delay-2"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {/* Left: Instructions */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <span style={{ color: 'var(--accent-primary)', fontSize: '0.6875rem' }}>•</span>
                <span className="label-mono">Test Instructions</span>
              </div>
              <div className="flex flex-col gap-6">
                <InstructionStep
                  number={1}
                  title="Select your patient above"
                  description="Choose the patient from the registry to begin a new CDT session."
                />
                <InstructionStep
                  number={2}
                  title="Hand the device to the patient"
                  description="Place the tablet or phone in front of the patient, ensuring they can reach the screen comfortably."
                />
                <InstructionStep
                  number={3}
                  title="Read the task prompt aloud"
                  description={'Say: \u201cPlease draw a clock face showing 10 minutes past 11.\u201d Do not provide further guidance.'}
                />
              </div>
            </div>

            {/* Right: Clock illustration */}
            <div className="flex flex-col items-center justify-center gap-4">
              <ClockIllustration />
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                }}
              >
                Example: 10 minutes past 11
              </p>
            </div>
          </div>

          {/* Start Test CTA */}
          <div className="mb-16 animate-fade-up delay-3">
            <Button
              id="btn-start-cdt"
              variant="primary"
              size="lg"
              onClick={handleStartTest}
              disabled={!currentPatient}
              className="w-full max-w-2xl"
              icon={<PenLine size={16} />}
              aria-label="Begin Clock Drawing Test"
            >
              {currentPatient
                ? `Begin Test for ${currentPatient.name} →`
                : 'Select a patient to begin'}
            </Button>
            {!currentPatient && (
              <p
                className="mt-2 text-center"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                }}
              >
                Please select a patient from the registry above to enable the test.
              </p>
            )}
          </div>

          {/* How This Works */}
          <div className="mb-16 animate-fade-up delay-4">
            <div className="flex items-center gap-2 mb-6">
              <span style={{ color: 'var(--accent-primary)', fontSize: '0.6875rem' }}>•</span>
              <span className="label-mono">How This Works</span>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <HowItWorksCard
                index={1}
                icon={PenLine}
                title="Static Analysis"
                description="The completed clock drawing is analyzed by a Vision Transformer (ViT) model that evaluates spatial arrangement, numeral placement, and hand positioning."
              />
              <HowItWorksCard
                index={2}
                icon={Zap}
                title="Dynamic Features"
                description="Every stroke is recorded with millisecond precision — velocity, pauses, revisions, and drawing order reveal cognitive processing patterns invisible on paper."
                dark
              />
              <HowItWorksCard
                index={3}
                icon={BarChart2}
                title="Risk Score Fusion"
                description="Static and dynamic scores are fused into a unified CDT Risk Score (0–100) via our Cross-Attention Transformer, mapped to one of four cognitive risk classes."
              />
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}

export default CDTLandingPage
