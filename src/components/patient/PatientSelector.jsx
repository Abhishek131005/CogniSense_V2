/**
 * src/components/patient/PatientSelector.jsx
 *
 * Dropdown patient selector that reads from AppContext.
 * Displays name, age, gender, ID and patient metadata.
 */

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, User, Search } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { formatDate, formatPatientId } from '../../utils/formatters'
import Spinner from '../ui/Spinner'

export function PatientSelector() {
  const { patients, currentPatient, setCurrentPatient, patientsLoading, patientsError } = useApp()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState({})
  const dropdownRef = useRef(null)
  const triggerRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Compute dropdown position from trigger rect (fixed positioning)
  const handleOpenToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      })
    }
    setOpen(prev => !prev)
  }

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (patient) => {
    setCurrentPatient(patient)
    setOpen(false)
    setSearch('')
  }

  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Label */}
      <div className="flex items-center gap-2 mb-4">
        <span style={{ color: 'var(--accent-primary)', fontSize: '0.6875rem' }}>•</span>
        <span className="label-mono">Select Patient</span>
      </div>

      {/* Dropdown trigger */}
      <div className="relative">
        <button
          ref={triggerRef}
          id="patient-selector-trigger"
          onClick={handleOpenToggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Select a patient"
          className="w-full flex items-center justify-between gap-3 text-left"
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${open ? 'var(--accent-primary)' : 'var(--border-light)'}`,
            background: 'var(--canvas-bg)',
            transition: 'border-color 0.2s',
            cursor: 'pointer',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-full"
              style={{ width: 32, height: 32, background: 'var(--accent-glow)' }}
            >
              {patientsLoading
                ? <Spinner size="sm" />
                : <User size={15} color="var(--accent-primary)" />
              }
            </div>
            <div className="min-w-0">
              {currentPatient ? (
                <>
                  <p
                    className="truncate"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.9375rem',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {currentPatient.name}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6875rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {currentPatient.age}y · {currentPatient.gender} · {formatPatientId(currentPatient.id)}
                  </p>
                </>
              ) : (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: patientsError ? 'var(--risk-high)' : 'var(--text-muted)' }}>
                  {patientsLoading ? 'Loading patients...' : patientsError ? 'Connection Error' : 'Select a patient to begin'}
                </p>
              )}
            </div>
          </div>
          <ChevronDown
            size={16}
            color="var(--text-muted)"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
          />
        </button>

        {/* Dropdown list — rendered into a portal so it truly breaks out of all CSS transforms */}
        {open && createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label="Patient list"
            className="rounded-xl overflow-hidden"
            style={{
              ...dropdownStyle,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-elevated)',
            }}
          >
            {/* Search */}
            <div className="p-3 border-b" style={{ borderColor: 'var(--divider)' }}>
              <div className="relative">
                <Search size={13} color="var(--text-muted)" className="absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  placeholder="Search by name or ID..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--canvas-bg)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                  }}
                  aria-label="Search patients"
                />
              </div>
            </div>

            {/* Patient list */}
            <ul className="max-h-60 overflow-y-auto">
              {patientsError ? (
                <li className="px-4 py-6 text-center">
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--risk-high)' }}>
                    Failed to connect to Firebase:<br/>
                    <span className="text-xs opacity-70 mt-1 block">{patientsError}</span>
                  </p>
                </li>
              ) : filtered.length === 0 ? (
                <li className="px-4 py-6 text-center">
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    No patients found
                  </p>
                </li>
              ) : (
                filtered.map(patient => (
                  <li
                    key={patient.id}
                    role="option"
                    aria-selected={currentPatient?.id === patient.id}
                    onClick={() => handleSelect(patient)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                    style={{
                      background: currentPatient?.id === patient.id ? 'var(--accent-glow)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (currentPatient?.id !== patient.id) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
                    onMouseLeave={e => { if (currentPatient?.id !== patient.id) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div
                      className="flex-shrink-0 flex items-center justify-center rounded-full"
                      style={{ width: 32, height: 32, background: 'var(--accent-glow)' }}
                    >
                      <User size={14} color="var(--accent-primary)" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {patient.name}
                      </p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        {patient.age}y · {patient.gender} · {formatPatientId(patient.id)}
                      </p>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                      {patient.sessionCount} sessions
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body
        )}
      </div>

      {/* Patient meta info below selector */}
      {currentPatient && (
        <div
          className="mt-4 flex items-center gap-4 flex-wrap"
          style={{
            paddingTop: '12px',
            borderTop: '1px solid var(--border-light)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            ID: <strong style={{ color: 'var(--text-secondary)' }}>{formatPatientId(currentPatient.id)}</strong>
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            Registered: <strong style={{ color: 'var(--text-secondary)' }}>{formatDate(currentPatient.createdAt)}</strong>
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            Sessions: <strong style={{ color: 'var(--text-secondary)' }}>{currentPatient.sessionCount}</strong>
          </span>
        </div>
      )}
    </div>
  )
}

export default PatientSelector
