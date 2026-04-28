/**
 * src/services/oculomotor.js
 *
 * Oculomotor analysis API client for CogniSense unified backend.
 */

const ML_API_URL = (import.meta.env.VITE_ML_API_URL || 'http://localhost:8000').trim()

async function parseError(response) {
  let detail = 'Unknown error'
  try {
    const payload = await response.json()
    detail = payload?.detail || JSON.stringify(payload)
  } catch {
    detail = await response.text()
  }
  return `API ${response.status}: ${detail}`
}

export async function analyzeOculomotorMetrics(metrics, source = 'manual') {
  const response = await fetch(`${ML_API_URL}/api/oculomotor/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metrics, source }),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}

export async function analyzeOculomotorDemo() {
  const response = await fetch(`${ML_API_URL}/api/oculomotor/analyze/demo`, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}

export async function analyzeLatestOculomotorReport() {
  const response = await fetch(`${ML_API_URL}/api/oculomotor/report/latest`, {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}

export async function startOculomotorCameraTask(timeoutSeconds = 420) {
  const timeout = Number.isFinite(Number(timeoutSeconds)) ? Number(timeoutSeconds) : 420
  const response = await fetch(`${ML_API_URL}/api/oculomotor/task/start?timeout_seconds=${Math.round(timeout)}`, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}

export async function getOculomotorHealth() {
  const response = await fetch(`${ML_API_URL}/api/oculomotor/health`, {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}
