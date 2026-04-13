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

const firebaseConfig = {
  apiKey:             import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:         import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:          import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:  import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:              import.meta.env.VITE_FIREBASE_APP_ID,
}

export const IS_MOCK = false

let app, auth, db, storage, googleProvider;

try {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
  storage = getStorage(app)
  googleProvider = new GoogleAuthProvider()
} catch (error) {
  console.error('[Firebase Init Error] Make sure all VITE_FIREBASE_* keys are valid inside your .env file.', error)
}

export { app, auth, db, storage, googleProvider }
