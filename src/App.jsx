/**
 * src/App.jsx
 *
 * Root application component.
 * Sets up React Router with 3 routes and wraps with AppProvider.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import HomePage from './pages/HomePage'
import CDTLandingPage from './pages/CDTLandingPage'
import DrawingPage from './pages/DrawingPage'
import ResultPage from './pages/ResultPage'
import SpeechPage from './pages/SpeechPage'
import ProfilePage from './pages/ProfilePage'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* CDT Module routes */}
          <Route path="/cdt"                         element={<CDTLandingPage />} />
          <Route path="/cdt/draw"                    element={<DrawingPage />} />
          <Route path="/cdt/result/:assessmentId"    element={<ResultPage />} />

          {/* Speech + Profile routes */}
          <Route path="/speech"  element={<SpeechPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
