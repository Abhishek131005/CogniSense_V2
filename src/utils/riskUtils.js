/**
 * src/utils/riskUtils.js
 *
 * Helpers for converting CDT risk scores to display values.
 */

/**
 * Get the risk class (0–5) from a score (0–100).
 * Implements fine-grained 6-class system for better clinical discrimination.
 * @param {number} score
 * @returns {0|1|2|3|4|5}
 */
export function getRiskClass(score) {
  if (score < 21) return 0   // 0-20:   Cognitively Normal
  if (score < 41) return 1   // 21-40:  Worried Well
  if (score < 56) return 2   // 41-55:  Early MCI
  if (score < 71) return 3   // 56-70:  Moderate MCI
  if (score < 86) return 4   // 71-85:  Mild Dementia
  return 5                   // 86-100: Severe - Urgent Referral
}

/**
 * Get the display label for a risk class (name only, no class prefix).
 * @param {0|1|2|3|4|5} riskClass
 * @returns {string}
 */
export function getRiskLabel(riskClass) {
  const labels = [
    'Cognitively Normal',
    'Worried Well',
    'Early MCI',
    'Moderate MCI',
    'Mild Dementia',
    'Severe — Urgent Referral',
  ]
  return labels[Math.min(5, Math.max(0, riskClass))]
}

/**
 * Get the CSS color variable name for a risk class.
 * @param {0|1|2|3|4|5} riskClass
 * @returns {string} CSS variable name
 */
export function getRiskColorVar(riskClass) {
  const colors = [
    '--risk-low',
    '--risk-worried-well',
    '--risk-early-mci',
    '--risk-moderate-mci',
    '--risk-mild-dementia',
    '--risk-critical',
  ]
  return colors[Math.min(5, Math.max(0, riskClass))]
}

/**
 * Get the hex color for a risk class.
 * @param {0|1|2|3|4|5} riskClass
 * @returns {string} hex color
 */
export function getRiskColor(riskClass) {
  const colors = [
    '#5C8F68',   // Class 0: Cognitively Normal (Green)
    '#D4B563',   // Class 1: Worried Well (Light Amber)
    '#D9A23C',   // Class 2: Early MCI (Orange-Yellow)
    '#D27F2B',   // Class 3: Moderate MCI (Dark Orange)
    '#C85D3C',   // Class 4: Mild Dementia (Orange-Red)
    '#B04040',   // Class 5: Severe (Red)
  ]
  return colors[Math.min(5, Math.max(0, riskClass))]
}

/**
 * Get the Tailwind class name for risk color text.
 * @param {0|1|2|3|4|5} riskClass
 * @returns {string}
 */
export function getRiskTextClass(riskClass) {
  const classes = [
    'text-risk-low',
    'text-risk-worried-well',
    'text-risk-early-mci',
    'text-risk-moderate-mci',
    'text-risk-mild-dementia',
    'text-risk-critical',
  ]
  return classes[Math.min(5, Math.max(0, riskClass))]
}

/**
 * Get the short badge label for a risk class.
 * @param {0|1|2|3|4|5} riskClass
 * @returns {string}
 */
export function getRiskBadgeLabel(riskClass) {
  const labels = ['Normal', 'Worried Well', 'Early MCI', 'Moderate MCI', 'Mild Dementia', 'Severe']
  return labels[Math.min(5, Math.max(0, riskClass))]
}

/**
 * Get the clinical stage description for a risk class.
 * @param {0|1|2|3|4|5} riskClass
 * @returns {string}
 */
export function getClinicalStage(riskClass) {
  const stages = [
    'Baseline health',
    'Subjective concerns only',
    'Mild cognitive decline',
    'Clear cognitive impairment',
    'Dementia likely',
    'Immediate specialist referral needed',
  ]
  return stages[Math.min(5, Math.max(0, riskClass))]
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
