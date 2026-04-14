/**
 * src/services/speech.js
 *
 * Speech analysis API client for CogniSense unified backend.
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

export async function analyzeSpeechAudio(file, language = 'auto') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('language', language)

  const response = await fetch(`${ML_API_URL}/api/speech/analyze`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}

export async function analyzeSpeechDemo() {
  const response = await fetch(`${ML_API_URL}/api/speech/analyze/demo`, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}
