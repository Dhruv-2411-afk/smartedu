const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

export async function checkAtsResume(profile, jobDescription = '') {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/api/ats/check`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, job_description: jobDescription }),
    })
  } catch {
    throw new Error('ATS checker is offline. Start python server\\app.py, then try again.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'ATS analysis could not be completed.')
  return data
}
