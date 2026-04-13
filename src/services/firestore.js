/**
 * src/services/firestore.js
 *
 * Firestore data access layer.
 * Currently uses in-memory mock data. Swap with real Firestore SDK calls
 * once Firebase config is available.
 */
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

import { v4 as uuidv4 } from 'uuid'
import { IS_MOCK } from './firebase'

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

// ── API Functions ─────────────────────────────────────────────────────────────

/**
 * Fetch all patients from Firestore (or mock).
 * @returns {Promise<Patient[]>}
 */
export async function getPatients() {
  if (IS_MOCK) {
    await delay(600)
    return [...MOCK_PATIENTS]
  }
  const snap = await getDocs(collection(db, 'patients'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Fetch a single patient by ID.
 * @param {string} patientId
 * @returns {Promise<Patient|null>}
 */
export async function getPatient(patientId) {
  if (IS_MOCK) {
    await delay(300)
    return MOCK_PATIENTS.find(p => p.id === patientId) || null
  }
  const snap = await getDoc(doc(db, 'patients', patientId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/**
 * Fetch all assessments for a patient.
 * @param {string} patientId
 * @returns {Promise<Assessment[]>}
 */
export async function getAssessments(patientId) {
  if (IS_MOCK) {
    await delay(400)
    return mockAssessments.filter(a => a.patientId === patientId)
  }
  const snap = await getDocs(collection(db, 'patients', patientId, 'assessments'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Create a new assessment document for a patient.
 * @param {string} patientId
 * @param {object} data
 * @returns {Promise<string>} The new assessmentId
 */
export async function createAssessment(patientId, data) {
  if (IS_MOCK) {
    await delay(800)
    const assessmentId = uuidv4()
    const assessment = {
      id: assessmentId,
      patientId,
      ...data,
      createdAt: new Date(),
    }
    mockAssessments.push(assessment)
    return assessmentId
  }
  const ref = await addDoc(collection(db, 'patients', patientId, 'assessments'), {
    ...data,
    submitTimestamp: serverTimestamp()
  })
  return ref.id
}

/**
 * Update an existing assessment.
 * @param {string} patientId
 * @param {string} assessmentId
 * @param {object} data
 */
export async function updateAssessment(patientId, assessmentId, data) {
  if (IS_MOCK) {
    await delay(300)
    const idx = mockAssessments.findIndex(a => a.id === assessmentId && a.patientId === patientId)
    if (idx !== -1) {
      mockAssessments[idx] = { ...mockAssessments[idx], ...data }
    }
    return
  }
  await updateDoc(doc(db, 'patients', patientId, 'assessments', assessmentId), data)
}

/**
 * Fetch a single assessment by ID.
 * @param {string} patientId
 * @param {string} assessmentId
 * @returns {Promise<Assessment|null>}
 */
export async function getAssessment(patientId, assessmentId) {
  if (IS_MOCK) {
    await delay(400)
    return mockAssessments.find(a => a.id === assessmentId && a.patientId === patientId) || null
  }
  const snap = await getDoc(doc(db, 'patients', patientId, 'assessments', assessmentId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}
