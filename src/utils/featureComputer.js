/**
 * src/utils/featureComputer.js
 *
 * Pure functions for computing CDT dynamic features from stroke data.
 * No React dependencies — can be called from any context.
 */

// ── Stroke-level computations ─────────────────────────────────────────────────

/**
 * Compute the pixel length of a stroke (sum of distances between consecutive points).
 * @param {{ x: number, y: number }[]} points
 * @returns {number} total pixel length
 */
export function computeStrokePixelLength(points) {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    total += Math.sqrt(dx * dx + dy * dy)
  }
  return total
}

/**
 * Compute velocity (pixels per second) for a single stroke.
 * @param {{ points: { x, y, t }[], durationMs: number }} stroke
 * @returns {number} velocity in px/s
 */
export function computeStrokeVelocity(stroke) {
  if (!stroke.durationMs || stroke.durationMs === 0) return 0
  const pixelLength = computeStrokePixelLength(stroke.points)
  return (pixelLength / stroke.durationMs) * 1000 // px/s
}

// ── Statistical helpers ───────────────────────────────────────────────────────

function mean(arr) {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function stdDev(arr) {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const variance = arr.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / arr.length
  return Math.sqrt(variance)
}

// ── Main feature computation ──────────────────────────────────────────────────

/**
 * Compute all dynamic features from stroke and pause event data.
 * Matches the schema in PRD section 4.3.
 *
 * @param {Stroke[]}     strokes         — array of stroke objects
 * @param {PauseEvent[]} pauseEvents     — array of pause event objects
 * @param {number}       totalDurationMs — time from first to last stroke
 * @returns {Features}
 */
export function computeFeatures(strokes, pauseEvents, totalDurationMs) {
  const strokeCount = strokes.length
  const revisionCount = strokes.reduce((n, s) => n + (s.isRevision ? 1 : 0), 0)

  // Velocities per stroke
  const velocities = strokes.map(s => computeStrokeVelocity(s))
  const meanStrokeVelocity = mean(velocities)
  const velocityStdDev     = stdDev(velocities)

  // Pause stats
  const pauseCount          = pauseEvents.length
  const totalPauseDurationMs = pauseEvents.reduce((sum, p) => sum + p.durationMs, 0)
  const meanPauseDurationMs  = pauseCount > 0 ? totalPauseDurationMs / pauseCount : 0

  return {
    totalDurationMs:    Math.round(totalDurationMs),
    strokeCount,
    revisionCount,
    meanStrokeVelocity: Math.round(meanStrokeVelocity * 10) / 10,
    velocityStdDev:     Math.round(velocityStdDev * 10) / 10,
    totalPauseDurationMs: Math.round(totalPauseDurationMs),
    pauseCount,
    meanPauseDurationMs: Math.round(meanPauseDurationMs),
  }
}

/**
 * Derive human-readable flag strings from computed features.
 * @param {Features} features
 * @returns {string[]}
 */
export function deriveFlags(features) {
  const flags = []

  if (features.pauseCount >= 3) {
    flags.push('Elevated pause frequency — planning hesitation')
  }
  if (features.totalPauseDurationMs > 8000) {
    flags.push('High total pause duration — executive dysfunction')
  }
  if (features.revisionCount >= 3) {
    flags.push('High revision count — visuospatial uncertainty')
  }
  if (features.meanStrokeVelocity < 30 && features.strokeCount > 0) {
    flags.push('Low stroke velocity — reduced motor fluency')
  }
  if (features.velocityStdDev > 50) {
    flags.push('High velocity variability — inconsistent motor control')
  }
  if (features.totalDurationMs > 180_000) {
    flags.push('Prolonged drawing duration — possible cognitive slowing')
  }

  return flags
}
