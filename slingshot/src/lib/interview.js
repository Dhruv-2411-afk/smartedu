const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

async function requestInterview(path, body) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Interview service is offline. Run python server\\app.py in a second terminal, then try again.')
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'The mock interview service is unavailable.')
  return payload
}

export async function generateMockInterview(profile) {
  const payload = await requestInterview('/api/interviews/generate', { profile })
  if (!Array.isArray(payload.questions) || payload.questions.length !== 2) throw new Error('The interview service returned an invalid question set.')
  return payload.questions
}

export async function evaluateMockAnswer(profile, question, answer) {
  const payload = await requestInterview('/api/interviews/evaluate', { profile, question, answer })
  return payload.evaluation
}
