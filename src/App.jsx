/**
 * src/App.jsx
 *
 * Root application component.
 * Sets up React Router with 3 routes and wraps with AppProvider.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import CDTLandingPage from './pages/CDTLandingPage'
import DrawingPage from './pages/DrawingPage'
import ResultPage from './pages/ResultPage'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Redirect root to CDT */}
          <Route path="/" element={<Navigate to="/cdt" replace />} />

          {/* CDT Module routes */}
          <Route path="/cdt"                         element={<CDTLandingPage />} />
          <Route path="/cdt/draw"                    element={<DrawingPage />} />
          <Route path="/cdt/result/:assessmentId"    element={<ResultPage />} />

          {/* Placeholder routes for sibling modules */}
          <Route path="/speech"  element={<ComingSoon name="Speech Module" />} />
          <Route path="/profile" element={<ComingSoon name="Patient Profile" />} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/cdt" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

/** Placeholder for sibling module routes */
function ComingSoon({ name }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6875rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        Coming Soon
      </span>
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '2rem',
          fontWeight: 500,
          color: 'var(--text-primary)',
        }}
      >
        {name}
      </p>
    </div>
  )
}
