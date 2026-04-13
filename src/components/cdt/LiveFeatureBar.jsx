/**
 * src/components/cdt/LiveFeatureBar.jsx
 *
 * Real-time stats bar displayed below the canvas during drawing.
 * Updates on every context change.
 */

import { useSession } from '../../context/SessionContext'
import { useTimer } from '../../hooks/useTimer'

function Stat({ value, label }) {
  return (
    <div className="live-feature-item">
      <span className="live-feature-value">{value}</span>
      <span className="live-feature-label">{label}</span>
    </div>
  )
}

export function LiveFeatureBar() {
  const { strokes, pauseEvents, hasStarted } = useSession()
  const { elapsedFormatted } = useTimer(hasStarted)

  return (
    <div className="live-feature-bar" role="region" aria-label="Live drawing statistics">
      <Stat value={strokes.length}      label="Strokes"  />
      <Stat value={elapsedFormatted}    label="Duration" />
      <Stat value={pauseEvents.length}  label="Pauses"   />
    </div>
  )
}

export default LiveFeatureBar
