# CogniSense — CDT Module Implementation Plan
## todo.md | Version 1.0

---

## How to Use This Document

Each task has:
- A **phase** (0–5 for sequential milestones)
- An **estimated time** (realistic for a single developer)
- A **depends on** field (blocking dependencies)
- A checkbox to mark completion

Work through phases in order. Within a phase, tasks can be parallelized unless a dependency is noted.

---

## Phase 0: Setup & Configuration
**Goal: Working Vite + React app connected to Firebase in < 2 hours**

- [ ] **0.1** Initialize Vite + React project
  ```bash
  npm create vite@latest cognisense-cdt -- --template react
  cd cognisense-cdt
  npm install
  ```
  *Time: 5 min*

- [ ] **0.2** Install all dependencies from `tech_stack.md`
  ```bash
  npm install react-router-dom firebase lucide-react date-fns uuid
  npm install -D tailwindcss autoprefixer postcss
  npx tailwindcss init -p
  ```
  *Time: 5 min*

- [ ] **0.3** Configure `tailwind.config.js` with design tokens from `design.md` (colors, fonts, radii)
  *Time: 15 min*

- [ ] **0.4** Create `src/styles/index.css` with all `:root` CSS variables from `design.md`
  *Time: 15 min*

- [ ] **0.5** Add Google Fonts import (`Cormorant Garamond`, `DM Sans`, `DM Mono`) to `index.html`
  *Time: 5 min*

- [ ] **0.6** Get Firebase config from Speech Module teammate. Create `.env` file with all `VITE_FIREBASE_*` variables
  *Time: 10 min | Depends on: teammate*

- [ ] **0.7** Create `src/services/firebase.js` — initialize Firebase app, export `auth`, `db`, `storage`
  *Time: 10 min | Depends on: 0.6*

- [ ] **0.8** Set up React Router in `App.jsx` with 3 routes: `/cdt`, `/cdt/draw`, `/cdt/result/:assessmentId`
  *Time: 10 min*

- [ ] **0.9** Create stub page components for each route (just returns a `<div>Page Name</div>`)
  *Time: 10 min*

- [ ] **0.10** Verify app runs on `localhost:5174` with correct fonts loading
  *Time: 5 min*

**Phase 0 Checkpoint:** App boots, routes work, fonts visible, Firebase initializes without errors.

---

## Phase 1: Shared UI Foundation
**Goal: Navbar, base layout, and reusable components matching Speech Module design**

- [ ] **1.1** Build `Navbar.jsx`
  - Logo (• CogniSense)
  - Nav links: HOME, SPEECH, CDT, PROFILE
  - "New Screening →" pill CTA button
  - 1px bottom border, `var(--bg-base)` background
  - Active route highlighting
  *Time: 45 min*

- [ ] **1.2** Build `Button.jsx` — variants: `primary` (black pill), `ghost` (transparent border), `danger`
  *Time: 20 min*

- [ ] **1.3** Build `Card.jsx` — variants: `light` (`var(--bg-surface)`), `dark` (`var(--bg-dark)`), accepts `className` override
  *Time: 15 min*

- [ ] **1.4** Build `Badge.jsx` — risk class badge with color variants (`risk-low`, `risk-medium`, `risk-high`, `risk-critical`)
  *Time: 15 min*

- [ ] **1.5** Build `Spinner.jsx` — animated SVG arc in `var(--accent-primary)`, sizes: `sm`, `md`, `lg`
  *Time: 20 min*

- [ ] **1.6** Build `ProgressBar.jsx` — horizontal bar, animates from 0 to value on mount, color prop
  *Time: 20 min*

- [ ] **1.7** Build `Toast.jsx` + `useToast.js` hook — slide-up from bottom-right, success/error variants, 4s auto-dismiss
  *Time: 30 min*

- [ ] **1.8** Build page header pattern as reusable component: `PageHeader.jsx` — takes `label`, `title`, `italicWord`, `description` props
  *Time: 20 min*

- [ ] **1.9** Build `Footer.jsx` — minimal, mono-style, matches speech module footer if present
  *Time: 15 min*

**Phase 1 Checkpoint:** All base UI components render correctly with the design system colors and fonts. Navbar links work.

---

## Phase 2: Firebase Data Layer
**Goal: Read patients from Firestore, write assessments back — data pipeline working before UI**

- [ ] **2.1** Implement `src/services/firestore.js`:
  - `getPatients()` → fetch all patients from `/patients` collection
  - `getPatient(patientId)` → fetch single patient
  - `getAssessments(patientId)` → fetch all assessments for patient
  - `createAssessment(patientId, data)` → add new assessment document
  - `updateAssessment(patientId, assessmentId, data)` → update existing assessment
  *Time: 45 min | Depends on: 0.7*

- [ ] **2.2** Implement `src/services/storage.js`:
  - `uploadCDTImage(patientId, assessmentId, base64PNG)` → uploads to Firebase Storage, returns download URL
  *Time: 30 min | Depends on: 0.7*

- [ ] **2.3** Create `AppContext.jsx`:
  - `currentPatient` state
  - `patients` array (loaded from Firestore on mount)
  - `setCurrentPatient()` action
  *Time: 30 min | Depends on: 2.1*

- [ ] **2.4** Build `PatientSelector.jsx`:
  - Dropdown showing all patients from AppContext
  - Displays name, age, gender, ID
  - On select → sets `currentPatient` in context
  - "No patient selected" empty state
  *Time: 45 min | Depends on: 2.3*

- [ ] **2.5** Build `PatientInfoBar.jsx`:
  - Compact info strip: name, age, gender, ID, session count
  - Used on the drawing page header
  *Time: 20 min | Depends on: 2.3*

- [ ] **2.6** Implement `src/services/scoring.js` with mock scoring function
  - Accept features object + imageBase64
  - Simulate 1.5s latency
  - Return `{ cdtRiskScore, riskClass, riskLabel, flags, recommendation }`
  *Time: 30 min*

- [ ] **2.7** Test: Create a test patient manually in Firestore console. Verify `PatientSelector` shows it. Verify `createAssessment` writes correctly.
  *Time: 20 min | Depends on: 2.1–2.4*

**Phase 2 Checkpoint:** Can select patient from Firestore, can write a dummy assessment to Firestore via console/test.

---

## Phase 3: Drawing Canvas (Core Feature)
**Goal: Fully functional drawing canvas with stroke recording, pause detection, and feature computation**

- [ ] **3.1** Create `src/utils/featureComputer.js`:
  - Pure functions, no React dependencies
  - `computeFeatures(strokes, pauseEvents, totalDurationMs)` → returns all features from PRD section 4.3
  - `computeStrokeVelocity(stroke)` → pixels per second
  - `deriveFlags(features)` → returns array of flag strings
  *Time: 60 min*

- [ ] **3.2** Create `SessionContext.jsx`:
  - `strokes`, `pauseEvents`, `revisionCount`, `isDrawing`, `elapsedMs`
  - Actions: `START_STROKE`, `ADD_POINT`, `END_STROKE`, `UNDO_STROKE`, `CLEAR_ALL`, `ADD_PAUSE`, `TICK`
  *Time: 45 min*

- [ ] **3.3** Build `useTimer.js` hook:
  - `setInterval`-based, 1-second tick
  - Returns `{ elapsedMs, elapsedFormatted, isRunning, start, stop, reset }`
  - Auto-starts on first stroke
  *Time: 20 min*

- [ ] **3.4** Build `useCanvasExport.js` hook:
  - Takes canvas `ref`
  - Returns `exportToPNG()` → returns base64 string via `canvas.toDataURL('image/png')`
  *Time: 15 min*

- [ ] **3.5** Build core `DrawingCanvas.jsx` component:
  - `useRef` for canvas element
  - `useEffect` to initialize canvas context, draw clock circle overlay
  - `onPointerDown` → start new stroke, begin recording points
  - `onPointerMove` → add point to current stroke, render stroke to canvas immediately
  - `onPointerUp / onPointerLeave` → end stroke, push to SessionContext
  - Pause detection: compare time between `onPointerDown` and last `onPointerUp`; if > 2000ms, push `pauseEvent`
  - Render pre-drawn clock circle from SVG path or Canvas arc on mount
  - Prevent page scroll on mobile during drawing (`touch-action: none`)
  *Time: 120 min — most complex component*

- [ ] **3.6** Build `CanvasControls.jsx`:
  - **Undo** button: removes last stroke from context, redraws canvas from scratch (clear + replay all strokes)
  - **Clear** button: clears all strokes, resets canvas and session
  - **Timer display**: reads from `useTimer`, shows `MM:SS`, color changes at 3min
  - **Submit button**: disabled until at least 3 strokes recorded
  *Time: 60 min | Depends on: 3.2, 3.3, 3.5*

- [ ] **3.7** Build `LiveFeatureBar.jsx`:
  - Shows 3 live stats below canvas during drawing: Stroke Count | Duration | Pause Events
  - Updates on every context change
  *Time: 20 min | Depends on: 3.2*

- [ ] **3.8** Test canvas extensively on mobile (Chrome DevTools device emulation):
  - Touch drawing smooth with no lag
  - Undo correctly redraws
  - Clear resets everything
  - Pointer events captured correctly
  *Time: 30 min*

**Phase 3 Checkpoint:** Can draw on canvas. Strokes recorded in context. Features computable from recorded strokes. Undo and clear work. Timer runs.

---

## Phase 4: Pages & Submission Flow
**Goal: Complete 3-page flow from landing to result**

- [x] **4.1** Build `CDTLandingPage.jsx` (`/cdt`):
  - `PageHeader` with "Clock Drawing Test" (italic "Drawing" in green)
  - `PatientSelector` component
  - Instruction panel (3-step numbered list + clock illustration)
  - "Begin Test →" black pill button — disabled if no patient selected
  - "How This Works" 3-card section (light/dark card hover animation)
  - Navigate to `/cdt/draw` on button click
  *Time: 60 min | Depends on: 1.x, 2.4*

- [x] **4.2** Build `DrawingPage.jsx` (`/cdt/draw`):
  - `SessionContext.Provider` wrapping the page
  - `PatientInfoBar` at top
  - Task instruction text: *"Draw a clock face showing 10 minutes past 11"*
  - `DrawingCanvas` centered, max 640px wide
  - `CanvasControls` below canvas
  - `LiveFeatureBar` below controls
  - On "Submit": run submission flow (see 4.3)
  - Guard: if no `currentPatient`, redirect to `/cdt`
  *Time: 60 min | Depends on: 3.x, 2.5*

- [x] **4.3** Implement submission flow in `DrawingPage.jsx`:
  1. Show processing overlay (Spinner + "ANALYZING DRAWING...")
  2. Export canvas to base64 PNG via `useCanvasExport`
  3. Compute features via `featureComputer.computeFeatures()`
  4. Call `scoring.scoreCDTAssessment(features, imageBase64)`
  5. Upload image to Firebase Storage via `storage.uploadCDTImage()`
  6. Write full assessment to Firestore via `firestore.createAssessment()`
  7. Navigate to `/cdt/result/{assessmentId}`
  8. On any error: show error Toast, hide overlay, allow retry
  *Time: 90 min | Depends on: 2.2, 2.6, 3.1, 4.2*

- [x] **4.4** Build `RiskScoreCard.jsx` (dark card):
  - Score number with count-up animation on mount
  - Risk class label
  - 4 feature progress bars (Drawing Duration, Pause Ratio, Revision Count, Stroke Velocity)
  - Flag bullets with `•` in green
  *Time: 60 min | Depends on: 1.3, 1.6*

- [x] **4.5** Build `ClockThumbnail.jsx`:
  - Displays the submitted clock drawing PNG from Firebase Storage URL
  - Rounded corners, subtle border
  - Label: "SUBMITTED DRAWING"
  *Time: 20 min*

- [x] **4.6** Build `FeatureGrid.jsx`:
  - 2×3 grid of light cards
  - Each: numbered index, icon, title, value, description
  - Hover → dark card transition animation
  - Features: Drawing Duration, Stroke Count, Revision Count, Pause Events, Mean Velocity, Velocity StdDev
  *Time: 45 min*

- [x] **4.7** Build `ResultPage.jsx` (`/cdt/result/:assessmentId`):
  - Load assessment from Firestore using `assessmentId` from URL params
  - Two-column layout: `RiskScoreCard` + `ClockThumbnail` + key findings
  - Recommendation box (dark pill background, white text)
  - CTA buttons: "View Patient Profile" → `/profile` | "New Screening" → `/cdt`
  - `FeatureGrid` full-width below
  - Breadcrumb: `Patient Profiles > {patientName} > CDT Assessment #{n}`
  *Time: 90 min | Depends on: 4.4, 4.5, 4.6*

**Phase 4 Checkpoint:** Full flow works — land → select patient → draw → submit → see result. Data in Firestore. Image in Storage.

---

## Phase 5: Polish, Animations & Integration
**Goal: Production quality — animations, edge cases, profile integration, mobile testing**

- [x] **5.1** Add page load stagger animations:
  - Cards fade-up with `animation-delay` on landing page
  - Score card slide-up + fade on result page
  - Progress bars animate on mount (width: 0 → value)
  *Time: 45 min*

- [x] **5.2** Add score count-up animation in `RiskScoreCard`:
  - `useEffect` + `setInterval` counting from 0 to final score in 800ms
  *Time: 20 min*

- [x] **5.3** Mobile responsiveness pass:
  - Test all 3 pages on 375px (iPhone SE) and 768px (tablet)
  - Fix canvas size on small screens
  - Fix control button layout on mobile
  - Fix two-column result layout → single column on mobile
  *Time: 60 min*

- [x] **5.4** Add `@media print` styles for result page:
  - Hide navbar, CTAs, and feature grid on print
  - Show only: patient info, score card, thumbnail, flags, recommendation
  - Black-and-white print-safe version
  *Time: 30 min*

- [x] **5.5** Add localStorage fallback for stroke data:
  - On every stroke end, serialize and save `SessionContext` to `localStorage['cdt_session_draft']`
  - On `DrawingPage` mount, check for saved draft and offer to restore
  - Clear on successful submission
  *Time: 45 min*

- [ ] **5.6** Add CDT assessments to patient profile page:
  - Coordinate with Speech Module teammate
  - Add CDT scores to Brain Velocity trend chart (or create separate CDT score chart)
  - List past CDT assessments with score + date in profile
  *Time: 60 min | Depends on: teammate coordination*

- [x] **5.7** Handle empty/edge states:
  - No patients in Firestore → show "Add a patient in the Speech Module first" message
  - Assessment not found (bad URL) → 404 state with "Go back" button
  - Firestore read error → error state with retry button
  *Time: 30 min*

- [x] **5.8** Final cross-browser test:
  - Chrome Desktop ✓
  - Chrome Android (physical device or emulator) ✓
  - Safari iOS (if device available) ✓
  - Firefox Desktop ✓
  *Time: 30 min*

- [ ] **5.9** Deploy to Firebase Hosting:
  ```bash
  npm run build
  firebase deploy --only hosting
  ```
  *Time: 15 min | Depends on: all previous phases*

**Phase 5 Checkpoint:** App deployed, all animations smooth, mobile works, profile integration complete.

---

## Summary Timeline

| Phase | Goal | Estimated Time |
|---|---|---|
| Phase 0 | Setup & Config | 1.5 hours |
| Phase 1 | Shared UI Components | 3.5 hours |
| Phase 2 | Firebase Data Layer | 3 hours |
| Phase 3 | Drawing Canvas | 6 hours |
| Phase 4 | Pages & Submission Flow | 7.5 hours |
| Phase 5 | Polish & Integration | 5.5 hours |
| **Total** | | **~27 hours** |

> For a 2-week sprint with 2–3 hours of coding per day, this is achievable. Phases 0–2 in week 1, Phases 3–5 in week 2.

---

## Key Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Canvas performance lag on mobile | Medium | Use `requestAnimationFrame` for rendering; batch stroke point writes |
| Firebase Storage CORS issues | Medium | Configure Firebase Storage CORS rules before testing uploads |
| Canvas undo requires full redraw | Low | Maintain `offscreenCanvas` snapshot per stroke for O(n) redraw |
| Teammate's patient schema differs | Medium | Agree on Firestore schema in Phase 2.7 before building on top of it |
| Clock circle overlay misalignment | Low | Use a fixed SVG circle with well-defined coordinates, not dynamic positioning |

---

## Questions to Resolve With Teammate (Before Starting)

1. What is the exact Firestore path for patients? (`/patients/{id}` or nested differently?)
2. What fields does the patient document have? (Need: `name`, `age`, `gender`, `id`, `sessions`)
3. What Firebase project ID / config values should I use?
4. Is there a shared `profile.html` or profile React page I need to link to?
5. Should CDT scores appear on the same Brain Velocity chart as speech scores, or separate?
6. What port is the speech module running on? (Set CDT to 5174 to avoid conflict)