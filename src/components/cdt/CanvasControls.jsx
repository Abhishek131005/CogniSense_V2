/**
 * src/components/cdt/CanvasControls.jsx
 *
 * Controls row below the drawing canvas:
 * - Undo Last Stroke
 * - Clear All
 * - Timer display
 * - Submit button
 */

import { Undo2, RotateCcw, Clock } from 'lucide-react'
import { useSession } from '../../context/SessionContext'
import { Button } from '../ui/Button'
import { useTimer } from '../../hooks/useTimer'

/**
 * @param {{
 *   onSubmit: () => void,
 *   submitting: boolean,
 * }} props
 */
export function CanvasControls({ onSubmit, submitting = false }) {
  const { strokes, revisionCount, hasStarted, dispatch } = useSession()
  const { elapsedFormatted, isWarning } = useTimer(hasStarted && !submitting)

  const canUndo   = strokes.length > 0 && !submitting
  const canSubmit = strokes.length >= 3 && !submitting

  const handleUndo = () => {
    if (!canUndo) return
    dispatch({ type: 'UNDO_STROKE' })
  }

  const handleClear = () => {
    if (submitting) return
    if (strokes.length === 0) return
    if (window.confirm('Clear all strokes and reset the session?')) {
      dispatch({ type: 'CLEAR_ALL' })
    }
  }

  return (
    <div className="canvas-controls" role="toolbar" aria-label="Drawing controls">
      {/* Left: Undo + Clear */}
      <div className="canvas-controls-left">
        <Button
          id="btn-undo-stroke"
          variant="ghost"
          size="sm"
          onClick={handleUndo}
          disabled={!canUndo}
          icon={<Undo2 size={14} />}
          aria-label="Undo last stroke"
          title={`Undo last stroke (${revisionCount} revisions)`}
        >
          Undo
        </Button>

        <Button
          id="btn-clear-canvas"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={strokes.length === 0 || submitting}
          icon={<RotateCcw size={14} />}
          aria-label="Clear all strokes"
          title="Clear all strokes and restart"
        >
          Clear
        </Button>
      </div>

      {/* Right: Timer + Submit */}
      <div className="canvas-controls-right">
        {/* Timer */}
        <div
          className={`timer-display ${isWarning ? 'timer-warning' : ''}`}
          aria-label={`Elapsed time: ${elapsedFormatted}`}
          aria-live="polite"
          role="timer"
        >
          <Clock
            size={12}
            style={{
              display: 'inline',
              marginRight: 4,
              verticalAlign: 'middle',
              color: isWarning ? 'var(--risk-medium)' : 'var(--text-muted)',
            }}
          />
          <span>{elapsedFormatted}</span>
        </div>

        {/* Submit */}
        <Button
          id="btn-submit-drawing"
          variant="primary"
          size="md"
          onClick={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
          aria-label="Submit drawing for analysis"
          title={strokes.length < 3 ? 'Draw at least 3 strokes to submit' : 'Submit drawing'}
        >
          {submitting ? 'Analyzing…' : 'Submit →'}
        </Button>
      </div>
    </div>
  )
}

export default CanvasControls
