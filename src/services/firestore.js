/**
 * src/services/firestore.js
 *
 * Firestore data access layer.
 * Currently uses in-memory mock data. Swap with real Firestore SDK calls
 * once Firebase config is available.
 */
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore'
import { db, firebaseInitError } from './firebase'

import { v4 as uuidv4 } from 'uuid'
import { IS_MOCK } from './firebase'

const USE_MOCK = IS_MOCK || !db

if (!IS_MOCK && !db) {
  console.warn('[Firestore] Firebase is unavailable. Using mock data until Firebase config is fixed.', firebaseInitError)
}

// ── Mock Patient Data ────────────────────────────────────────────────────────

const MOCK_PATIENTS = [
  {
    id: 'P-MNDCK2A3',
    name: 'Seema Nair',
    age: 72,
    gender: 'Female',
    phone: '+91 98765 43210',
    createdAt: new Date('2024-10-15'),
    sessionCount: 6,
  },
  {
    id: 'P-KRTBJ9F1',
    name: 'Ramesh Kulkarni',
    age: 68,
    gender: 'Male',
    phone: '+91 87654 32109',
    createdAt: new Date('2024-11-02'),
    sessionCount: 3,
  },
  {
    id: 'P-VBHND5X7',
    name: 'Anita Desai',
    age: 65,
    gender: 'Female',
    phone: '+91 76543 21098',
    createdAt: new Date('2025-01-18'),
    sessionCount: 2,
  },
  {
    id: 'P-LJMQR8T4',
    name: 'Suresh Iyer',
    age: 78,
    gender: 'Male',
    phone: '+91 65432 10987',
    createdAt: new Date('2025-02-07'),
    sessionCount: 4,
  },
]

// In-memory assessment store (persists for session lifetime)
let mockAssessments = []

/**
 * Simulate async Firestore latency
 */
const delay = (ms = 400) => new Promise(r => setTimeout(r, ms))

function toDate(value) {
  if (!value) return new Date()
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') return value.toDate()
  return new Date(value)
}

function toNullableDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null
  if (typeof value?.toDate === 'function') {
    const converted = value.toDate()
    return converted instanceof Date && Number.isFinite(converted.getTime()) ? converted : null
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const millis = (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000)
    const converted = new Date(millis)
    return Number.isFinite(converted.getTime()) ? converted : null
  }
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function toFiniteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizePatientRecord(record, fallbackId = '') {
  const normalizedCreatedAt = toNullableDate(record?.createdAt) || new Date()
  return {
    ...record,
    id: record?.id || fallbackId,
    name: String(record?.name || 'Unknown Patient').trim(),
    age: Math.max(0, toFiniteNumber(record?.age, 0)),
    gender: String(record?.gender || 'Other'),
    phone: typeof record?.phone === 'string' ? record.phone.trim() : '',
    email: typeof record?.email === 'string' ? record.email.trim() : '',
    address: typeof record?.address === 'string' ? record.address.trim() : '',
    emergencyContactName: typeof record?.emergencyContactName === 'string' ? record.emergencyContactName.trim() : '',
    emergencyContactPhone: typeof record?.emergencyContactPhone === 'string' ? record.emergencyContactPhone.trim() : '',
    primaryPhysician: typeof record?.primaryPhysician === 'string' ? record.primaryPhysician.trim() : '',
    insuranceProvider: typeof record?.insuranceProvider === 'string' ? record.insuranceProvider.trim() : '',
    insurancePolicyNumber: typeof record?.insurancePolicyNumber === 'string' ? record.insurancePolicyNumber.trim() : '',
    heightCm: toFiniteNumber(record?.heightCm, null),
    weightKg: toFiniteNumber(record?.weightKg, null),
    bloodType: typeof record?.bloodType === 'string' ? record.bloodType.trim() : '',
    allergies: typeof record?.allergies === 'string' ? record.allergies.trim() : '',
    medications: typeof record?.medications === 'string' ? record.medications.trim() : '',
    pastMedicalHistory: typeof record?.pastMedicalHistory === 'string' ? record.pastMedicalHistory.trim() : '',
    surgicalHistory: typeof record?.surgicalHistory === 'string' ? record.surgicalHistory.trim() : '',
    familyHistory: typeof record?.familyHistory === 'string' ? record.familyHistory.trim() : '',
    socialHistory: typeof record?.socialHistory === 'string' ? record.socialHistory.trim() : '',
    currentSymptoms: typeof record?.currentSymptoms === 'string' ? record.currentSymptoms.trim() : '',
    diagnosis: typeof record?.diagnosis === 'string' ? record.diagnosis.trim() : '',
    notes: typeof record?.notes === 'string' ? record.notes.trim() : '',
    createdAt: normalizedCreatedAt,
    sessionCount: Math.max(0, toFiniteNumber(record?.sessionCount, 0)),
    modelVersion: 'patient.v1',
  }
}

function normalizeAssessmentRecord(record, fallback = {}) {
  const inferredType = record?.type === 'speech'
    ? 'speech'
    : record?.type === 'cdt'
      ? 'cdt'
      : record?.type === 'oculomotor'
        ? 'oculomotor'
      : record?.speech
        ? 'speech'
        : record?.oculomotor
          ? 'oculomotor'
          : record?.oculomotorRiskScore !== undefined && record?.oculomotorRiskScore !== null
            ? 'oculomotor'
        : 'cdt'

  const submitTimestamp = toNullableDate(record?.submitTimestamp)
  const clientSubmitTimestamp = toNullableDate(record?.clientSubmitTimestamp) || submitTimestamp
  const startTimestamp = toNullableDate(record?.startTimestamp) || clientSubmitTimestamp || submitTimestamp
  const createdAt = toNullableDate(record?.createdAt) || clientSubmitTimestamp || startTimestamp || new Date()
  const normalizedDate = typeof record?.date === 'string' && record.date.trim()
    ? record.date
    : (clientSubmitTimestamp || submitTimestamp || createdAt).toISOString()

  const speechRiskScore = toFiniteNumber(record?.speechRiskScore, null)
  const cdtRiskScore = toFiniteNumber(record?.cdtRiskScore, null)
  const oculomotorRiskScore = toFiniteNumber(record?.oculomotorRiskScore, null)

  return {
    ...record,
    id: record?.id || fallback.id || '',
    patientId: record?.patientId || fallback.patientId || '',
    type: inferredType,
    administeredBy: typeof record?.administeredBy === 'string' ? record.administeredBy : 'GP_MOCK',
    source: typeof record?.source === 'string' ? record.source : 'upload',
    language: typeof record?.language === 'string' ? record.language : 'auto',
    date: normalizedDate,
    startTimestamp: startTimestamp || createdAt,
    clientSubmitTimestamp: clientSubmitTimestamp || startTimestamp || createdAt,
    submitTimestamp: submitTimestamp || clientSubmitTimestamp || startTimestamp || createdAt,
    createdAt,
    flags: Array.isArray(record?.flags) ? record.flags : [],
    recommendation: typeof record?.recommendation === 'string' ? record.recommendation : '',
    speech: record?.speech && typeof record.speech === 'object' ? record.speech : null,
    oculomotor: record?.oculomotor && typeof record.oculomotor === 'object' ? record.oculomotor : null,
    speechRiskScore:
      speechRiskScore ?? toFiniteNumber(record?.speech?.risk_score, inferredType === 'speech' ? 0 : null),
    speechRiskClass:
      typeof record?.speechRiskClass === 'string'
        ? record.speechRiskClass
        : typeof record?.speech?.risk_class === 'string'
          ? record.speech.risk_class
          : null,
    cdtRiskScore,
    oculomotorRiskScore:
      oculomotorRiskScore ?? toFiniteNumber(record?.oculomotor?.risk_score, inferredType === 'oculomotor' ? 0 : null),
    riskLabel: typeof record?.riskLabel === 'string' ? record.riskLabel : null,
    features: record?.features && typeof record.features === 'object' ? record.features : {},
    audioFileName: typeof record?.audioFileName === 'string' ? record.audioFileName : null,
    modelVersion: 'assessment.v1',
  }
}

function buildPatientBackfill(raw, normalized) {
  const patch = {}
  if (typeof raw?.name !== 'string' || !raw.name.trim()) patch.name = normalized.name
  if (!Number.isFinite(Number(raw?.age))) patch.age = normalized.age
  if (typeof raw?.gender !== 'string' || !raw.gender.trim()) patch.gender = normalized.gender
  if (typeof raw?.phone !== 'string') patch.phone = normalized.phone
  if (typeof raw?.email !== 'string') patch.email = normalized.email
  if (typeof raw?.address !== 'string') patch.address = normalized.address
  if (typeof raw?.emergencyContactName !== 'string') patch.emergencyContactName = normalized.emergencyContactName
  if (typeof raw?.emergencyContactPhone !== 'string') patch.emergencyContactPhone = normalized.emergencyContactPhone
  if (typeof raw?.primaryPhysician !== 'string') patch.primaryPhysician = normalized.primaryPhysician
  if (typeof raw?.insuranceProvider !== 'string') patch.insuranceProvider = normalized.insuranceProvider
  if (typeof raw?.insurancePolicyNumber !== 'string') patch.insurancePolicyNumber = normalized.insurancePolicyNumber
  if (raw?.heightCm !== normalized.heightCm) patch.heightCm = normalized.heightCm
  if (raw?.weightKg !== normalized.weightKg) patch.weightKg = normalized.weightKg
  if (typeof raw?.bloodType !== 'string') patch.bloodType = normalized.bloodType
  if (typeof raw?.allergies !== 'string') patch.allergies = normalized.allergies
  if (typeof raw?.medications !== 'string') patch.medications = normalized.medications
  if (typeof raw?.pastMedicalHistory !== 'string') patch.pastMedicalHistory = normalized.pastMedicalHistory
  if (typeof raw?.surgicalHistory !== 'string') patch.surgicalHistory = normalized.surgicalHistory
  if (typeof raw?.familyHistory !== 'string') patch.familyHistory = normalized.familyHistory
  if (typeof raw?.socialHistory !== 'string') patch.socialHistory = normalized.socialHistory
  if (typeof raw?.currentSymptoms !== 'string') patch.currentSymptoms = normalized.currentSymptoms
  if (typeof raw?.diagnosis !== 'string') patch.diagnosis = normalized.diagnosis
  if (typeof raw?.notes !== 'string') patch.notes = normalized.notes
  if (!Number.isFinite(Number(raw?.sessionCount))) patch.sessionCount = normalized.sessionCount
  if (raw?.modelVersion !== 'patient.v1') patch.modelVersion = 'patient.v1'
  if (!toNullableDate(raw?.createdAt)) patch.createdAt = normalized.createdAt
  return patch
}

function buildAssessmentBackfill(raw, normalized) {
  const patch = {}
  if (raw?.modelVersion !== 'assessment.v1') patch.modelVersion = 'assessment.v1'
  if (!raw?.type) patch.type = normalized.type
  if (typeof raw?.administeredBy !== 'string') patch.administeredBy = normalized.administeredBy
  if (typeof raw?.source !== 'string') patch.source = normalized.source
  if (typeof raw?.language !== 'string') patch.language = normalized.language
  if (typeof raw?.date !== 'string' || !raw.date.trim()) patch.date = normalized.date
  if (!toNullableDate(raw?.startTimestamp)) patch.startTimestamp = normalized.startTimestamp
  if (!toNullableDate(raw?.clientSubmitTimestamp)) patch.clientSubmitTimestamp = normalized.clientSubmitTimestamp
  if (!toNullableDate(raw?.submitTimestamp)) patch.submitTimestamp = normalized.submitTimestamp
  if (!toNullableDate(raw?.createdAt)) patch.createdAt = normalized.createdAt
  if (!Array.isArray(raw?.flags)) patch.flags = normalized.flags
  if (typeof raw?.recommendation !== 'string') patch.recommendation = normalized.recommendation
  if (!raw?.features || typeof raw.features !== 'object') patch.features = normalized.features
  return patch
}

// ── API Functions ─────────────────────────────────────────────────────────────

/**
 * Fetch all patients from Firestore (or mock).
 * @returns {Promise<Patient[]>}
 */
export async function getPatients() {
  if (USE_MOCK) {
    await delay(600)
    return MOCK_PATIENTS.map((patient) => normalizePatientRecord(patient, patient.id))
  }
  const snap = await getDocs(collection(db, 'patients'))
  return snap.docs.map((d) => {
    const raw = d.data() || {}
    const normalized = normalizePatientRecord({ id: d.id, ...raw }, d.id)
    const patch = buildPatientBackfill(raw, normalized)
    if (Object.keys(patch).length > 0) {
      updateDoc(d.ref, patch).catch(() => {
        // keep reads resilient even if backfill fails
      })
    }
    return normalized
  })
}

/**
 * Fetch a single patient by ID.
 * @param {string} patientId
 * @returns {Promise<Patient|null>}
 */
export async function getPatient(patientId) {
  if (USE_MOCK) {
    await delay(300)
    const found = MOCK_PATIENTS.find(p => p.id === patientId)
    return found ? normalizePatientRecord(found, found.id) : null
  }
  const snap = await getDoc(doc(db, 'patients', patientId))
  if (!snap.exists()) return null
  const raw = snap.data() || {}
  const normalized = normalizePatientRecord({ id: snap.id, ...raw }, snap.id)
  const patch = buildPatientBackfill(raw, normalized)
  if (Object.keys(patch).length > 0) {
    updateDoc(doc(db, 'patients', patientId), patch).catch(() => {
      // keep reads resilient even if backfill fails
    })
  }
  return normalized
}

/**
 * Create a new patient profile.
 * @param {{name: string, age: number, gender: string, phone?: string, email?: string, address?: string, emergencyContactName?: string, emergencyContactPhone?: string, primaryPhysician?: string, insuranceProvider?: string, insurancePolicyNumber?: string, heightCm?: number, weightKg?: number, bloodType?: string, allergies?: string, medications?: string, pastMedicalHistory?: string, surgicalHistory?: string, familyHistory?: string, socialHistory?: string, currentSymptoms?: string, diagnosis?: string, notes?: string}} patient
 * @returns {Promise<Patient>}
 */
export async function addPatient(patient) {
  const payload = normalizePatientRecord({
    name: (patient.name || '').trim(),
    age: Number(patient.age) || 0,
    gender: patient.gender || 'Other',
    phone: (patient.phone || '').trim(),
    email: (patient.email || '').trim(),
    address: (patient.address || '').trim(),
    emergencyContactName: (patient.emergencyContactName || '').trim(),
    emergencyContactPhone: (patient.emergencyContactPhone || '').trim(),
    primaryPhysician: (patient.primaryPhysician || '').trim(),
    insuranceProvider: (patient.insuranceProvider || '').trim(),
    insurancePolicyNumber: (patient.insurancePolicyNumber || '').trim(),
    heightCm: patient.heightCm,
    weightKg: patient.weightKg,
    bloodType: (patient.bloodType || '').trim(),
    allergies: (patient.allergies || '').trim(),
    medications: (patient.medications || '').trim(),
    pastMedicalHistory: (patient.pastMedicalHistory || '').trim(),
    surgicalHistory: (patient.surgicalHistory || '').trim(),
    familyHistory: (patient.familyHistory || '').trim(),
    socialHistory: (patient.socialHistory || '').trim(),
    currentSymptoms: (patient.currentSymptoms || '').trim(),
    diagnosis: (patient.diagnosis || '').trim(),
    notes: (patient.notes || '').trim(),
    createdAt: new Date(),
    sessionCount: 0,
  })
  const { id: _ignoredId, ...patientPayload } = payload

  if (USE_MOCK) {
    await delay(500)
    const id = `P-${uuidv4().slice(0, 8).toUpperCase()}`
    const newPatient = normalizePatientRecord({ ...patientPayload, id }, id)
    MOCK_PATIENTS.unshift(newPatient)
    return newPatient
  }

  const ref = await addDoc(collection(db, 'patients'), {
    ...patientPayload,
    createdAt: serverTimestamp(),
  })

  return normalizePatientRecord({ ...patientPayload, id: ref.id }, ref.id)
}

/**
 * Delete a patient profile and all associated assessments.
 * @param {string} patientId
 */
export async function deletePatientById(patientId) {
  if (USE_MOCK) {
    await delay(300)

    const patientIndex = MOCK_PATIENTS.findIndex(p => p.id === patientId)
    if (patientIndex !== -1) {
      MOCK_PATIENTS.splice(patientIndex, 1)
    }

    mockAssessments = mockAssessments.filter(a => a.patientId !== patientId)
    return
  }

  const assessmentsRef = collection(db, 'patients', patientId, 'assessments')
  const snap = await getDocs(assessmentsRef)
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'patients', patientId))
}

/**
 * Update a patient profile.
 * @param {string} patientId
 * @param {object} patientPatch
 * @returns {Promise<Patient>}
 */
export async function updatePatient(patientId, patientPatch) {
  const normalized = normalizePatientRecord({
    id: patientId,
    name: (patientPatch?.name || '').trim(),
    age: Number(patientPatch?.age) || 0,
    gender: patientPatch?.gender || 'Other',
    phone: (patientPatch?.phone || '').trim(),
    email: (patientPatch?.email || '').trim(),
    address: (patientPatch?.address || '').trim(),
    emergencyContactName: (patientPatch?.emergencyContactName || '').trim(),
    emergencyContactPhone: (patientPatch?.emergencyContactPhone || '').trim(),
    primaryPhysician: (patientPatch?.primaryPhysician || '').trim(),
    insuranceProvider: (patientPatch?.insuranceProvider || '').trim(),
    insurancePolicyNumber: (patientPatch?.insurancePolicyNumber || '').trim(),
    heightCm: patientPatch?.heightCm ?? null,
    weightKg: patientPatch?.weightKg ?? null,
    bloodType: (patientPatch?.bloodType || '').trim(),
    allergies: (patientPatch?.allergies || '').trim(),
    medications: (patientPatch?.medications || '').trim(),
    pastMedicalHistory: (patientPatch?.pastMedicalHistory || '').trim(),
    surgicalHistory: (patientPatch?.surgicalHistory || '').trim(),
    familyHistory: (patientPatch?.familyHistory || '').trim(),
    socialHistory: (patientPatch?.socialHistory || '').trim(),
    currentSymptoms: (patientPatch?.currentSymptoms || '').trim(),
    diagnosis: (patientPatch?.diagnosis || '').trim(),
    notes: (patientPatch?.notes || '').trim(),
  }, patientId)

  const updatePayload = {
    name: normalized.name,
    age: normalized.age,
    gender: normalized.gender,
    phone: normalized.phone,
    email: normalized.email,
    address: normalized.address,
    emergencyContactName: normalized.emergencyContactName,
    emergencyContactPhone: normalized.emergencyContactPhone,
    primaryPhysician: normalized.primaryPhysician,
    insuranceProvider: normalized.insuranceProvider,
    insurancePolicyNumber: normalized.insurancePolicyNumber,
    heightCm: normalized.heightCm,
    weightKg: normalized.weightKg,
    bloodType: normalized.bloodType,
    allergies: normalized.allergies,
    medications: normalized.medications,
    pastMedicalHistory: normalized.pastMedicalHistory,
    surgicalHistory: normalized.surgicalHistory,
    familyHistory: normalized.familyHistory,
    socialHistory: normalized.socialHistory,
    currentSymptoms: normalized.currentSymptoms,
    diagnosis: normalized.diagnosis,
    notes: normalized.notes,
    modelVersion: 'patient.v1',
  }

  if (USE_MOCK) {
    await delay(400)
    const idx = MOCK_PATIENTS.findIndex(p => p.id === patientId)
    if (idx !== -1) {
      MOCK_PATIENTS[idx] = normalizePatientRecord(
        { ...MOCK_PATIENTS[idx], ...updatePayload, id: patientId },
        patientId,
      )
      return MOCK_PATIENTS[idx]
    }
    const fallback = normalizePatientRecord({ ...updatePayload, id: patientId }, patientId)
    MOCK_PATIENTS.unshift(fallback)
    return fallback
  }

  await updateDoc(doc(db, 'patients', patientId), updatePayload)
  return normalizePatientRecord({ ...updatePayload, id: patientId }, patientId)
}

/**
 * Fetch all assessments for a patient.
 * @param {string} patientId
 * @returns {Promise<Assessment[]>}
 */
export async function getAssessments(patientId) {
  if (USE_MOCK) {
    await delay(400)
    return mockAssessments
      .filter(a => a.patientId === patientId)
      .map((assessment) => normalizeAssessmentRecord(assessment, { patientId }))
  }
  const snap = await getDocs(collection(db, 'patients', patientId, 'assessments'))
  return snap.docs.map((d) => {
    const raw = d.data() || {}
    const normalized = normalizeAssessmentRecord({ id: d.id, patientId, ...raw }, { id: d.id, patientId })
    const patch = buildAssessmentBackfill(raw, normalized)
    if (Object.keys(patch).length > 0) {
      updateDoc(d.ref, patch).catch(() => {
        // keep reads resilient even if backfill fails
      })
    }
    return normalized
  })
}

/**
 * Create a new assessment document for a patient.
 * @param {string} patientId
 * @param {object} data
 * @returns {Promise<string>} The new assessmentId
 */
export async function createAssessment(patientId, data) {
  const normalizedInput = normalizeAssessmentRecord({ ...data, patientId }, { patientId })
  const { id: _ignoredAssessmentId, ...assessmentPayload } = normalizedInput
  const clientSubmit = normalizedInput.clientSubmitTimestamp instanceof Date
    ? normalizedInput.clientSubmitTimestamp
    : new Date()
  const clientStart = normalizedInput.startTimestamp instanceof Date
    ? normalizedInput.startTimestamp
    : clientSubmit
  const isoDate = normalizedInput.date || clientSubmit.toISOString()

  if (USE_MOCK) {
    await delay(800)
    const assessmentId = uuidv4()
    const assessment = normalizeAssessmentRecord({
      ...assessmentPayload,
      id: assessmentId,
      date: isoDate,
      clientSubmitTimestamp: clientSubmit,
      startTimestamp: clientStart,
      submitTimestamp: clientSubmit,
      createdAt: new Date(),
    }, { id: assessmentId, patientId })
    mockAssessments.push(assessment)

    const patient = MOCK_PATIENTS.find(p => p.id === patientId)
    if (patient) {
      patient.sessionCount = (patient.sessionCount || 0) + 1
    }

    return assessmentId
  }

  const ref = await addDoc(collection(db, 'patients', patientId, 'assessments'), {
    ...assessmentPayload,
    date: isoDate,
    clientSubmitTimestamp: clientSubmit,
    startTimestamp: clientStart,
    submitTimestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
  })

  try {
    await updateDoc(doc(db, 'patients', patientId), {
      sessionCount: increment(1),
    })
  } catch {
    // If the counter update fails, keep the assessment write successful.
  }

  return ref.id
}

/**
 * Update an existing assessment.
 * @param {string} patientId
 * @param {string} assessmentId
 * @param {object} data
 */
export async function updateAssessment(patientId, assessmentId, data) {
  if (USE_MOCK) {
    await delay(300)
    const idx = mockAssessments.findIndex(a => a.id === assessmentId && a.patientId === patientId)
    if (idx !== -1) {
      mockAssessments[idx] = normalizeAssessmentRecord(
        { ...mockAssessments[idx], ...data, patientId, id: assessmentId },
        { id: assessmentId, patientId },
      )
    }
    return
  }
  const normalizedPatch = {
    ...data,
    flags: Array.isArray(data.flags) ? data.flags : [],
    modelVersion: 'assessment.v1',
  }
  await updateDoc(doc(db, 'patients', patientId, 'assessments', assessmentId), normalizedPatch)
}

/**
 * Fetch a single assessment by ID.
 * @param {string} patientId
 * @param {string} assessmentId
 * @returns {Promise<Assessment|null>}
 */
export async function getAssessment(patientId, assessmentId) {
  if (USE_MOCK) {
    await delay(400)
    const found = mockAssessments.find(a => a.id === assessmentId && a.patientId === patientId)
    return found ? normalizeAssessmentRecord(found, { id: assessmentId, patientId }) : null
  }
  const snap = await getDoc(doc(db, 'patients', patientId, 'assessments', assessmentId))
  if (!snap.exists()) return null
  const raw = snap.data() || {}
  const normalized = normalizeAssessmentRecord({ id: snap.id, patientId, ...raw }, { id: snap.id, patientId })
  const patch = buildAssessmentBackfill(raw, normalized)
  if (Object.keys(patch).length > 0) {
    updateDoc(doc(db, 'patients', patientId, 'assessments', assessmentId), patch).catch(() => {
      // keep reads resilient even if backfill fails
    })
  }
  return normalized
}
