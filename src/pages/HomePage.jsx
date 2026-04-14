/**
 * src/pages/HomePage.jsx
 *
 * Route: /
 * Unified CogniSense landing inspired by the original CogniScan homepage.
 */

import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'

const FEATURES = [
  {
    num: '01',
    icon: 'Microphone',
    title: 'Acoustic Biomarkers',
    desc: 'Pause ratio, speech rate, pitch dynamics, MFCC coefficients, and vocal stability markers from short speech samples.',
  },
  {
    num: '02',
    icon: 'Text',
    title: 'Lexical Analysis',
    desc: 'Type-token ratio, filler patterns, vocabulary richness, and transcript-based language signals for cognitive screening.',
  },
  {
    num: '03',
    icon: 'Trend',
    title: 'Brain Velocity',
    desc: 'Longitudinal risk slope tracking across sessions to surface subtle decline before static thresholds are crossed.',
  },
  {
    num: '04',
    icon: 'Language',
    title: 'Language-Agnostic',
    desc: 'Acoustic pathway supports multilingual clinics and remains useful even when transcript confidence is low.',
  },
  {
    num: '05',
    icon: 'Insights',
    title: 'Explainable Output',
    desc: 'Clinical flags and recommendations are presented in GP-friendly format for practical frontline use.',
  },
  {
    num: '06',
    icon: 'Device',
    title: 'No Extra Hardware',
    desc: 'Runs on standard clinic tablets and laptops with no specialist sensors or high-cost equipment.',
  },
]

const STEPS = [
  {
    num: '01',
    title: 'Patient Registration',
    desc: 'Select or create a patient profile for longitudinal tracking.',
  },
  {
    num: '02',
    title: 'Speech + CDT Capture',
    desc: 'Record a speech sample and run clock drawing in the same system.',
  },
  {
    num: '03',
    title: 'Feature Extraction',
    desc: 'Acoustic, lexical, and drawing dynamics are computed in seconds.',
  },
  {
    num: '04',
    title: 'Risk + Follow-up',
    desc: 'Review score class, key flags, and recommended next clinical actions.',
  },
]

export default function HomePage() {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
        }
      })
    }, { threshold: 0.12 })

    const animated = document.querySelectorAll('.home-fade-up')
    animated.forEach((el) => observer.observe(el))

    const bars = document.querySelectorAll('[data-bar-target]')
    const timer = setTimeout(() => {
      bars.forEach((bar) => {
        const target = bar.getAttribute('data-bar-target') || '0%'
        bar.style.width = target
      })
    }, 450)

    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <style>{`
        .home-fade-up {
          opacity: 0;
          transform: translateY(22px);
          transition: opacity 0.55s ease, transform 0.55s ease;
        }

        .home-fade-up.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
          gap: 1.5rem;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
        }

        .progress-track {
          width: 100%;
          height: 8px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          width: 0;
          transition: width 900ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        @media (max-width: 1024px) {
          .feature-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .steps-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .hero-grid {
            grid-template-columns: 1fr;
          }

          .feature-grid,
          .steps-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <Navbar />

      <main className="flex-1">
        <div className="container py-8">
          <section
            className="home-fade-up rounded-xl p-6 md:p-8"
            style={{
              background: 'linear-gradient(135deg, rgba(20,26,18,0.95) 0%, rgba(28,36,25,0.92) 55%, rgba(35,46,31,0.9) 100%)',
              border: '1px solid var(--border-dark)',
              boxShadow: 'var(--shadow-dark)',
            }}
          >
            <div className="hero-grid">
              <div>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6875rem',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--accent-light)',
                  }}
                >
                  Unified Cognitive Screening Platform
                </p>

                <h1
                  className="mt-3"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(2.2rem, 5vw, 4rem)',
                    lineHeight: 1.02,
                    color: 'var(--text-on-dark)',
                  }}
                >
                  CogniSense
                  <span style={{ color: 'var(--accent-light)', fontStyle: 'italic' }}> Speech + CDT</span>
                </h1>

                <p
                  className="mt-4"
                  style={{
                    maxWidth: 680,
                    fontFamily: 'var(--font-body)',
                    fontSize: '1rem',
                    color: 'var(--text-on-dark-muted)',
                    lineHeight: 1.65,
                  }}
                >
                  Combined speech biomarkers and clock drawing assessment for early cognitive risk detection,
                  longitudinal tracking, and practical GP-ready interpretation.
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Link to="/speech">
                    <button
                      type="button"
                      style={{
                        border: 'none',
                        borderRadius: 'var(--radius-pill)',
                        padding: '10px 18px',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        background: 'var(--text-on-dark)',
                        color: 'var(--bg-dark)',
                      }}
                    >
                      Begin Speech Assessment
                    </button>
                  </Link>

                  <Link to="/cdt">
                    <button
                      type="button"
                      style={{
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '10px 18px',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        background: 'transparent',
                        color: 'var(--text-on-dark)',
                      }}
                    >
                      Open CDT Module
                    </button>
                  </Link>

                  <Link to="/profile">
                    <button
                      type="button"
                      style={{
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '10px 18px',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        background: 'transparent',
                        color: 'var(--text-on-dark)',
                      }}
                    >
                      Open Patient Profiles
                    </button>
                  </Link>
                </div>
              </div>

              <div
                className="rounded-xl p-5"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <p className="label-mono" style={{ color: 'var(--text-on-dark-muted)' }}>Model Confidence Dashboard</p>

                <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: 'var(--text-on-dark)' }}>Speech Pipeline</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-light)' }}>88%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" data-bar-target="88%" style={{ background: 'var(--accent-light)' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: 'var(--text-on-dark)' }}>CDT Pipeline</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--risk-medium)' }}>84%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" data-bar-target="84%" style={{ background: 'var(--risk-medium)' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: 'var(--text-on-dark)' }}>Fusion Risk Model</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--risk-high)' }}>90%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" data-bar-target="90%" style={{ background: 'var(--risk-high)' }} />
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div
                    className="rounded-lg p-3"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--text-on-dark)' }}>2</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.08em', color: 'var(--text-on-dark-muted)' }}>
                      MODALITIES
                    </p>
                  </div>

                  <div
                    className="rounded-lg p-3"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--text-on-dark)' }}>30s</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.08em', color: 'var(--text-on-dark-muted)' }}>
                      TYPICAL TURNAROUND
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <div className="home-fade-up mb-5">
              <p className="label-mono">What We Measure</p>
              <h2
                className="mt-2"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.8rem, 3.8vw, 2.8rem)',
                  lineHeight: 1.1,
                  color: 'var(--text-primary)',
                }}
              >
                Three biomarker streams,
                <em style={{ color: 'var(--accent-primary)', marginLeft: 8 }}>one unified risk score</em>
              </h2>
            </div>

            <div className="feature-grid">
              {FEATURES.map((feature, idx) => (
                <article
                  key={feature.num}
                  className="home-fade-up rounded-xl p-5"
                  style={{
                    background: idx % 3 === 1 ? 'var(--bg-dark)' : 'var(--bg-surface)',
                    border: idx % 3 === 1 ? '1px solid var(--border-dark)' : '1px solid var(--border-light)',
                    boxShadow: idx % 3 === 1 ? 'var(--shadow-dark)' : 'var(--shadow-card)',
                    transitionDelay: `${idx * 70}ms`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.625rem',
                        letterSpacing: '0.1em',
                        color: idx % 3 === 1 ? 'var(--text-on-dark-muted)' : 'var(--text-muted)',
                      }}
                    >
                      {feature.num}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.625rem',
                        color: 'var(--accent-primary)',
                      }}
                    >
                      {feature.icon}
                    </span>
                  </div>

                  <h3
                    className="mt-3"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.5rem',
                      lineHeight: 1.1,
                      color: idx % 3 === 1 ? 'var(--text-on-dark)' : 'var(--text-primary)',
                    }}
                  >
                    {feature.title}
                  </h3>

                  <p
                    className="mt-2"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                      lineHeight: 1.6,
                      color: idx % 3 === 1 ? 'var(--text-on-dark-muted)' : 'var(--text-secondary)',
                    }}
                  >
                    {feature.desc}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section
            className="home-fade-up mt-10 rounded-xl p-6 md:p-8"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <p className="label-mono">Process</p>
            <h2
              className="mt-2"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.8rem, 3.8vw, 2.6rem)',
                lineHeight: 1.12,
              }}
            >
              From clinic workflow to
              <em style={{ color: 'var(--accent-primary)', marginLeft: 8 }}>actionable cognitive risk</em>
            </h2>

            <div className="steps-grid mt-6">
              {STEPS.map((step, idx) => (
                <div
                  key={step.num}
                  className="home-fade-up rounded-lg p-4"
                  style={{
                    background: idx === 1 ? 'rgba(92,143,104,0.1)' : 'rgba(0,0,0,0.03)',
                    border: '1px solid var(--border-light)',
                    transitionDelay: `${idx * 90}ms`,
                  }}
                >
                  <span className="label-mono">Step {step.num}</span>
                  <h3
                    className="mt-2"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.2rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="mt-2"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                    }}
                  >
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section
            className="home-fade-up mt-10 rounded-xl p-6 md:p-8"
            style={{
              background: 'linear-gradient(135deg, rgba(92,143,104,0.18) 0%, rgba(196,168,79,0.18) 100%)',
              border: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="label-mono">Get Started</p>
                <h2
                  className="mt-2"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1.7rem, 3.4vw, 2.4rem)',
                    lineHeight: 1.1,
                    color: 'var(--text-primary)',
                  }}
                >
                  Run your first unified cognitive screening now
                </h2>
                <p
                  className="mt-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.9375rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Start with speech, continue with CDT, and track change over time in one patient profile.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link to="/speech">
                  <button
                    type="button"
                    style={{
                      border: 'none',
                      borderRadius: 'var(--radius-pill)',
                      padding: '10px 18px',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      background: 'var(--text-primary)',
                      color: 'var(--bg-base)',
                    }}
                  >
                    Begin Assessment
                  </button>
                </Link>

                <Link to="/profile?new=1">
                  <button
                    type="button"
                    style={{
                      border: '1px solid rgba(0,0,0,0.18)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '10px 18px',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      background: 'transparent',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Add New Patient
                  </button>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}

