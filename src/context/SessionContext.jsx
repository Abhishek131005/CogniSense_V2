/**
 * src/context/SessionContext.jsx
 *
 * Drawing session state: strokes, pause events, revision count, timer.
 * Used only on the DrawingPage — wraps just that route.
 */

import { createContext, useContext, useReducer } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { computeStrokePixelLength, computeStrokeVelocity } from '../utils/featureComputer'

// ── State shape ───────────────────────────────────────────────────────────────

const initialState = {
  strokes: [],            // completed strokes
  pauseEvents: [],        // inter-stroke pauses > 2000ms
  currentStroke: null,    // stroke being drawn right now
  revisionCount: 0,       // number of undo events
  isDrawing: false,       // pointer is down
  hasStarted: false,      // first stroke has occurred (timer starts here)
  lastStrokeEndTime: null,// timestamp of last pointerUp (for pause detection)
  startTime: null,        // session start time (first pointerDown)
}

// ── Reducer ───────────────────────────────────────────────────────────────────

function sessionReducer(state, action) {
  switch (action.type) {

    case 'START_STROKE': {
      const now = action.payload.timestamp
      const strokeId = uuidv4()

      // Pause detection: check gap since last stroke ended
      let newPauseEvents = [...state.pauseEvents]
      if (state.lastStrokeEndTime !== null) {
        const gapMs = now - state.lastStrokeEndTime
        if (gapMs > 2000) {
          newPauseEvents = [...newPauseEvents, {
            afterStrokeId: state.strokes.length > 0
              ? state.strokes[state.strokes.length - 1].strokeId
              : null,
            durationMs: gapMs,
          }]
        }
      }

      return {
        ...state,
        isDrawing: true,
        hasStarted: true,
        startTime: state.startTime ?? now,
        pauseEvents: newPauseEvents,
        currentStroke: {
          strokeId,
          points: [action.payload.point],
          startTime: now,
        },
      }
    }

    case 'ADD_POINT': {
      if (!state.currentStroke) return state
      return {
        ...state,
        currentStroke: {
          ...state.currentStroke,
          points: [...state.currentStroke.points, action.payload.point],
        },
      }
    }

    case 'END_STROKE': {
      if (!state.currentStroke) return state
      const endTime = action.payload.timestamp
      const durationMs = endTime - state.currentStroke.startTime
      const pixelLength = computeStrokePixelLength(state.currentStroke.points)

      const completedStroke = {
        ...state.currentStroke,
        endTime,
        durationMs,
        pixelLength,
        velocity: computeStrokeVelocity({
          points: state.currentStroke.points,
          durationMs,
        }),
      }

      return {
        ...state,
        isDrawing: false,
        currentStroke: null,
        lastStrokeEndTime: endTime,
        strokes: [...state.strokes, completedStroke],
      }
    }

    case 'UNDO_STROKE': {
      if (state.strokes.length === 0) return state
      return {
        ...state,
        strokes: state.strokes.slice(0, -1),
        revisionCount: state.revisionCount + 1,
      }
    }

    case 'CLEAR_ALL': {
      return {
        ...initialState,
      }
    }

    default:
      return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState)

  const value = { ...state, dispatch }

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

/**
 * Hook to consume SessionContext.
 * @returns {SessionContextValue}
 */
export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within a <SessionProvider>')
  return ctx
}

export default SessionContext
