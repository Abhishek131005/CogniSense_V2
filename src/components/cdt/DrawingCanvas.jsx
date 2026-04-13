/**
 * src/components/cdt/DrawingCanvas.jsx
 *
 * Core HTML5 Canvas drawing component.
 * - Pre-draws a clock circle on mount
 * - Handles pointer events for stroke recording
 * - Dispatches to SessionContext
 * - Supports undo (full redraw from stroke history)
 * - touch-action: none prevents page scroll during drawing
 */

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useSession } from '../../context/SessionContext'

const CLOCK_RADIUS_RATIO = 0.40  // clock circle = 40% of canvas width
const STROKE_COLOR       = '#1C1C18'
const STROKE_WIDTH       = 2.2
const CLOCK_CIRCLE_COLOR = '#C8C4B8'
const CLOCK_CIRCLE_WIDTH = 1.5

/**
 * Draw a smooth quadratic bezier stroke from an array of points.
 */
function drawStroke(ctx, points) {
  if (!points || points.length === 0) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)

  if (points.length === 1) {
    // Single dot
    ctx.arc(points[0].x, points[0].y, STROKE_WIDTH / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2
    const my = (points[i].y + points[i + 1].y) / 2
    ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my)
  }

  // Last point
  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
}

/**
 * Draw the pre-printed clock circle outline in the center of the canvas.
 */
function drawClockOutline(ctx, width, height) {
  const cx = width / 2
  const cy = height / 2
  const r  = Math.min(width, height) * CLOCK_RADIUS_RATIO

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = CLOCK_CIRCLE_COLOR
  ctx.lineWidth   = CLOCK_CIRCLE_WIDTH
  ctx.stroke()
  ctx.restore()
}

/**
 * Fully redraw all strokes from the session state (used after undo).
 */
function redrawAll(ctx, canvas, strokes) {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawClockOutline(ctx, canvas.width, canvas.height)

  ctx.strokeStyle = STROKE_COLOR
  ctx.lineWidth   = STROKE_WIDTH
  ctx.lineCap     = 'round'
  ctx.lineJoin    = 'round'
  ctx.fillStyle   = STROKE_COLOR

  for (const stroke of strokes) {
    drawStroke(ctx, stroke.points)
  }
}

/**
 * Convert pointer event coords to canvas-local coords,
 * accounting for CSS scaling (canvas may be displayed smaller than its actual resolution).
 */
function getCanvasPoint(e, canvas) {
  const rect  = canvas.getBoundingClientRect()
  const scaleX = canvas.width  / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top)  * scaleY,
    pressure: e.pressure ?? 0.5,
    t: Date.now(),
  }
}

export const DrawingCanvas = forwardRef(function DrawingCanvas(
  { onFirstStroke },
  ref
) {
  const canvasRef   = useRef(null)
  const ctxRef      = useRef(null)
  const isPointerDown = useRef(false)
  const { strokes, dispatch } = useSession()

  // Expose canvas ref to parent (for export)
  useImperativeHandle(ref, () => canvasRef.current, [])

  // Initialize canvas and draw clock outline on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Set internal resolution (high-DPI)
    const size = Math.min(canvas.offsetWidth, 600)
    canvas.width  = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    ctxRef.current = ctx

    ctx.strokeStyle = STROKE_COLOR
    ctx.lineWidth   = STROKE_WIDTH
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.fillStyle   = STROKE_COLOR

    drawClockOutline(ctx, canvas.width, canvas.height)
  }, [])

  // Redraw whenever strokes change (undo support)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = ctxRef.current
    if (!canvas || !ctx) return
    redrawAll(ctx, canvas, strokes)
  }, [strokes])

  // ── Pointer event handlers ─────────────────────────────────────────────────

  const handlePointerDown = useCallback((e) => {
    e.preventDefault()
    isPointerDown.current = true
    canvasRef.current.setPointerCapture(e.pointerId)

    const point = getCanvasPoint(e.nativeEvent, canvasRef.current)
    dispatch({ type: 'START_STROKE', payload: { point, timestamp: point.t } })

    if (onFirstStroke) onFirstStroke()

    // Immediately draw a dot or start path
    const ctx = ctxRef.current
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(point.x, point.y)
    }
  }, [dispatch, onFirstStroke])

  const handlePointerMove = useCallback((e) => {
    if (!isPointerDown.current) return
    e.preventDefault()

    const point = getCanvasPoint(e.nativeEvent, canvasRef.current)
    dispatch({ type: 'ADD_POINT', payload: { point } })

    // Render immediately to canvas for real-time feedback
    const ctx = ctxRef.current
    if (ctx) {
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
    }
  }, [dispatch])

  const handlePointerUp = useCallback((e) => {
    if (!isPointerDown.current) return
    isPointerDown.current = false

    const timestamp = Date.now()
    dispatch({ type: 'END_STROKE', payload: { timestamp } })
  }, [dispatch])

  const handlePointerLeave = useCallback((e) => {
    if (isPointerDown.current) {
      handlePointerUp(e)
    }
  }, [handlePointerUp])

  return (
    <div className="canvas-wrapper" style={{ cursor: 'crosshair' }}>
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        id="cdt-drawing-canvas"
        aria-label="Clock drawing canvas — use a stylus or mouse to draw"
        role="img"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        // Prevent context menu on long-press on mobile
        onContextMenu={e => e.preventDefault()}
      />
    </div>
  )
})

export default DrawingCanvas
