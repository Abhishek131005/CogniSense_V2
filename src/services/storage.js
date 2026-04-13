/**
 * src/services/storage.js
 *
 * Firebase Storage upload service.
 * Currently mocked — stores base64 locally and returns a data URL.
 * Replace with real Firebase Storage SDK when config is ready.
 */

import { IS_MOCK, storage } from './firebase'
import { ref, uploadString, getDownloadURL } from 'firebase/storage'

/**
 * Upload a CDT drawing image to Firebase Storage.
 * @param {string} patientId
 * @param {string} assessmentId
 * @param {string} base64PNG  — data URL from canvas.toDataURL()
 * @returns {Promise<string>}  — download URL
 */
export async function uploadCDTImage(patientId, assessmentId, base64PNG) {
  if (IS_MOCK) {
    // In mock mode, we just return the base64 data URL directly
    console.info('[MOCK] Storage upload simulated for', { patientId, assessmentId })
    await new Promise(r => setTimeout(r, 600))
    return base64PNG // Use data URL as the "download URL" in mock mode
  }

  // ── Real Firebase Storage upload ─────────────────────────────────────────
  /* 
  const storagePath = `assessments/${patientId}/${assessmentId}/cdt_image.png`
  const storageRef = ref(storage, storagePath)

  try {
    // Attempt to upload to Firebase Storage
    await uploadString(storageRef, base64PNG, 'data_url')
    return await getDownloadURL(storageRef)
  } catch (err) { ... }
  */

  // TEMPORARY BYPASS: Firebase Storage is encountering CORS/Bucket issues and 
  // blocking the app with endless retries. We will skip it completely and just 
  // save the base64 text directly to the Firestore database so the UI doesn't hang!
  console.warn('[Storage] Firebase Storage bypassed. Returning raw base64 string.')
  return base64PNG
}
