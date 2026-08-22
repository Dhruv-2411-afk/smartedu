const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

export async function generateCareerRoadmap(profile) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/api/roadmaps/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    })
  } catch {
    throw new Error('Roadmap service is offline. Run python server\\app.py, then try again.')
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to generate your roadmap.')
  if (!Array.isArray(payload.phases) || !Array.isArray(payload.edges)) throw new Error('Roadmap service returned an invalid plan.')
  return payload
}
