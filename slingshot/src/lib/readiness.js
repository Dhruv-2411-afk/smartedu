const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

const COMPANY_NAMES = ['Microsoft', 'Google', 'Razorpay', 'Zoho']

export async function scoreCompanyReadiness(profile, companies = COMPANY_NAMES) {
  let healthResponse
  try {
    healthResponse = await fetch(`${API_BASE_URL}/api/health`)
  } catch {
    throw new Error('Company matching service is offline. Run python server\\app.py, then try again.')
  }
  const health = await healthResponse.json().catch(() => ({}))
  if (!healthResponse.ok || health.service !== 'slingshot-assessment-api' || health.version !== 'readiness-v2') {
    throw new Error(`The service at ${API_BASE_URL} is not the updated Slingshot API. Stop the process on port 3000, then run python server\\app.py.`)
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}/api/readiness/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `company` keeps this compatible with the original single-company
      // route while `companies` enables the CDC to rank several companies.
      body: JSON.stringify({ profile, company: companies[0], companies }),
    })
  } catch {
    throw new Error('Company matching service is offline. Run python server\\app.py, then try again.')
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to score company readiness right now.')
  // Support the bulk contract (`results`) and the earlier single-company
  // contract while the backend is being upgraded.
  const results = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.results)
      ? payload.results
      : Array.isArray(payload.matches)
        ? payload.matches
        : payload.company && payload.readiness_score !== undefined
          ? [payload]
          : null
  if (!results) {
    const detail = typeof payload.error === 'string' ? payload.error : 'The API did not include company results.'
    throw new Error(`Company matching response is invalid: ${detail}`)
  }

  return results.map((result, index) => {
    const score = Number(result.readiness_score)
    if (!Number.isFinite(score)) throw new Error(`The match score for ${companies[index]} is invalid.`)
    return {
      company: result.company || companies[index],
      score: Math.max(0, Math.min(100, Math.round(score))),
      tier: result.category || 'Developing',
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      missingSkills: Array.isArray(result.missing_skills) ? result.missing_skills : [],
      nextSteps: Array.isArray(result.recommended_next_steps) ? result.recommended_next_steps : [],
      summary: result.summary || 'No summary was returned for this company.',
    }
  }).sort((a, b) => b.score - a.score)
}
