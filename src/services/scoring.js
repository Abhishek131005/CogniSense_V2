/**
 * src/services/scoring.js
 *
 * CDT Assessment Scoring Service.
 *
 * Priority:
 *  1. If VITE_ML_API_URL is set → calls the FastAPI backend (real ML score)
 *  2. Otherwise → falls back to the heuristic mock (development / offline mode)
 *
 * FastAPI endpoint: POST {VITE_ML_API_URL}/api/score/cdt
 * Payload:  { imageBase64: string, features: DynamicFeatures }
 * Response: { cdtRiskScore, riskClass, riskLabel, flags, recommendation, breakdown }
 */

const ML_API_URL = import.meta.env.VITE_ML_API_URL

// ── Helper: derive flag strings (mock fallback only) ─────────────────────────

function derivedFlags(features) {
  const flags = []
  if (features.pauseCount >= 3)
    flags.push('Elevated pause frequency — planning hesitation')
  if (features.totalPauseDurationMs > 8000)
    flags.push('High total pause duration — executive dysfunction')
  if (features.revisionCount >= 3)
    flags.push('High revision count — visuospatial uncertainty')
  if (features.meanStrokeVelocity < 30)
    flags.push('Low stroke velocity — reduced motor fluency')
  if (features.velocityStdDev > 50)
    flags.push('High velocity variability — inconsistent motor control')
  if (features.strokeCount < 6)
    flags.push('Low stroke count — possible incomplete drawing')
  if (features.totalDurationMs > 180_000)
    flags.push('Prolonged drawing duration — possible cognitive slowing')
  return flags.slice(0, 3)
}

function derivedRecommendation(score) {
  if (score < 25)
    return 'Cognitive performance within normal range. No immediate action required. Recommend routine annual screening.'
  if (score < 45)
    return 'Mild subjective cognitive concerns detected. Recommend cognitive health counseling and lifestyle review.'
  if (score < 65)
    return 'Mild Cognitive Impairment indicators present. Recommend referral to neuropsychology for comprehensive assessment.'
  return 'High cognitive risk detected. Urgent referral to a neurologist is recommended. Consider neuroimaging evaluation.'
}

// ── Main scoring function ─────────────────────────────────────────────────────

/**
 * Score a CDT assessment.
 *
 * @param {object} features    — from featureComputer.computeFeatures()
 * @param {string} imageBase64 — base64 PNG data URL of the drawing
 * @returns {Promise<ScoringResult>}
 */
export async function scoreCDTAssessment(features, imageBase64) {

  // ── Path 1: Real FastAPI ML backend ─────────────────────────────────────────
  if (ML_API_URL && ML_API_URL.trim() !== '') {
    try {
      const response = await fetch(`${ML_API_URL}/api/score/cdt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, features }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`API returned ${response.status}: ${errText}`)
      }

      const result = await response.json()
      console.info('[Scoring] Used real FastAPI ML backend:', result.breakdown)
      return result

    } catch (err) {
      console.error('[Scoring] FastAPI call failed, falling back to mock:', err.message)
      // Fall through to mock below
    }
  }

  // ── Path 2: Mock heuristic scoring (fallback / development) ─────────────────
  console.warn('[Scoring] Using mock heuristic scorer. Set VITE_ML_API_URL in .env to enable real ML.')
  await new Promise(r => setTimeout(r, 1500)) // simulate latency

  const pauseScore    = Math.min(40, features.pauseCount * 8)
  const revisionScore = Math.min(24, features.revisionCount * 6)
  const durationScore = Math.min(20, (features.totalDurationMs / 1000) * 0.3)
  const velocityScore = features.meanStrokeVelocity < 20 ? 10 : 0
  const noise         = Math.random() * 8

  const rawScore = pauseScore + revisionScore + durationScore + velocityScore + noise
  const score    = Math.min(100, Math.max(0, rawScore))
  const rounded  = Math.round(score * 10) / 10

  const riskClass  = score < 25 ? 0 : score < 50 ? 1 : score < 70 ? 2 : 3
  const riskLabels = [
    'Cognitively Normal',
    'Subjective Cognitive Decline',
    'Mild Cognitive Impairment',
    'High Risk — Urgent Referral',
  ]

  return {
    cdtRiskScore:   rounded,
    riskClass,
    riskLabel:      riskLabels[riskClass],
    flags:          derivedFlags(features),
    recommendation: derivedRecommendation(rounded),
  }
}


