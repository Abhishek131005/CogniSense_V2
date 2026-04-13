/**
 * src/utils/formatters.js
 *
 * Formatting helpers for time, numbers, and IDs.
 */

/**
 * Format milliseconds as MM:SS.
 * @param {number} ms
 * @returns {string} e.g. "02:34"
 */
export function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Format milliseconds as a human-readable string.
 * @param {number} ms
 * @returns {string} e.g. "2m 34s" or "45s"
 */
export function formatDurationHuman(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  if (seconds === 0) return `${minutes}m`
  return `${minutes}m ${seconds}s`
}

/**
 * Format a velocity value (px/s).
 * @param {number} velocity
 * @returns {string} e.g. "84.2 px/s"
 */
export function formatVelocity(velocity) {
  return `${velocity.toFixed(1)} px/s`
}

/**
 * Format a date as "DD Mon YYYY".
 * @param {Date|string} date
 * @returns {string} e.g. "30 Mar 2026"
 */
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Format a Date as a relative time string.
 * @param {Date|string} date
 * @returns {string} e.g. "3 days ago"
 */
export function formatRelative(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d)) return '—'
  const now = new Date()
  const diffMs = now - d
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

/**
 * Format a patient ID for display (uppercase, monospace).
 * @param {string} id
 * @returns {string}
 */
export function formatPatientId(id) {
  return id ? id.toUpperCase() : '—'
}

/**
 * Format a risk score for display.
 * @param {number} score
 * @returns {string} e.g. "62.4"
 */
export function formatScore(score) {
  return typeof score === 'number' ? score.toFixed(1) : '—'
}
