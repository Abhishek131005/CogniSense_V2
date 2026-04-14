/**
 * src/services/firebase.js
 *
 * Firebase initialization — currently returns mock stubs.
 * Replace with real Firebase SDK when config is available from teammate.
 *
 * To activate real Firebase:
 * 1. Fill in all VITE_FIREBASE_* values in .env
 * 2. Uncomment the real initialization block below
 * 3. Remove the mock exports
 */

// ── Real Firebase ─────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const enableFirebaseAuth = import.meta.env.VITE_ENABLE_FIREBASE_AUTH === 'true'

const requiredEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

const firebaseConfig = {
  apiKey:             import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:         import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:          import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:  import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:              import.meta.env.VITE_FIREBASE_APP_ID,
}

export const IS_MOCK = false

let app
let auth
let db
let storage
let googleProvider
let firebaseInitError = null
let firebaseAuthError = null

const missingKeys = requiredEnvKeys.filter((k) => !import.meta.env[k])

if (missingKeys.length > 0) {
  firebaseInitError = new Error(`Missing env vars: ${missingKeys.join(', ')}`)
  console.error('[Firebase Init Error] Missing required VITE_FIREBASE_* variables.', firebaseInitError)
} else {
  try {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    storage = getStorage(app)
  } catch (error) {
    firebaseInitError = error
    console.error('[Firebase Init Error] Could not initialize Firebase app.', error)
  }

  if (app && enableFirebaseAuth) {
    try {
      auth = getAuth(app)
      googleProvider = new GoogleAuthProvider()
    } catch (error) {
      firebaseAuthError = error
      console.warn('[Firebase Auth Warning] Auth initialization failed. Firestore can still work if rules allow.', error)
    }
  }
}

export { app, auth, db, storage, googleProvider, firebaseInitError, firebaseAuthError }
