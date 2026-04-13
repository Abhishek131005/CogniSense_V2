/**
 * src/hooks/useFirestore.js
 *
 * CRUD wrapper hook for Firestore operations with loading/error state.
 */

import { useState, useCallback } from 'react'
import * as firestore from '../services/firestore'

export function useFirestore() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const run = useCallback(async (fn) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn()
      return result
    } catch (err) {
      setError(err.message || 'An error occurred')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const createAssessment = useCallback((patientId, data) =>
    run(() => firestore.createAssessment(patientId, data)),
  [run])

  const getAssessment = useCallback((patientId, assessmentId) =>
    run(() => firestore.getAssessment(patientId, assessmentId)),
  [run])

  const getAssessments = useCallback((patientId) =>
    run(() => firestore.getAssessments(patientId)),
  [run])

  return {
    loading,
    error,
    createAssessment,
    getAssessment,
    getAssessments,
  }
}
