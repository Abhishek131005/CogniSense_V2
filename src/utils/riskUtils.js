/**
 * src/utils/riskUtils.js
 *
 * Helpers for converting CDT risk scores to display values.
 */

/**
 * Get the risk class (0–3) from a score (0–100).
 * @param {number} score
 * @returns {0|1|2|3}
 */
export function getRiskClass(score) {
  if (score < 30) return 0
  if (score < 50) return 1
  if (score < 70) return 2
  return 3
}

/**
 * Get the display label for a risk class.
 * @param {0|1|2|3} riskClass
 * @returns {string}
 */
export function getRiskLabel(riskClass) {
  const labels = [
    'Cognitively Normal',
    'Subjective Cognitive Decline',
    'Mild Cognitive Impairment',
    'High Risk — Urgent Referral',
  ]
  return labels[Math.min(3, Math.max(0, riskClass))]
}

/**
 * Get the CSS color variable name for a risk class.
 * @param {0|1|2|3} riskClass
 * @returns {string} CSS variable name
 */
export function getRiskColorVar(riskClass) {
  const colors = ['--risk-low', '--risk-medium', '--risk-high', '--risk-critical']
  return colors[Math.min(3, Math.max(0, riskClass))]
}

/**
 * Get the hex color for a risk class.
 * @param {0|1|2|3} riskClass
 * @returns {string} hex color
 */
export function getRiskColor(riskClass) {
  const colors = ['#5C8F68', '#C4A84F', '#C47A3A', '#B04040']
  return colors[Math.min(3, Math.max(0, riskClass))]
}

/**
 * Get the Tailwind class name for risk color text.
 * @param {0|1|2|3} riskClass
 * @returns {string}
 */
export function getRiskTextClass(riskClass) {
  const classes = [
    'text-risk-low',
    'text-risk-medium',
    'text-risk-high',
    'text-risk-critical',
  ]
  return classes[Math.min(3, Math.max(0, riskClass))]
}

/**
 * Get the short badge label for a risk class.
 * @param {0|1|2|3} riskClass
 * @returns {string}
 */
export function getRiskBadgeLabel(riskClass) {
  const labels = ['Normal', 'SCD', 'MCI', 'High Risk']
  return labels[Math.min(3, Math.max(0, riskClass))]
}

/**
 * Compute a normalized 0–100 value for progress bar display.
 * @param {number} value
 * @param {number} max
 * @returns {number} clamped 0–100
 */
export function toPercent(value, max) {
  if (max === 0) return 0
  return Math.min(100, Math.max(0, (value / max) * 100))
}
