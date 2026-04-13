# CogniSense — Digital Clock Drawing Test (CDT) Module
## Product Requirements Document (PRD)
### Version 1.0 | Sem VI Capstone 2025–26 | VESIT Dept. of Information Technology

---

## 1. Overview

### 1.1 Product Context

CogniSense is a multimodal, smartphone-based deep learning framework for pre-clinical Alzheimer's Disease screening designed for deployment by General Physicians in low-resource healthcare settings. The system integrates three biomarker streams — acoustic speech, oculomotor tracking, and visuospatial drawing — fused via a Cross-Attention Transformer into a unified cognitive risk score.

This document specifies the **Clock Drawing Test (CDT) Module** — Module 3 of the CogniSense system. This module is a sibling to the completed Speech Module (built by the same team). It must share the same design system, data architecture, and Firebase/Firestore backend conventions.

### 1.2 Module Purpose

The CDT Module digitizes the gold-standard neuropsychological Clock Drawing Test, capturing both the **final static image** and the **dynamic temporal drawing process** — data invisible in paper-based administration. This dual-stream data is analyzed by a Vision Transformer (spatial) and LSTM (temporal) to produce a visuospatial risk score.

### 1.3 Target Users

| User | Role | Interaction |
|---|---|---|
| General Physician (GP) | Administers the test | Initiates session, views report |
| Elderly Patient (60+) | Performs drawing task | Draws on tablet screen |
| Clinic Admin | Manages patient registry | Views longitudinal trends |

---

## 2. Goals & Non-Goals

### 2.1 Goals

- Enable a GP to administer a digitized CDT in under 3 minutes
- Capture both static (final image) and dynamic (stroke sequence, timing, velocity, pauses) features
- Produce a CDT Risk Score (0–100) per assessment
- Store all assessment data to Firestore for longitudinal tracking
- Integrate with the existing patient profile system (as established by the Speech Module)
- Display a clear, GP-readable result report consistent with the CogniScan/CogniSense design language
- Support mobile-first, touch-optimized drawing input

### 2.2 Non-Goals

- Real-time ML inference on-device (ML backend is a future phase; for now, feature extraction and scoring is mocked or calls a FastAPI endpoint)
- Native mobile app (this is a web application only)
- Multi-language support at the UI level (English only for this phase)
- Replacing specialist diagnosis (this is a triage tool)

---

## 3. User Stories

### 3.1 GP / Clinician

| ID | Story | Priority |
|---|---|---|
| US-01 | As a GP, I want to select an existing patient and start a new CDT session so I can administer the test during a checkup | P0 |
| US-02 | As a GP, I want to give the patient a clear on-screen prompt with the drawing instruction | P0 |
| US-03 | As a GP, I want to see the patient draw in real-time on the canvas | P0 |
| US-04 | As a GP, I want to submit the completed drawing and receive a risk score and report | P0 |
| US-05 | As a GP, I want to view past CDT assessments and the score trend for a patient | P1 |
| US-06 | As a GP, I want to download or print a one-page CDT Risk Report | P2 |

### 3.2 System

| ID | Story | Priority |
|---|---|---|
| US-07 | As the system, I want to record every stroke as a timestamped coordinate sequence | P0 |
| US-08 | As the system, I want to compute dynamic features (stroke velocity, pause duration, total time, revision count) from the stroke data | P0 |
| US-09 | As the system, I want to export the final canvas as a PNG for static feature analysis | P0 |
| US-10 | As the system, I want to store raw stroke data, computed features, image URL, and risk score in Firestore | P0 |
| US-11 | As the system, I want to update the patient's Brain Velocity calculation after each new assessment | P1 |

---

## 4. Functional Requirements

### 4.1 Patient Selection & Session Initiation

- **FR-01**: The CDT page must allow the GP to select an existing patient from the Firestore `patients` collection (consistent with Speech Module patient schema)
- **FR-02**: A "New CDT Assessment" button initiates a session, logging a `startTimestamp` to Firestore
- **FR-03**: Session state is maintained in React state for the duration of the test; no partial saves until submission

### 4.2 Drawing Canvas

- **FR-04**: The canvas must be a full-width, touch and stylus-optimized HTML5 Canvas element rendered within a React component
- **FR-05**: The canvas must display a pre-drawn clock face outline (circle only) to reduce visuospatial construction load and focus assessment on numeral placement and hands
- **FR-06**: Every pointer event (`pointerdown`, `pointermove`, `pointerup`) must be captured and stored as a stroke object: `{ strokeId, points: [{x, y, pressure, timestamp}], duration }`
- **FR-07**: A pause between strokes exceeding 2 seconds must be flagged and stored as a `pauseEvent: { afterStrokeId, durationMs }`
- **FR-08**: An "Undo Last Stroke" control must be available, incrementing a `revisionCount` counter
- **FR-09**: A "Clear All" control must reset the canvas and all stroke data, resetting the session timer
- **FR-10**: A visible session timer (MM:SS) must display elapsed time since first stroke
- **FR-11**: The canvas must be minimum 400×400px on desktop and full-screen-width on mobile

### 4.3 Feature Computation (Client-Side)

The following dynamic features must be computed client-side from the recorded stroke data before submission:

| Feature | Computation Method |
|---|---|
| `totalDurationMs` | `lastStroke.endTime − firstStroke.startTime` |
| `strokeCount` | Length of strokes array |
| `revisionCount` | Count of undo events |
| `meanStrokeVelocity` | Mean of (stroke pixel length / stroke duration) across all strokes |
| `velocityStdDev` | Standard deviation of per-stroke velocities |
| `totalPauseDurationMs` | Sum of all pause event durations |
| `pauseCount` | Count of inter-stroke pauses > 2 seconds |
| `meanPauseDurationMs` | totalPauseDurationMs / pauseCount |
| `drawingOrderSequence` | Array of numeric labels detected via pattern (future: model; now: user-reported or skipped) |

### 4.4 Submission & Scoring

- **FR-12**: On submission, the canvas is exported as a base64 PNG
- **FR-13**: The PNG is uploaded to Firebase Storage under `assessments/{patientId}/{assessmentId}/cdt_image.png`
- **FR-14**: All computed dynamic features + image URL are written to Firestore under `patients/{patientId}/assessments/{assessmentId}` with `type: "cdt"`
- **FR-15**: A mock scoring function (or FastAPI call if available) returns a `cdtRiskScore` (0–100) and `riskClass` (0–3)
- **FR-16**: The score, class label, and key flag text are stored in Firestore and displayed in the result view

### 4.5 Result Report View

- **FR-17**: After submission, the GP sees a Result Card displaying: CDT Risk Score (large, styled), Risk Class label, top 3 flagged dynamic features, a thumbnail of the submitted drawing, and a recommendation string
- **FR-18**: A "View Full Patient Profile" button navigates to the patient's profile page (consistent with Speech Module profile page)
- **FR-19**: The result must be shareable as a printable one-page summary (CSS `@media print` support)

### 4.6 Patient Profile Integration

- **FR-20**: The patient profile page must include a CDT Assessments section alongside the existing Speech Assessments section
- **FR-21**: CDT scores must appear on the longitudinal Brain Velocity trend chart alongside speech scores

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Canvas must respond to touch/pointer input with <16ms latency (60fps minimum) |
| Accessibility | All interactive controls must have ARIA labels; contrast ratios must meet WCAG AA |
| Responsiveness | Fully functional on screen widths 360px–1920px |
| Data Integrity | Stroke data must be saved atomically; partial submissions must not corrupt patient records |
| Security | Firestore security rules must restrict patient data access to authenticated users |
| Offline Resilience | If submission fails, stroke data must be preserved in localStorage as a fallback |
| Browser Support | Chrome (Android/Desktop), Safari (iOS), Firefox — latest 2 major versions |

---

## 6. Data Schema (Firestore)

### Assessment Document
```
patients/{patientId}/assessments/{assessmentId}
{
  type: "cdt",
  startTimestamp: Timestamp,
  submitTimestamp: Timestamp,
  administeredBy: string,           // GP user UID
  
  // Scoring
  cdtRiskScore: number,             // 0–100
  riskClass: number,                // 0=Normal, 1=SCD, 2=MCI, 3=High
  riskLabel: string,
  flags: string[],                  // e.g. ["Elevated pause ratio", "High revision count"]
  recommendation: string,
  
  // Image
  imageUrl: string,                 // Firebase Storage URL
  imageBase64: string | null,       // Optional local fallback
  
  // Dynamic Features
  features: {
    totalDurationMs: number,
    strokeCount: number,
    revisionCount: number,
    meanStrokeVelocity: number,
    velocityStdDev: number,
    totalPauseDurationMs: number,
    pauseCount: number,
    meanPauseDurationMs: number,
  },
  
  // Raw Data
  strokes: [
    {
      strokeId: string,
      points: [{ x, y, pressure, timestamp }],
      durationMs: number,
      pixelLength: number,
      velocity: number
    }
  ],
  pauseEvents: [
    { afterStrokeId: string, durationMs: number }
  ]
}
```

---

## 7. Success Metrics

| Metric | Target |
|---|---|
| Test administration time | < 3 minutes per session |
| Canvas frame rate | ≥ 60fps on mid-range Android tablet |
| Feature computation time | < 500ms after submission |
| Firestore write success rate | > 99.5% |
| GP usability score (SUS) | ≥ 70/100 in simulated pilot |
| CDT Risk Score AUC-ROC | > 0.85 (pending ML integration) |

---

## 8. Dependencies

| Dependency | Owner | Status |
|---|---|---|
| Patient schema in Firestore | Speech Module team | ✅ Complete |
| Firebase project & Auth setup | Speech Module team | ✅ Complete |
| FastAPI ML scoring endpoint | Future phase | 🔲 Pending |
| Brain Velocity recalculation logic | Shared / DWH module | 🔲 Pending |
| Patient Profile page (profile.html) | Speech Module team | ✅ Reference available |

---

## 9. Out of Scope (Future Phases)

- Real ViT + LSTM inference (requires trained models on ADNI-CDT dataset)
- Pen pressure capture (requires stylus with pressure API support)
- Drawing order NLP detection (automatic numeral sequence recognition)
- Export to PDF clinical report
- Multi-patient batch review dashboard