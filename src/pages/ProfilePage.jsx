/**
 * src/pages/ProfilePage.jsx
 *
 * Route: /profile
 * Unified patient profile with longitudinal Brain Velocity analytics.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ClipboardList, Eye, Mic, PenLine, Trash2, UserPlus, UserRound, X } from 'lucide-react'

import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { useApp } from '../context/AppContext'
import { getAssessments } from '../services/firestore'
import { getRiskClass } from '../utils/riskUtils'

function riskColor(classIdx) {
  const colorVars = [
    'var(--risk-low)',
    'var(--risk-worried-well)',
    'var(--risk-early-mci)',
    'var(--risk-moderate-mci)',
    'var(--risk-mild-dementia)',
    'var(--risk-critical)',
  ]
  return colorVars[Math.min(5, Math.max(0, classIdx))]
}

function shortClassLabel(label) {
  if (!label) return 'Unknown'
  const right = String(label).split('-')[1]
  return right ? right.trim() : String(label)
}

function toValidDate(value) {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null
  }

  if (typeof value?.toDate === 'function') {
    const converted = value.toDate()
    return converted instanceof Date && Number.isFinite(converted.getTime()) ? converted : null
  }

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const millis = (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000)
    const fromSeconds = new Date(millis)
    return Number.isFinite(fromSeconds.getTime()) ? fromSeconds : null
  }

  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function pickFirstDate(...values) {
  for (const value of values) {
    const date = toValidDate(value)
    if (date) return date
  }
  return null
}

function formatDate(value) {
  const d = toValidDate(value)
  if (!d) return 'NA'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateShort(value) {
  const d = toValidDate(value)
  if (!d) return '--'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function toSessionEntry(assessment) {
  const timestamp = pickFirstDate(
    assessment.submitTimestamp,
    assessment.clientSubmitTimestamp,
    assessment.startTimestamp,
    assessment.createdAt,
    assessment.date,
    assessment.speech?.date,
    assessment.speech?.createdAt,
    assessment.speech?.submitTimestamp,
    assessment.raw?.date,
  )

  if (assessment.type === 'speech') {
    const speech = assessment.speech || {}
    const score = Number(assessment.speechRiskScore ?? speech.risk_score ?? 0)
    const classLabel = assessment.speechRiskClass ?? speech.risk_class ?? 'Unknown'

    return {
      id: assessment.id,
      type: 'speech',
      date: timestamp,
      score,
      classLabel,
      flags: speech.interpretation?.key_flags || assessment.flags || [],
      speech,
      raw: assessment,
    }
  }

  if (assessment.type === 'oculomotor') {
    const oculomotor = assessment.oculomotor || {}
    const score = Number(assessment.oculomotorRiskScore ?? assessment.riskScore ?? 0)

    return {
      id: assessment.id,
      type: 'oculomotor',
      date: timestamp,
      score,
      classLabel: assessment.riskLabel || 'Unknown',
      flags: assessment.flags || [],
      oculomotor,
      raw: assessment,
    }
  }

  const score = Number(assessment.cdtRiskScore ?? 0)
  return {
    id: assessment.id,
    type: 'cdt',
    date: timestamp,
    score,
    classLabel: assessment.riskLabel || 'Unknown',
    flags: assessment.flags || [],
    features: assessment.features || {},
    raw: assessment,
  }
}

function computeBrainVelocity(sessions) {
  const datedSessions = sessions.filter(session => toValidDate(session.date))
  if (datedSessions.length < 2) return null

  const sorted = [...datedSessions].sort((a, b) => toValidDate(a.date) - toValidDate(b.date))
  const baseline = toValidDate(sorted[0].date)
  if (!baseline) return null

  const xs = sorted.map((session) => {
    const sessionDate = toValidDate(session.date)
    if (!sessionDate) return 0
    const days = (sessionDate - baseline) / (1000 * 60 * 60 * 24)
    return days / 30
  })
  const ys = sorted.map(session => Number(session.score || 0))
  const n = xs.length

  const xm = xs.reduce((sum, x) => sum + x, 0) / n
  const ym = ys.reduce((sum, y) => sum + y, 0) / n
  const denom = xs.reduce((sum, x) => sum + (x - xm) ** 2, 0)
  if (denom === 0) return 0

  const slope = xs.reduce((sum, x, idx) => sum + (x - xm) * (ys[idx] - ym), 0) / denom
  return Number.isFinite(slope) ? slope : null
}

function velocityBadgeClass(value) {
  if (value === null) return ''
  const abs = Math.abs(value)
  if (abs < 0.5) return 'stable'
  if (abs < 1.5) return 'slow'
  if (abs < 2.5) return 'fast'
  return 'critical'
}

function drawVelocityChart(canvas, sessions) {
  const datedSessions = sessions.filter(session => toValidDate(session.date))
  if (!canvas || datedSessions.length < 2) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const sorted = [...datedSessions].sort((a, b) => toValidDate(a.date) - toValidDate(b.date))
  const dpr = window.devicePixelRatio || 1
  const cssWidth = canvas.clientWidth || 640
  const cssHeight = 170
  canvas.width = Math.floor(cssWidth * dpr)
  canvas.height = Math.floor(cssHeight * dpr)
  ctx.scale(dpr, dpr)

  const pad = { top: 18, right: 20, bottom: 30, left: 34 }
  const w = cssWidth - pad.left - pad.right
  const h = cssHeight - pad.top - pad.bottom

  const scores = sorted.map(s => Number(s.score || 0))
  const minS = Math.min(...scores, 0)
  const maxS = Math.max(...scores, 100)
  const range = Math.max(1, maxS - minS)

  const toX = (idx) => {
    if (scores.length === 1) return pad.left + w / 2
    return pad.left + (idx / (scores.length - 1)) * w
  }
  const toY = (score) => pad.top + h - ((score - minS) / range) * h

  ctx.clearRect(0, 0, cssWidth, cssHeight)

  const zones = [
    { y1: 0, y2: 25, color: 'rgba(92,143,104,0.08)' },
    { y1: 25, y2: 45, color: 'rgba(196,168,79,0.08)' },
    { y1: 45, y2: 65, color: 'rgba(196,122,58,0.08)' },
    { y1: 65, y2: 100, color: 'rgba(176,64,64,0.08)' },
  ]

  zones.forEach((zone) => {
    const y1 = pad.top + h - ((zone.y1 - minS) / range) * h
    const y2 = pad.top + h - ((zone.y2 - minS) / range) * h
    ctx.fillStyle = zone.color
    ctx.fillRect(pad.left, Math.min(y1, y2), w, Math.abs(y2 - y1))
  })

  ;[0, 25, 50, 75, 100].forEach((tick) => {
    const y = toY(tick)
    ctx.strokeStyle = '#d4cfc5'
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(pad.left + w, y)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = '#7a7468'
    ctx.font = '9px DM Mono, monospace'
    ctx.fillText(String(tick), 2, y + 3)
  })

  if (scores.length >= 2) {
    const xs = scores.map((_, idx) => idx)
    const n = xs.length
    const xm = xs.reduce((sum, x) => sum + x, 0) / n
    const ym = scores.reduce((sum, y) => sum + y, 0) / n
    const slope = xs.reduce((sum, x, idx) => sum + (x - xm) * (scores[idx] - ym), 0)
      / xs.reduce((sum, x) => sum + (x - xm) ** 2, 0)
    const intercept = ym - slope * xm

    ctx.strokeStyle = 'rgba(196,122,58,0.5)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(toX(0), toY(intercept))
    ctx.lineTo(toX(n - 1), toY(intercept + slope * (n - 1)))
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.strokeStyle = '#5c8f68'
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  ctx.beginPath()
  scores.forEach((score, idx) => {
    if (idx === 0) {
      ctx.moveTo(toX(idx), toY(score))
    } else {
      ctx.lineTo(toX(idx), toY(score))
    }
  })
  ctx.stroke()

  scores.forEach((score, idx) => {
    const klass = getRiskClass(score)
    const colors = ['#5c8f68', '#c4a84f', '#c47a3a', '#b04040']

    ctx.beginPath()
    ctx.arc(toX(idx), toY(score), 5, 0, Math.PI * 2)
    ctx.fillStyle = colors[klass]
    ctx.fill()
    ctx.strokeStyle = '#f4f1eb'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#0f1410'
    ctx.font = 'bold 10px DM Mono, monospace'
    ctx.textAlign = 'center'
    ctx.fillText(String(Math.round(score)), toX(idx), toY(score) - 10)
  })

  sorted.forEach((session, idx) => {
    ctx.fillStyle = '#7a7468'
    ctx.font = '9px DM Mono, monospace'
    ctx.textAlign = 'center'
    ctx.fillText(formatDateShort(session.date), toX(idx), cssHeight - 6)
  })
}

function DetailRow({ label, value }) {
  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{
        padding: '4px 0',
        borderBottom: '1px dashed rgba(0,0,0,0.06)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function DetailBlock({ label, value }) {
  return (
    <div
      style={{
        padding: '6px 0',
        borderBottom: '1px dashed rgba(0,0,0,0.06)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.8125rem',
          color: 'var(--text-primary)',
          marginTop: 2,
          whiteSpace: 'pre-wrap',
        }}
      >
        {value}
      </p>
    </div>
  )
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

export default function ProfilePage() {
  const {
    patients,
    currentPatient,
    setCurrentPatient,
    patientsLoading,
    patientsError,
    addNewPatient,
    removePatient,
    updatePatientProfile,
  } = useApp()

  const location = useLocation()
  const navigate = useNavigate()
  const chartCanvasRef = useRef(null)

  const [assessments, setAssessments] = useState([])
  const [loadingAssessments, setLoadingAssessments] = useState(false)
  const [assessmentError, setAssessmentError] = useState(null)
  const [expandedSessions, setExpandedSessions] = useState({})

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creatingPatient, setCreatingPatient] = useState(false)
  const [deletingPatient, setDeletingPatient] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPatient, setEditingPatient] = useState(false)
  const [editError, setEditError] = useState(null)

  const createEmptyPatientForm = () => ({
    name: '',
    age: '',
    gender: 'Female',
    phone: '',
    email: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    primaryPhysician: '',
    insuranceProvider: '',
    insurancePolicyNumber: '',
    heightCm: '',
    weightKg: '',
    bloodType: '',
    allergies: '',
    medications: '',
    pastMedicalHistory: '',
    surgicalHistory: '',
    familyHistory: '',
    socialHistory: '',
    currentSymptoms: '',
    diagnosis: '',
    notes: '',
  })

  const buildPatientFormFromRecord = (patient) => ({
    name: patient?.name || '',
    age: patient?.age ?? '',
    gender: patient?.gender || 'Other',
    phone: patient?.phone || '',
    email: patient?.email || '',
    address: patient?.address || '',
    emergencyContactName: patient?.emergencyContactName || '',
    emergencyContactPhone: patient?.emergencyContactPhone || '',
    primaryPhysician: patient?.primaryPhysician || '',
    insuranceProvider: patient?.insuranceProvider || '',
    insurancePolicyNumber: patient?.insurancePolicyNumber || '',
    heightCm: patient?.heightCm ?? '',
    weightKg: patient?.weightKg ?? '',
    bloodType: patient?.bloodType || '',
    allergies: patient?.allergies || '',
    medications: patient?.medications || '',
    pastMedicalHistory: patient?.pastMedicalHistory || '',
    surgicalHistory: patient?.surgicalHistory || '',
    familyHistory: patient?.familyHistory || '',
    socialHistory: patient?.socialHistory || '',
    currentSymptoms: patient?.currentSymptoms || '',
    diagnosis: patient?.diagnosis || '',
    notes: patient?.notes || '',
  })

  const [newPatientForm, setNewPatientForm] = useState(createEmptyPatientForm())
  const [editPatientForm, setEditPatientForm] = useState(createEmptyPatientForm())

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('new') === '1') {
      setShowCreateModal(true)
    }
  }, [location.search])

  useEffect(() => {
    if (!currentPatient?.id) {
      setAssessments([])
      return
    }

    setLoadingAssessments(true)
    setAssessmentError(null)

    getAssessments(currentPatient.id)
      .then((rows) => {
        setAssessments(rows)
      })
      .catch((err) => {
        setAssessmentError(err.message || 'Failed to load assessments')
      })
      .finally(() => {
        setLoadingAssessments(false)
      })
  }, [currentPatient?.id])

  useEffect(() => {
    if (!currentPatient && patients.length > 0) {
      setCurrentPatient(patients[0])
    }
  }, [patients, currentPatient, setCurrentPatient])

  const sessions = useMemo(() => {
    return assessments
      .map(toSessionEntry)
      .filter(session => Number.isFinite(session.score))
      .sort((a, b) => {
        const ad = toValidDate(a.date)
        const bd = toValidDate(b.date)
        if (!ad && !bd) return 0
        if (!ad) return 1
        if (!bd) return -1
        return ad - bd
      })
  }, [assessments])

  const sessionsDesc = useMemo(() => [...sessions].reverse(), [sessions])
  const datedSessions = useMemo(
    () => sessions.filter(session => toValidDate(session.date)),
    [sessions],
  )

  const speechCount = useMemo(
    () => sessions.filter((session) => session.type === 'speech').length,
    [sessions],
  )
  const cdtCount = useMemo(
    () => sessions.filter((session) => session.type === 'cdt').length,
    [sessions],
  )
  const oculomotorCount = useMemo(
    () => sessions.filter((session) => session.type === 'oculomotor').length,
    [sessions],
  )

  const latestSession = sessions.length ? sessions[sessions.length - 1] : null
  const firstSession = datedSessions.length ? datedSessions[0] : null
  const brainVelocity = useMemo(() => computeBrainVelocity(sessions), [sessions])
  const velocityClass = velocityBadgeClass(brainVelocity)

  const intakeSections = useMemo(() => {
    if (!currentPatient) return []

    const contactRows = [
      hasValue(currentPatient.phone) && { label: 'Phone', value: currentPatient.phone },
      hasValue(currentPatient.email) && { label: 'Email', value: currentPatient.email },
      hasValue(currentPatient.address) && { label: 'Address', value: currentPatient.address },
    ].filter(Boolean)

    const emergencyRows = [
      hasValue(currentPatient.emergencyContactName) && { label: 'Contact Name', value: currentPatient.emergencyContactName },
      hasValue(currentPatient.emergencyContactPhone) && { label: 'Contact Phone', value: currentPatient.emergencyContactPhone },
    ].filter(Boolean)

    const careRows = [
      hasValue(currentPatient.primaryPhysician) && { label: 'Primary Physician', value: currentPatient.primaryPhysician },
    ].filter(Boolean)

    const insuranceRows = [
      hasValue(currentPatient.insuranceProvider) && { label: 'Provider', value: currentPatient.insuranceProvider },
      hasValue(currentPatient.insurancePolicyNumber) && { label: 'Policy Number', value: currentPatient.insurancePolicyNumber },
    ].filter(Boolean)

    const vitalsRows = [
      currentPatient.heightCm != null && currentPatient.heightCm !== ''
        ? { label: 'Height', value: `${currentPatient.heightCm} cm` }
        : null,
      currentPatient.weightKg != null && currentPatient.weightKg !== ''
        ? { label: 'Weight', value: `${currentPatient.weightKg} kg` }
        : null,
      hasValue(currentPatient.bloodType) && { label: 'Blood Type', value: currentPatient.bloodType },
    ].filter(Boolean)

    const historyBlocks = [
      hasValue(currentPatient.allergies) && { label: 'Allergies', value: currentPatient.allergies },
      hasValue(currentPatient.medications) && { label: 'Current Medications', value: currentPatient.medications },
      hasValue(currentPatient.pastMedicalHistory) && { label: 'Past Medical History', value: currentPatient.pastMedicalHistory },
      hasValue(currentPatient.surgicalHistory) && { label: 'Surgical History', value: currentPatient.surgicalHistory },
      hasValue(currentPatient.familyHistory) && { label: 'Family History', value: currentPatient.familyHistory },
      hasValue(currentPatient.socialHistory) && { label: 'Social History', value: currentPatient.socialHistory },
    ].filter(Boolean)

    const presentationBlocks = [
      hasValue(currentPatient.currentSymptoms) && { label: 'Current Symptoms', value: currentPatient.currentSymptoms },
      hasValue(currentPatient.diagnosis) && { label: 'Working Diagnosis', value: currentPatient.diagnosis },
      hasValue(currentPatient.notes) && { label: 'Notes', value: currentPatient.notes },
    ].filter(Boolean)

    return [
      { title: 'Contact', rows: contactRows },
      { title: 'Emergency Contact', rows: emergencyRows },
      { title: 'Care Team', rows: careRows },
      { title: 'Insurance', rows: insuranceRows },
      { title: 'Vitals', rows: vitalsRows },
      { title: 'Medical History', blocks: historyBlocks },
      { title: 'Current Presentation', blocks: presentationBlocks },
    ]
  }, [currentPatient])

  useEffect(() => {
    if (!chartCanvasRef.current || datedSessions.length < 2) return
    drawVelocityChart(chartCanvasRef.current, sessions)
  }, [datedSessions.length, sessions])

  useEffect(() => {
    const onResize = () => {
      if (!chartCanvasRef.current || datedSessions.length < 2) return
      drawVelocityChart(chartCanvasRef.current, sessions)
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [datedSessions.length, sessions])

  const openCreateModal = () => {
    setCreateError(null)
    setShowCreateModal(true)
  }

  const openEditModal = () => {
    if (!currentPatient) return
    setEditError(null)
    setEditPatientForm(buildPatientFormFromRecord(currentPatient))
    setShowEditModal(true)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setCreateError(null)

    const params = new URLSearchParams(location.search)
    if (params.get('new') === '1') {
      params.delete('new')
      const search = params.toString()
      navigate({ pathname: '/profile', search: search ? `?${search}` : '' }, { replace: true })
    }
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditError(null)
  }

  const updateFormField = (key, value) => {
    setNewPatientForm(prev => ({ ...prev, [key]: value }))
  }

  const updateEditField = (key, value) => {
    setEditPatientForm(prev => ({ ...prev, [key]: value }))
  }

  const handleCreatePatient = async (event) => {
    event.preventDefault()

    if (!newPatientForm.name.trim()) {
      setCreateError('Patient name is required.')
      return
    }

    const age = Number(newPatientForm.age)
    if (!Number.isFinite(age) || age < 1) {
      setCreateError('Please enter a valid age.')
      return
    }

    setCreatingPatient(true)
    setCreateError(null)
    try {
      const created = await addNewPatient({
        name: newPatientForm.name.trim(),
        age,
        gender: newPatientForm.gender,
        phone: newPatientForm.phone.trim(),
        email: newPatientForm.email.trim(),
        address: newPatientForm.address.trim(),
        emergencyContactName: newPatientForm.emergencyContactName.trim(),
        emergencyContactPhone: newPatientForm.emergencyContactPhone.trim(),
        primaryPhysician: newPatientForm.primaryPhysician.trim(),
        insuranceProvider: newPatientForm.insuranceProvider.trim(),
        insurancePolicyNumber: newPatientForm.insurancePolicyNumber.trim(),
        heightCm: newPatientForm.heightCm,
        weightKg: newPatientForm.weightKg,
        bloodType: newPatientForm.bloodType.trim(),
        allergies: newPatientForm.allergies.trim(),
        medications: newPatientForm.medications.trim(),
        pastMedicalHistory: newPatientForm.pastMedicalHistory.trim(),
        surgicalHistory: newPatientForm.surgicalHistory.trim(),
        familyHistory: newPatientForm.familyHistory.trim(),
        socialHistory: newPatientForm.socialHistory.trim(),
        currentSymptoms: newPatientForm.currentSymptoms.trim(),
        diagnosis: newPatientForm.diagnosis.trim(),
        notes: newPatientForm.notes.trim(),
      })
      setCurrentPatient(created)
      setNewPatientForm(createEmptyPatientForm())
      closeCreateModal()
    } catch (error) {
      setCreateError(error.message || 'Failed to create patient profile.')
    } finally {
      setCreatingPatient(false)
    }
  }

  const handleUpdatePatient = async (event) => {
    event.preventDefault()
    if (!currentPatient?.id) return

    if (!editPatientForm.name.trim()) {
      setEditError('Patient name is required.')
      return
    }

    const age = Number(editPatientForm.age)
    if (!Number.isFinite(age) || age < 1) {
      setEditError('Please enter a valid age.')
      return
    }

    setEditingPatient(true)
    setEditError(null)
    try {
      await updatePatientProfile(currentPatient.id, {
        name: editPatientForm.name.trim(),
        age,
        gender: editPatientForm.gender,
        phone: editPatientForm.phone.trim(),
        email: editPatientForm.email.trim(),
        address: editPatientForm.address.trim(),
        emergencyContactName: editPatientForm.emergencyContactName.trim(),
        emergencyContactPhone: editPatientForm.emergencyContactPhone.trim(),
        primaryPhysician: editPatientForm.primaryPhysician.trim(),
        insuranceProvider: editPatientForm.insuranceProvider.trim(),
        insurancePolicyNumber: editPatientForm.insurancePolicyNumber.trim(),
        heightCm: editPatientForm.heightCm,
        weightKg: editPatientForm.weightKg,
        bloodType: editPatientForm.bloodType.trim(),
        allergies: editPatientForm.allergies.trim(),
        medications: editPatientForm.medications.trim(),
        pastMedicalHistory: editPatientForm.pastMedicalHistory.trim(),
        surgicalHistory: editPatientForm.surgicalHistory.trim(),
        familyHistory: editPatientForm.familyHistory.trim(),
        socialHistory: editPatientForm.socialHistory.trim(),
        currentSymptoms: editPatientForm.currentSymptoms.trim(),
        diagnosis: editPatientForm.diagnosis.trim(),
        notes: editPatientForm.notes.trim(),
      })
      closeEditModal()
    } catch (error) {
      setEditError(error.message || 'Failed to update patient profile.')
    } finally {
      setEditingPatient(false)
    }
  }

  const handleDeletePatient = async () => {
    if (!currentPatient || deletingPatient) return

    const shouldDelete = window.confirm(
      'Delete this patient and all their assessment sessions? This cannot be undone.',
    )
    if (!shouldDelete) return

    setDeletingPatient(true)
    setAssessmentError(null)

    try {
      await removePatient(currentPatient.id)
      setAssessments([])
      setExpandedSessions({})
    } catch (error) {
      setAssessmentError(error.message || 'Failed to delete patient.')
    } finally {
      setDeletingPatient(false)
    }
  }

  const toggleSession = (sessionId) => {
    setExpandedSessions(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }))
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Navbar hideCta />

      <main className="flex-1">
        <div className="container py-8">
          <div className="mb-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="label-mono mb-2">Patient Registry</p>
                <h1
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(2rem, 4vw, 2.75rem)',
                    lineHeight: 1.1,
                  }}
                >
                  Unified Patient Profile
                </h1>
                <p
                  className="mt-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.9375rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Review patient trends across speech, clock drawing, and oculomotor sessions, including Brain Velocity.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={<UserPlus size={14} />}
                onClick={openCreateModal}
              >
                Add New Patient
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-[320px_1fr] gap-6">
            <aside
              className="rounded-xl overflow-hidden"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--divider)' }}>
                <p className="label-mono">Patients</p>
              </div>

              {patientsLoading ? (
                <div className="p-6 flex justify-center">
                  <Spinner size="md" />
                </div>
              ) : patientsError ? (
                <p
                  className="p-4"
                  style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--risk-critical)' }}
                >
                  {patientsError}
                </p>
              ) : (
                <ul className="max-h-[500px] overflow-y-auto">
                  {patients.map((patient) => (
                    <li
                      key={patient.id}
                      className="px-4 py-3 cursor-pointer transition-colors"
                      style={{
                        borderBottom: '1px solid var(--border-light)',
                        background:
                          currentPatient?.id === patient.id
                            ? 'var(--accent-glow)'
                            : 'transparent',
                      }}
                      onClick={() => setCurrentPatient(patient)}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex items-center justify-center rounded-full"
                          style={{
                            width: 30,
                            height: 30,
                            background: 'rgba(0,0,0,0.05)',
                          }}
                        >
                          <UserRound size={14} color="var(--text-secondary)" />
                        </span>
                        <div className="min-w-0">
                          <p
                            className="truncate"
                            style={{
                              fontFamily: 'var(--font-body)',
                              fontSize: '0.9rem',
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {patient.name}
                          </p>
                          <p
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.6875rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {patient.age}y · {patient.gender} · {patient.sessionCount || 0} sessions
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </aside>

            <section>
              {!currentPatient ? (
                <div
                  className="rounded-xl p-8 text-center"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>Select a patient</p>
                  <p
                    className="mt-2"
                    style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}
                  >
                    Choose a patient from the left panel to review longitudinal profile history.
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className="rounded-xl p-5 mb-4"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <p className="label-mono mb-1">Selected Patient</p>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', lineHeight: 1.1 }}>
                      {currentPatient.name}
                    </h2>
                    <p
                      className="mt-1"
                      style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}
                    >
                      ID: {currentPatient.id} · {currentPatient.age} years · {currentPatient.gender}
                    </p>

                    <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div
                        className="rounded-lg p-3"
                        style={{
                          background: 'rgba(196,168,79,0.12)',
                          border: '1px solid rgba(196,168,79,0.25)',
                        }}
                      >
                        <p className="label-mono">Latest Score</p>
                        <p
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '1.5rem',
                            color: latestSession ? riskColor(getRiskClass(latestSession.score)) : 'var(--text-muted)',
                          }}
                        >
                          {latestSession ? Math.round(latestSession.score) : '--'}
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {latestSession ? shortClassLabel(latestSession.classLabel) : 'No sessions'}
                        </p>
                      </div>

                      <div
                        className="rounded-lg p-3"
                        style={{
                          background: 'rgba(92,143,104,0.12)',
                          border: '1px solid rgba(92,143,104,0.25)',
                        }}
                      >
                        <p className="label-mono">Sessions</p>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>{sessions.length}</p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {speechCount} Speech · {cdtCount} CDT · {oculomotorCount} Oculomotor
                        </p>
                      </div>

                      <div
                        className="rounded-lg p-3"
                        style={{
                          background: 'rgba(0,0,0,0.03)',
                          border: '1px solid var(--border-light)',
                        }}
                      >
                        <p className="label-mono">Brain Velocity</p>
                        <p
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '1.5rem',
                            color:
                              brainVelocity === null
                                ? 'var(--text-muted)'
                                : Math.abs(brainVelocity) > 2
                                  ? 'var(--risk-critical)'
                                  : 'var(--text-primary)',
                          }}
                        >
                          {brainVelocity === null ? '--' : `${brainVelocity > 0 ? '+' : ''}${brainVelocity.toFixed(1)}`}
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          pts/month
                        </p>
                      </div>

                      <div
                        className="rounded-lg p-3"
                        style={{
                          background: 'rgba(0,0,0,0.03)',
                          border: '1px solid var(--border-light)',
                        }}
                      >
                        <p className="label-mono">First Session</p>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>
                          {firstSession ? formatDateShort(firstSession.date) : '--'}
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {firstSession ? formatDate(firstSession.date) : 'No data'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link to="/cdt">
                        <Button size="sm" icon={<PenLine size={14} />}>New CDT Assessment</Button>
                      </Link>
                      <Link to="/speech">
                        <Button variant="accent" size="sm" icon={<Mic size={14} />}>New Speech Assessment</Button>
                      </Link>
                      <Link to="/oculomotor">
                        <Button variant="ghost" size="sm" icon={<Eye size={14} />}>New Oculomotor Assessment</Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={openEditModal}
                      >
                        Edit Patient
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        onClick={handleDeletePatient}
                        loading={deletingPatient}
                      >
                        Delete Patient
                      </Button>
                    </div>
                  </div>

                  <div
                    className="rounded-xl p-5 mb-4"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="label-mono">Patient Intake</p>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.625rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Collected at registration
                      </span>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-4">
                      {intakeSections.map((section) => {
                        const hasRows = section.rows && section.rows.length > 0
                        const hasBlocks = section.blocks && section.blocks.length > 0
                        return (
                          <div
                            key={section.title}
                            className="rounded-lg p-3"
                            style={{
                              border: '1px solid var(--border-light)',
                              background: 'var(--canvas-bg)',
                            }}
                          >
                            <p className="label-mono mb-2">{section.title}</p>
                            {hasRows && section.rows.map((row) => (
                              <DetailRow key={`${section.title}-${row.label}`} label={row.label} value={row.value} />
                            ))}
                            {hasBlocks && section.blocks.map((block) => (
                              <DetailBlock key={`${section.title}-${block.label}`} label={block.label} value={block.value} />
                            ))}
                            {!hasRows && !hasBlocks && (
                              <p
                                style={{
                                  fontFamily: 'var(--font-body)',
                                  fontSize: '0.8125rem',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                No details added yet.
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div
                    className="rounded-xl overflow-hidden mb-4"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--divider)' }}>
                      <p className="label-mono">Brain Velocity Trend</p>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.625rem',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          padding: '3px 8px',
                          borderRadius: 999,
                          background:
                            velocityClass === 'critical'
                              ? 'rgba(176,64,64,0.15)'
                              : velocityClass === 'fast'
                                ? 'rgba(196,122,58,0.15)'
                                : velocityClass === 'slow'
                                  ? 'rgba(196,168,79,0.18)'
                                  : 'rgba(92,143,104,0.15)',
                          color:
                            velocityClass === 'critical'
                              ? 'var(--risk-critical)'
                              : velocityClass === 'fast'
                                ? 'var(--risk-high)'
                                : velocityClass === 'slow'
                                  ? 'var(--risk-medium)'
                                  : 'var(--risk-low)',
                        }}
                      >
                        {brainVelocity === null
                          ? 'Need 2+ sessions'
                          : `${brainVelocity > 0 ? '+' : ''}${brainVelocity.toFixed(2)} pts/month`}
                      </span>
                    </div>

                    <div className="p-4">
                      {datedSessions.length < 2 ? (
                        <div
                          className="rounded-lg p-6 text-center"
                          style={{
                            background: 'rgba(0,0,0,0.03)',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-body)',
                            fontSize: '0.875rem',
                          }}
                        >
                          Need at least 2 sessions to compute trajectory.
                        </div>
                      ) : (
                        <>
                          <canvas
                            ref={chartCanvasRef}
                            style={{ width: '100%', height: 170, borderRadius: 10, background: 'var(--canvas-bg)' }}
                            aria-label="Brain velocity chart"
                          />
                          <p
                            className="mt-2"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.6875rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            Brain Velocity is the slope of cognitive risk score over time. Values below -2.5 pts/month indicate rapid decline.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--divider)' }}>
                      <p className="label-mono">Assessment Timeline</p>
                    </div>

                    {loadingAssessments ? (
                      <div className="p-6 flex justify-center">
                        <Spinner size="md" />
                      </div>
                    ) : assessmentError ? (
                      <p
                        className="p-4"
                        style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--risk-critical)' }}
                      >
                        {assessmentError}
                      </p>
                    ) : sessionsDesc.length === 0 ? (
                      <div className="p-6 text-center">
                        <ClipboardList size={28} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
                        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}>
                          No assessments yet for this patient.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div
                          className="px-4 py-2"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(110px,1.1fr) 72px minmax(120px,1fr) minmax(140px,1.5fr) 32px',
                            gap: 10,
                            borderBottom: '1px solid var(--border-light)',
                          }}
                        >
                          <span className="label-mono">Date</span>
                          <span className="label-mono">Score</span>
                          <span className="label-mono">Class</span>
                          <span className="label-mono">Key Flags</span>
                          <span className="label-mono"> </span>
                        </div>

                        {sessionsDesc.map((session) => {
                          const classIdx = getRiskClass(Number(session.score || 0))
                          const color = riskColor(classIdx)
                          const open = !!expandedSessions[session.id]
                          const previewFlags = session.flags.slice(0, 2)

                          return (
                            <div key={session.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <button
                                type="button"
                                onClick={() => toggleSession(session.id)}
                                className="w-full px-4 py-3"
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'minmax(110px,1.1fr) 72px minmax(120px,1fr) minmax(140px,1.5fr) 32px',
                                  gap: 10,
                                  alignItems: 'center',
                                  textAlign: 'left',
                                  background: open ? 'rgba(0,0,0,0.02)' : 'transparent',
                                }}
                              >
                                <span
                                  style={{
                                    fontFamily: 'var(--font-body)',
                                    fontSize: '0.8125rem',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  {formatDate(session.date)}
                                </span>

                                <span
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.875rem',
                                    color,
                                    fontWeight: 700,
                                  }}
                                >
                                  {Math.round(Number(session.score || 0))}
                                </span>

                                <span
                                  style={{
                                    fontFamily: 'var(--font-body)',
                                    fontSize: '0.8125rem',
                                    color: 'var(--text-primary)',
                                  }}
                                >
                                  {shortClassLabel(session.classLabel)}
                                  <span
                                    style={{
                                      marginLeft: 6,
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '0.625rem',
                                      color: 'var(--text-muted)',
                                    }}
                                  >
                                    {session.type.toUpperCase()}
                                  </span>
                                </span>

                                <span className="flex flex-wrap gap-1" style={{ minHeight: 20 }}>
                                  {previewFlags.length === 0 ? (
                                    <span
                                      style={{
                                        fontFamily: 'var(--font-body)',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)',
                                      }}
                                    >
                                      No flags
                                    </span>
                                  ) : (
                                    previewFlags.map((flag) => (
                                      <span
                                        key={`${session.id}-${flag}`}
                                        style={{
                                          fontFamily: 'var(--font-body)',
                                          fontSize: '0.6875rem',
                                          padding: '2px 6px',
                                          borderRadius: 999,
                                          background: 'rgba(0,0,0,0.05)',
                                          color: 'var(--text-secondary)',
                                        }}
                                      >
                                        {String(flag).slice(0, 26)}
                                      </span>
                                    ))
                                  )}
                                </span>

                                <span
                                  style={{
                                    textAlign: 'center',
                                    color: 'var(--text-muted)',
                                    transform: open ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.2s',
                                  }}
                                >
                                  v
                                </span>
                              </button>

                              {open && (
                                <div
                                  className="px-4 pb-4"
                                  style={{
                                    background: 'rgba(0,0,0,0.015)',
                                  }}
                                >
                                  {session.type === 'speech' ? (
                                    <div className="grid md:grid-cols-3 gap-4">
                                      <div
                                        className="rounded-lg p-3"
                                        style={{
                                          border: '1px solid var(--border-light)',
                                          background: 'var(--bg-surface)',
                                        }}
                                      >
                                        <p className="label-mono mb-2">Acoustic</p>
                                        <DetailRow
                                          label="Speech Rate"
                                          value={`${Number(session.speech?.acoustic?.speech_rate_syllables_per_min || 0).toFixed(1)} syll/min`}
                                        />
                                        <DetailRow
                                          label="Pause Count"
                                          value={`${session.speech?.acoustic?.pause_count || 0}`}
                                        />
                                        <DetailRow
                                          label="Pause Ratio"
                                          value={`${(Number(session.speech?.acoustic?.pause_ratio || 0) * 100).toFixed(1)}%`}
                                        />
                                        <DetailRow
                                          label="F0 Mean"
                                          value={`${Number(session.speech?.acoustic?.f0_mean_hz || 0).toFixed(1)} Hz`}
                                        />
                                        <DetailRow
                                          label="Jitter"
                                          value={`${(Number(session.speech?.acoustic?.jitter || 0) * 100).toFixed(3)}%`}
                                        />
                                        <DetailRow
                                          label="Shimmer"
                                          value={`${(Number(session.speech?.acoustic?.shimmer || 0) * 100).toFixed(3)}%`}
                                        />
                                        <DetailRow
                                          label="HNR"
                                          value={`${Number(session.speech?.acoustic?.hnr_db || 0).toFixed(2)} dB`}
                                        />
                                      </div>

                                      <div
                                        className="rounded-lg p-3"
                                        style={{
                                          border: '1px solid var(--border-light)',
                                          background: 'var(--bg-surface)',
                                        }}
                                      >
                                        <p className="label-mono mb-2">Lexical</p>
                                        <DetailRow
                                          label="Language"
                                          value={String(session.speech?.lexico_semantic?.detected_language || 'unknown').toUpperCase()}
                                        />
                                        <DetailRow
                                          label="Word Count"
                                          value={`${session.speech?.lexico_semantic?.word_count || 0}`}
                                        />
                                        <DetailRow
                                          label="Unique Words"
                                          value={`${session.speech?.lexico_semantic?.unique_word_count || 0}`}
                                        />
                                        <DetailRow
                                          label="Type-Token"
                                          value={`${Number(session.speech?.lexico_semantic?.type_token_ratio || 0).toFixed(4)}`}
                                        />
                                        <DetailRow
                                          label="Filler Ratio"
                                          value={`${(Number(session.speech?.lexico_semantic?.filler_word_ratio || 0) * 100).toFixed(2)}%`}
                                        />

                                        <p
                                          className="mt-3"
                                          style={{
                                            fontFamily: 'var(--font-body)',
                                            fontSize: '0.75rem',
                                            color: 'var(--text-secondary)',
                                            lineHeight: 1.5,
                                          }}
                                        >
                                          {session.speech?.lexico_semantic?.transcript || 'No transcript available.'}
                                        </p>
                                      </div>

                                      <div
                                        className="rounded-lg p-3"
                                        style={{
                                          border: '1px solid var(--border-light)',
                                          background: 'var(--bg-surface)',
                                        }}
                                      >
                                        <p className="label-mono mb-2">Flags</p>
                                        {session.flags.length === 0 ? (
                                          <p
                                            style={{
                                              fontFamily: 'var(--font-body)',
                                              fontSize: '0.8125rem',
                                              color: 'var(--risk-low)',
                                            }}
                                          >
                                            No major flags.
                                          </p>
                                        ) : (
                                          <ul className="space-y-1.5">
                                            {session.flags.map(flag => (
                                              <li
                                                key={`${session.id}-${flag}`}
                                                style={{
                                                  fontFamily: 'var(--font-body)',
                                                  fontSize: '0.8125rem',
                                                  color: 'var(--text-secondary)',
                                                }}
                                              >
                                                {flag}
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    </div>
                                  ) : session.type === 'oculomotor' ? (
                                    <div className="grid md:grid-cols-2 gap-4">
                                      <div
                                        className="rounded-lg p-3"
                                        style={{
                                          border: '1px solid var(--border-light)',
                                          background: 'var(--bg-surface)',
                                        }}
                                      >
                                        <p className="label-mono mb-2">Oculomotor Metrics</p>
                                        <DetailRow
                                          label="Trial Count"
                                          value={`${session.oculomotor?.trial_count ?? '--'}`}
                                        />
                                        <DetailRow
                                          label="Antisaccade Errors"
                                          value={`${session.oculomotor?.antisaccade_errors ?? '--'}`}
                                        />
                                        <DetailRow
                                          label="Error Rate"
                                          value={`${Number(session.oculomotor?.error_rate_percent || 0).toFixed(2)}%`}
                                        />
                                        <DetailRow
                                          label="Avg Latency"
                                          value={`${Number(session.oculomotor?.avg_latency_ms || 0).toFixed(1)} ms`}
                                        />
                                        <DetailRow
                                          label="Fixation RMSD"
                                          value={`${Number(session.oculomotor?.fixation_rmsd || 0).toFixed(4)}`}
                                        />
                                        <DetailRow
                                          label="Pursuit Gain"
                                          value={
                                            session.oculomotor?.pursuit_gain == null
                                              ? 'N/A'
                                              : Number(session.oculomotor?.pursuit_gain).toFixed(3)
                                          }
                                        />
                                      </div>

                                      <div
                                        className="rounded-lg p-3"
                                        style={{
                                          border: '1px solid var(--border-light)',
                                          background: 'var(--bg-surface)',
                                        }}
                                      >
                                        <p className="label-mono mb-2">Oculomotor Risk Detail</p>
                                        <DetailRow
                                          label="Risk Score"
                                          value={`${Math.round(Number(session.score || 0))}`}
                                        />
                                        <DetailRow
                                          label="Risk Label"
                                          value={session.classLabel}
                                        />
                                        <DetailRow
                                          label="Clinical Risk"
                                          value={session.oculomotor?.clinical_risk || 'Unknown'}
                                        />

                                        {session.flags.length > 0 && (
                                          <ul className="mt-2 space-y-1.5">
                                            {session.flags.map(flag => (
                                              <li
                                                key={`${session.id}-${flag}`}
                                                style={{
                                                  fontFamily: 'var(--font-body)',
                                                  fontSize: '0.8125rem',
                                                  color: 'var(--text-secondary)',
                                                }}
                                              >
                                                {flag}
                                              </li>
                                            ))}
                                          </ul>
                                        )}

                                        {session.raw?.recommendation && (
                                          <p
                                            className="mt-3"
                                            style={{
                                              fontFamily: 'var(--font-body)',
                                              fontSize: '0.8125rem',
                                              color: 'var(--text-secondary)',
                                              lineHeight: 1.5,
                                            }}
                                          >
                                            {session.raw.recommendation}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="grid md:grid-cols-2 gap-4">
                                      <div
                                        className="rounded-lg p-3"
                                        style={{
                                          border: '1px solid var(--border-light)',
                                          background: 'var(--bg-surface)',
                                        }}
                                      >
                                        <p className="label-mono mb-2">CDT Dynamics</p>
                                        <DetailRow
                                          label="Stroke Count"
                                          value={`${session.features?.strokeCount ?? '--'}`}
                                        />
                                        <DetailRow
                                          label="Revision Count"
                                          value={`${session.features?.revisionCount ?? '--'}`}
                                        />
                                        <DetailRow
                                          label="Mean Velocity"
                                          value={`${Number(session.features?.meanStrokeVelocity ?? session.features?.meanVelocity ?? 0).toFixed(2)}`}
                                        />
                                        <DetailRow
                                          label="Pause Count"
                                          value={`${session.features?.pauseCount ?? '--'}`}
                                        />
                                        <DetailRow
                                          label="Total Duration"
                                          value={`${Math.round(Number(
                                            session.features?.totalDurationSec
                                              ?? ((session.features?.totalDurationMs || 0) / 1000)
                                          ))} sec`}
                                        />
                                      </div>

                                      <div
                                        className="rounded-lg p-3"
                                        style={{
                                          border: '1px solid var(--border-light)',
                                          background: 'var(--bg-surface)',
                                        }}
                                      >
                                        <p className="label-mono mb-2">CDT Risk Detail</p>
                                        <DetailRow
                                          label="Risk Score"
                                          value={`${Math.round(Number(session.score || 0))}`}
                                        />
                                        <DetailRow
                                          label="Risk Label"
                                          value={session.classLabel}
                                        />

                                        {session.flags.length > 0 && (
                                          <ul className="mt-2 space-y-1.5">
                                            {session.flags.map(flag => (
                                              <li
                                                key={`${session.id}-${flag}`}
                                                style={{
                                                  fontFamily: 'var(--font-body)',
                                                  fontSize: '0.8125rem',
                                                  color: 'var(--text-secondary)',
                                                }}
                                              >
                                                {flag}
                                              </li>
                                            ))}
                                          </ul>
                                        )}

                                        <div className="mt-3">
                                          <Link to={`/cdt/result/${session.id}`}>
                                            <Button size="sm" variant="ghost">Open CDT Result</Button>
                                          </Link>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </main>

      {showCreateModal && (
        <div
          className="fixed inset-0 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.48)', zIndex: 60 }}
        >
          <form
            className="w-full max-w-md rounded-xl p-6"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-elevated)',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onSubmit={handleCreatePatient}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="label-mono">Create Patient</p>
              <button
                type="button"
                onClick={closeCreateModal}
                aria-label="Close create patient modal"
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label-mono mb-1 block">Full Name</label>
                <input
                  type="text"
                  value={newPatientForm.name}
                  onChange={(event) => updateFormField('name', event.target.value)}
                  placeholder="Enter patient name"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-mono mb-1 block">Age</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={newPatientForm.age}
                    onChange={(event) => updateFormField('age', event.target.value)}
                    placeholder="Age"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div>
                  <label className="label-mono mb-1 block">Gender</label>
                  <select
                    value={newPatientForm.gender}
                    onChange={(event) => updateFormField('gender', event.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label-mono mb-1 block">Phone (optional)</label>
                <input
                  type="text"
                  value={newPatientForm.phone}
                  onChange={(event) => updateFormField('phone', event.target.value)}
                  placeholder="Phone number"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Email (optional)</label>
                <input
                  type="email"
                  value={newPatientForm.email}
                  onChange={(event) => updateFormField('email', event.target.value)}
                  placeholder="Email address"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Address (optional)</label>
                <textarea
                  value={newPatientForm.address}
                  onChange={(event) => updateFormField('address', event.target.value)}
                  placeholder="Street, city, state, postal code"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <p className="label-mono mt-2">Emergency Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-mono mb-1 block">Contact Name</label>
                  <input
                    type="text"
                    value={newPatientForm.emergencyContactName}
                    onChange={(event) => updateFormField('emergencyContactName', event.target.value)}
                    placeholder="Full name"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div>
                  <label className="label-mono mb-1 block">Contact Phone</label>
                  <input
                    type="text"
                    value={newPatientForm.emergencyContactPhone}
                    onChange={(event) => updateFormField('emergencyContactPhone', event.target.value)}
                    placeholder="Phone number"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>
              </div>

              <p className="label-mono mt-2">Care Team</p>
              <div>
                <label className="label-mono mb-1 block">Primary Physician (optional)</label>
                <input
                  type="text"
                  value={newPatientForm.primaryPhysician}
                  onChange={(event) => updateFormField('primaryPhysician', event.target.value)}
                  placeholder="Physician or clinic"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <p className="label-mono mt-2">Insurance</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-mono mb-1 block">Provider (optional)</label>
                  <input
                    type="text"
                    value={newPatientForm.insuranceProvider}
                    onChange={(event) => updateFormField('insuranceProvider', event.target.value)}
                    placeholder="Provider name"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div>
                  <label className="label-mono mb-1 block">Policy Number (optional)</label>
                  <input
                    type="text"
                    value={newPatientForm.insurancePolicyNumber}
                    onChange={(event) => updateFormField('insurancePolicyNumber', event.target.value)}
                    placeholder="Policy or member ID"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>
              </div>

              <p className="label-mono mt-2">Vitals</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label-mono mb-1 block">Height (cm)</label>
                  <input
                    type="number"
                    min="0"
                    value={newPatientForm.heightCm}
                    onChange={(event) => updateFormField('heightCm', event.target.value)}
                    placeholder="Height"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div>
                  <label className="label-mono mb-1 block">Weight (kg)</label>
                  <input
                    type="number"
                    min="0"
                    value={newPatientForm.weightKg}
                    onChange={(event) => updateFormField('weightKg', event.target.value)}
                    placeholder="Weight"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div>
                  <label className="label-mono mb-1 block">Blood Type</label>
                  <input
                    type="text"
                    value={newPatientForm.bloodType}
                    onChange={(event) => updateFormField('bloodType', event.target.value)}
                    placeholder="A+, O-, etc"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>
              </div>

              <p className="label-mono mt-2">Medical History</p>
              <div>
                <label className="label-mono mb-1 block">Allergies (optional)</label>
                <textarea
                  value={newPatientForm.allergies}
                  onChange={(event) => updateFormField('allergies', event.target.value)}
                  placeholder="List known allergies"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Current Medications (optional)</label>
                <textarea
                  value={newPatientForm.medications}
                  onChange={(event) => updateFormField('medications', event.target.value)}
                  placeholder="Medication name, dose, and frequency"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Past Medical History (optional)</label>
                <textarea
                  value={newPatientForm.pastMedicalHistory}
                  onChange={(event) => updateFormField('pastMedicalHistory', event.target.value)}
                  placeholder="Chronic conditions, prior diagnoses"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Surgical History (optional)</label>
                <textarea
                  value={newPatientForm.surgicalHistory}
                  onChange={(event) => updateFormField('surgicalHistory', event.target.value)}
                  placeholder="Surgeries and approximate dates"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Family History (optional)</label>
                <textarea
                  value={newPatientForm.familyHistory}
                  onChange={(event) => updateFormField('familyHistory', event.target.value)}
                  placeholder="Neurologic, cognitive, or chronic conditions"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Social History (optional)</label>
                <textarea
                  value={newPatientForm.socialHistory}
                  onChange={(event) => updateFormField('socialHistory', event.target.value)}
                  placeholder="Smoking, alcohol, lifestyle factors"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <p className="label-mono mt-2">Current Presentation</p>
              <div>
                <label className="label-mono mb-1 block">Current Symptoms / Chief Complaint (optional)</label>
                <textarea
                  value={newPatientForm.currentSymptoms}
                  onChange={(event) => updateFormField('currentSymptoms', event.target.value)}
                  placeholder="Main symptoms or reason for visit"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Working Diagnosis (optional)</label>
                <textarea
                  value={newPatientForm.diagnosis}
                  onChange={(event) => updateFormField('diagnosis', event.target.value)}
                  placeholder="Provisional or confirmed diagnosis"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Notes (optional)</label>
                <textarea
                  value={newPatientForm.notes}
                  onChange={(event) => updateFormField('notes', event.target.value)}
                  placeholder="Clinical notes"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            {createError && (
              <p
                className="mt-3"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  color: 'var(--risk-critical)',
                }}
              >
                {createError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={closeCreateModal}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={creatingPatient}>
                Create Patient
              </Button>
            </div>
          </form>
        </div>
      )}

      {showEditModal && (
        <div
          className="fixed inset-0 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.48)', zIndex: 60 }}
        >
          <form
            className="w-full max-w-md rounded-xl p-6"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-elevated)',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onSubmit={handleUpdatePatient}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="label-mono">Edit Patient</p>
              <button
                type="button"
                onClick={closeEditModal}
                aria-label="Close edit patient modal"
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label-mono mb-1 block">Full Name</label>
                <input
                  type="text"
                  value={editPatientForm.name}
                  onChange={(event) => updateEditField('name', event.target.value)}
                  placeholder="Enter patient name"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-mono mb-1 block">Age</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={editPatientForm.age}
                    onChange={(event) => updateEditField('age', event.target.value)}
                    placeholder="Age"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div>
                  <label className="label-mono mb-1 block">Gender</label>
                  <select
                    value={editPatientForm.gender}
                    onChange={(event) => updateEditField('gender', event.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label-mono mb-1 block">Phone (optional)</label>
                <input
                  type="text"
                  value={editPatientForm.phone}
                  onChange={(event) => updateEditField('phone', event.target.value)}
                  placeholder="Phone number"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Email (optional)</label>
                <input
                  type="email"
                  value={editPatientForm.email}
                  onChange={(event) => updateEditField('email', event.target.value)}
                  placeholder="Email address"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Address (optional)</label>
                <textarea
                  value={editPatientForm.address}
                  onChange={(event) => updateEditField('address', event.target.value)}
                  placeholder="Street, city, state, postal code"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <p className="label-mono mt-2">Emergency Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-mono mb-1 block">Contact Name</label>
                  <input
                    type="text"
                    value={editPatientForm.emergencyContactName}
                    onChange={(event) => updateEditField('emergencyContactName', event.target.value)}
                    placeholder="Full name"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div>
                  <label className="label-mono mb-1 block">Contact Phone</label>
                  <input
                    type="text"
                    value={editPatientForm.emergencyContactPhone}
                    onChange={(event) => updateEditField('emergencyContactPhone', event.target.value)}
                    placeholder="Phone number"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>
              </div>

              <p className="label-mono mt-2">Care Team</p>
              <div>
                <label className="label-mono mb-1 block">Primary Physician (optional)</label>
                <input
                  type="text"
                  value={editPatientForm.primaryPhysician}
                  onChange={(event) => updateEditField('primaryPhysician', event.target.value)}
                  placeholder="Physician or clinic"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <p className="label-mono mt-2">Insurance</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-mono mb-1 block">Provider (optional)</label>
                  <input
                    type="text"
                    value={editPatientForm.insuranceProvider}
                    onChange={(event) => updateEditField('insuranceProvider', event.target.value)}
                    placeholder="Provider name"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div>
                  <label className="label-mono mb-1 block">Policy Number (optional)</label>
                  <input
                    type="text"
                    value={editPatientForm.insurancePolicyNumber}
                    onChange={(event) => updateEditField('insurancePolicyNumber', event.target.value)}
                    placeholder="Policy or member ID"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>
              </div>

              <p className="label-mono mt-2">Vitals</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label-mono mb-1 block">Height (cm)</label>
                  <input
                    type="number"
                    min="0"
                    value={editPatientForm.heightCm}
                    onChange={(event) => updateEditField('heightCm', event.target.value)}
                    placeholder="Height"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div>
                  <label className="label-mono mb-1 block">Weight (kg)</label>
                  <input
                    type="number"
                    min="0"
                    value={editPatientForm.weightKg}
                    onChange={(event) => updateEditField('weightKg', event.target.value)}
                    placeholder="Weight"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div>
                  <label className="label-mono mb-1 block">Blood Type</label>
                  <input
                    type="text"
                    value={editPatientForm.bloodType}
                    onChange={(event) => updateEditField('bloodType', event.target.value)}
                    placeholder="A+, O-, etc"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>
              </div>

              <p className="label-mono mt-2">Medical History</p>
              <div>
                <label className="label-mono mb-1 block">Allergies (optional)</label>
                <textarea
                  value={editPatientForm.allergies}
                  onChange={(event) => updateEditField('allergies', event.target.value)}
                  placeholder="List known allergies"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Current Medications (optional)</label>
                <textarea
                  value={editPatientForm.medications}
                  onChange={(event) => updateEditField('medications', event.target.value)}
                  placeholder="Medication name, dose, and frequency"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Past Medical History (optional)</label>
                <textarea
                  value={editPatientForm.pastMedicalHistory}
                  onChange={(event) => updateEditField('pastMedicalHistory', event.target.value)}
                  placeholder="Chronic conditions, prior diagnoses"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Surgical History (optional)</label>
                <textarea
                  value={editPatientForm.surgicalHistory}
                  onChange={(event) => updateEditField('surgicalHistory', event.target.value)}
                  placeholder="Surgeries and approximate dates"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Family History (optional)</label>
                <textarea
                  value={editPatientForm.familyHistory}
                  onChange={(event) => updateEditField('familyHistory', event.target.value)}
                  placeholder="Neurologic, cognitive, or chronic conditions"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Social History (optional)</label>
                <textarea
                  value={editPatientForm.socialHistory}
                  onChange={(event) => updateEditField('socialHistory', event.target.value)}
                  placeholder="Smoking, alcohol, lifestyle factors"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <p className="label-mono mt-2">Current Presentation</p>
              <div>
                <label className="label-mono mb-1 block">Current Symptoms / Chief Complaint (optional)</label>
                <textarea
                  value={editPatientForm.currentSymptoms}
                  onChange={(event) => updateEditField('currentSymptoms', event.target.value)}
                  placeholder="Main symptoms or reason for visit"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Working Diagnosis (optional)</label>
                <textarea
                  value={editPatientForm.diagnosis}
                  onChange={(event) => updateEditField('diagnosis', event.target.value)}
                  placeholder="Provisional or confirmed diagnosis"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label-mono mb-1 block">Notes (optional)</label>
                <textarea
                  value={editPatientForm.notes}
                  onChange={(event) => updateEditField('notes', event.target.value)}
                  placeholder="Clinical notes"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            {editError && (
              <p
                className="mt-3"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  color: 'var(--risk-critical)',
                }}
              >
                {editError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={closeEditModal}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={editingPatient}>
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      )}

      <Footer />
    </div>
  )
}
