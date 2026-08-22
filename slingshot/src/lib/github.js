const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

export function githubUsername(value = '') {
  const text = value.trim().replace(/\/+$/, '')
  if (!text) return null
  const match = text.match(/github\.com\/([^/?#]+)/i)
  return (match ? match[1] : text.replace(/^@/, '')).trim() || null
}

export async function fetchGithubAnalytics(username) {
  const response = await fetch(`${API_BASE_URL}/api/github/${encodeURIComponent(username)}`)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'GitHub analytics could not be loaded right now.')
  return payload
}
