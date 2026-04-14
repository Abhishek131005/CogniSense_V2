/**
 * src/context/AppContext.jsx
 *
 * Global app state: current patient, patient list, loading states.
 * Wraps the entire application.
 */

import { createContext, useContext, useReducer, useEffect } from 'react'
import { addPatient, deletePatientById, getPatients } from '../services/firestore'

// ── State shape ───────────────────────────────────────────────────────────────

const initialState = {
  patients: [],
  currentPatient: null,
  patientsLoading: true,
  patientsError: null,
}

// ── Reducer ───────────────────────────────────────────────────────────────────

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_PATIENTS':
      return { ...state, patients: action.payload, patientsLoading: false, patientsError: null }

    case 'SET_PATIENTS_ERROR':
      return { ...state, patientsLoading: false, patientsError: action.payload }

    case 'SET_CURRENT_PATIENT':
      return { ...state, currentPatient: action.payload }

    case 'CLEAR_CURRENT_PATIENT':
      return { ...state, currentPatient: null }

    case 'ADD_PATIENT': {
      const updatedPatients = [
        action.payload,
        ...state.patients.filter(p => p.id !== action.payload.id),
      ]
      return {
        ...state,
        patients: updatedPatients,
        currentPatient: action.payload,
      }
    }

    case 'REMOVE_PATIENT': {
      const filtered = state.patients.filter(p => p.id !== action.payload)
      const shouldClearCurrent = state.currentPatient?.id === action.payload
      return {
        ...state,
        patients: filtered,
        currentPatient: shouldClearCurrent ? null : state.currentPatient,
      }
    }

    default:
      return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // Load patients on mount
  useEffect(() => {
    let cancelled = false

    getPatients()
      .then(patients => {
        if (!cancelled) {
          dispatch({ type: 'SET_PATIENTS', payload: patients })
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Failed to load patients:', err)
          dispatch({ type: 'SET_PATIENTS_ERROR', payload: err.message })
        }
      })

    return () => { cancelled = true }
  }, [])

  const setCurrentPatient = (patient) => {
    dispatch({ type: 'SET_CURRENT_PATIENT', payload: patient })
  }

  const clearCurrentPatient = () => {
    dispatch({ type: 'CLEAR_CURRENT_PATIENT' })
  }

  const addNewPatient = async (patientInput) => {
    const created = await addPatient(patientInput)
    dispatch({ type: 'ADD_PATIENT', payload: created })
    return created
  }

  const removePatient = async (patientId) => {
    await deletePatientById(patientId)
    dispatch({ type: 'REMOVE_PATIENT', payload: patientId })
  }

  const value = {
    ...state,
    setCurrentPatient,
    clearCurrentPatient,
    addNewPatient,
    removePatient,
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

/**
 * Hook to consume AppContext.
 * @returns {AppContextValue}
 */
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within an <AppProvider>')
  return ctx
}

export default AppContext
