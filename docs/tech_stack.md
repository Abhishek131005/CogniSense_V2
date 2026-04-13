# CogniSense — CDT Module Tech Stack
## tech_stack.md | Version 1.0

---

## Overview

The CDT Module is a **React + Vite** web application consistent with the Speech Module's architecture. It shares Firebase project, Firestore collections, and Firebase Storage bucket. The stack is chosen for rapid development, real-time data sync, and mobile-first performance.

---

## 1. Frontend

### Core Framework

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.x | UI component framework |
| **Vite** | 5.x | Build tool & dev server (HMR, fast cold starts) |
| **React Router v6** | 6.x | Client-side routing (`/cdt`, `/cdt/draw`, `/cdt/result/:id`) |

### Styling

| Technology | Version | Purpose |
|---|---|---|
| **Tailwind CSS** | 3.x | Utility-first styling with custom design tokens |
| **Custom CSS (`:root` variables)** | — | Design system tokens (colors, fonts, spacing) |
| **Google Fonts** | — | Cormorant Garamond, DM Sans, DM Mono |

**Tailwind Configuration** — extend `tailwind.config.js` to match the design system:

```js
// tailwind.config.js
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base':      '#EDEAE3',
        'bg-dark':      '#141A12',
        'accent':       '#5C8F68',
        'accent-light': '#7DB88A',
        'risk-low':     '#5C8F68',
        'risk-medium':  '#C4A84F',
        'risk-high':    '#C47A3A',
        'risk-critical':'#B04040',
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        body:    ['DM Sans', 'system-ui', 'sans-serif'],
        mono:    ['DM Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        'xl':  '16px',
        '2xl': '20px',
      },
    },
  },
}
```

### Canvas & Drawing

| Technology | Purpose |
|---|---|
| **HTML5 Canvas API** | Core drawing surface — raw `<canvas>` element managed via `useRef` |
| **Pointer Events API** | Unified input for mouse, touch, and stylus — use `onPointerDown`, `onPointerMove`, `onPointerUp` |

> **Why native Canvas over a library?** Libraries like `fabric.js` or `react-sketch-canvas` add abstraction overhead and don't give direct access to the low-level stroke event data (pressure, timestamp per point) needed for ML feature extraction. We need raw pointer event access.

**Stroke data recording pattern:**

```js
// Each stroke = { strokeId, points: [{x, y, pressure, t}], ... }
const handlePointerMove = (e) => {
  const point = {
    x: e.nativeEvent.offsetX,
    y: e.nativeEvent.offsetY,
    pressure: e.nativeEvent.pressure ?? 0.5,
    t: Date.now(),
  };
  currentStroke.current.points.push(point);
  drawPoint(point); // render to canvas immediately
};
```

### UI Components & Icons

| Technology | Purpose |
|---|---|
| **Lucide React** | Icon set (PenLine, Timer, Undo2, RotateCcw, Activity, etc.) |
| **Custom components** | All major components built from scratch using Tailwind + design tokens |

### State Management

| Technology | Purpose |
|---|---|
| **React Context + useReducer** | Global app state (current patient, session state, assessment history) |
| **useState / useRef** | Local component state (canvas strokes, timer, drawing mode) |

> No Redux or Zustand needed for this module's scope. React Context is sufficient.

**Context structure:**
```
AppContext
├── currentPatient: Patient | null
├── currentSession: Session | null
├── patients: Patient[]
└── dispatch: (action) => void

SessionContext (drawing page only)
├── strokes: Stroke[]
├── pauseEvents: PauseEvent[]
├── isDrawing: boolean
├── elapsedMs: number
├── revisionCount: number
└── dispatch: (action) => void
```

### Utilities

| Technology | Purpose |
|---|---|
| **date-fns** | Date formatting for timestamps, session display |
| **uuid** | Generate unique `assessmentId`, `strokeId` |

---

## 2. Backend & Infrastructure

### Firebase Suite

| Service | Usage |
|---|---|
| **Firebase Authentication** | Google Sign-In for GP users. Auth state gates all Firestore access. Shared with Speech Module. |
| **Cloud Firestore** | Primary database. Stores patients, assessments (CDT + speech), session metadata. Real-time listeners for Brain Velocity updates. |
| **Firebase Storage** | Stores CDT drawing images. Path: `assessments/{patientId}/{assessmentId}/cdt_image.png` |
| **Firebase Hosting** | Static hosting for the built Vite app |

### Firestore Collections

```
/patients/{patientId}
  /assessments/{assessmentId}     ← CDT + Speech assessments (type field differentiates)
```

> Reuse the exact collection structure established by the Speech Module. Do NOT create separate CDT-specific collections.

### ML Scoring (Mock / Future)

For Sem VI capstone scope, the ML scoring is **mocked client-side**:

```js
// src/services/scoring.js
export const scoreCDTAssessment = async (features, imageBase64) => {
  // MOCK: Replace with FastAPI call in production
  await new Promise(r => setTimeout(r, 1500)); // simulate latency
  const score = Math.min(100, Math.max(0,
    features.pauseCount * 8 +
    features.revisionCount * 6 +
    (features.totalDurationMs / 1000) * 0.8 +
    Math.random() * 10
  ));
  return {
    cdtRiskScore: Math.round(score * 10) / 10,
    riskClass: score < 30 ? 0 : score < 50 ? 1 : score < 70 ? 2 : 3,
    riskLabel: ['Cognitively Normal', 'Subjective Cognitive Decline', 'Mild Cognitive Impairment', 'High Risk — Urgent Referral'][Math.min(3, Math.floor(score / 25))],
    flags: derivedFlags(features),
    recommendation: derivedRecommendation(score),
  };
};
```

**Future production path:** Replace `scoreCDTAssessment` with a `fetch` call to `POST /api/score/cdt` (FastAPI endpoint running ViT + LSTM models).

---

## 3. Project Structure

```
cognisense-cdt/
├── public/
│   └── clock-outline.svg       ← Pre-drawn clock circle SVG (used as canvas overlay)
├── src/
│   ├── assets/
│   │   └── fonts/              ← Self-hosted font files (optional fallback)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.jsx
│   │   │   └── Footer.jsx
│   │   ├── ui/
│   │   │   ├── Button.jsx      ← Primary, Ghost, Pill variants
│   │   │   ├── Card.jsx        ← Light + Dark variants
│   │   │   ├── Badge.jsx       ← Risk class badges
│   │   │   ├── Toast.jsx
│   │   │   ├── ProgressBar.jsx
│   │   │   └── Spinner.jsx
│   │   ├── cdt/
│   │   │   ├── DrawingCanvas.jsx       ← Core canvas component
│   │   │   ├── CanvasControls.jsx      ← Undo, Clear, Timer, Submit
│   │   │   ├── StrokeRecorder.js       ← Stroke capture logic (non-component)
│   │   │   ├── FeatureComputer.js      ← Client-side feature extraction
│   │   │   ├── RiskScoreCard.jsx       ← Dark result card
│   │   │   ├── FeatureGrid.jsx         ← 6-card feature display
│   │   │   ├── ClockThumbnail.jsx      ← Submitted drawing preview
│   │   │   └── LiveFeatureBar.jsx      ← Real-time stats below canvas
│   │   └── patient/
│   │       ├── PatientSelector.jsx
│   │       └── PatientInfoBar.jsx
│   ├── context/
│   │   ├── AppContext.jsx
│   │   └── SessionContext.jsx
│   ├── hooks/
│   │   ├── useTimer.js             ← Session timer hook
│   │   ├── useFirestore.js         ← CRUD operations wrapper
│   │   └── useCanvasExport.js      ← Canvas to PNG/base64
│   ├── pages/
│   │   ├── CDTLandingPage.jsx      ← /cdt
│   │   ├── DrawingPage.jsx         ← /cdt/draw
│   │   └── ResultPage.jsx          ← /cdt/result/:assessmentId
│   ├── services/
│   │   ├── firebase.js             ← Firebase initialization (shared config)
│   │   ├── firestore.js            ← Firestore read/write functions
│   │   ├── storage.js              ← Firebase Storage upload
│   │   └── scoring.js              ← Mock scoring + future FastAPI bridge
│   ├── styles/
│   │   ├── index.css               ← :root CSS variables, global resets
│   │   └── canvas.css              ← Canvas-specific styles
│   ├── utils/
│   │   ├── featureComputer.js      ← Pure functions for dynamic feature extraction
│   │   ├── riskUtils.js            ← Score → class, color, label helpers
│   │   └── formatters.js           ← Time, number formatting
│   ├── App.jsx
│   └── main.jsx
├── .env                            ← Firebase config keys
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## 4. Dependencies

### package.json

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "firebase": "^10.13.0",
    "lucide-react": "^0.383.0",
    "date-fns": "^3.6.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0",
    "tailwindcss": "^3.4.10",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.41",
    "eslint": "^9.9.0",
    "@eslint/js": "^9.9.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-react-refresh": "^0.4.9"
  }
}
```

---

## 5. Environment Variables

```env
# .env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Optional: FastAPI ML endpoint (leave empty to use mock)
VITE_ML_API_URL=
```

> Use the **same Firebase project** as the Speech Module. Get these values from your teammate.

---

## 6. Firebase Security Rules

```js
// Firestore rules — consistent with Speech Module
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /patients/{patientId} {
      allow read, write: if request.auth != null;
      
      match /assessments/{assessmentId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}

// Storage rules
service firebase.storage {
  match /b/{bucket}/o {
    match /assessments/{patientId}/{assessmentId}/{file} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 7. Build & Deployment

```bash
# Development
npm run dev

# Production build
npm run build

# Deploy to Firebase Hosting
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

**Vite config:**
```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,  // Use 5173 for speech module, 5174 for CDT to run simultaneously
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
})
```

---

## 8. Browser & Device Support

| Platform | Support Level |
|---|---|
| Chrome Android (tablet/phone) | **Primary** — all features including pointer pressure |
| Chrome Desktop | Full support |
| Safari iOS | Supported (touch events, no pressure API) |
| Firefox Desktop | Supported |
| Samsung Internet | Best-effort |

> **Canvas pressure API**: `PointerEvent.pressure` is supported in Chrome and Edge. For Safari, default to `pressure = 0.5`. This doesn't affect scoring in the current mock phase.