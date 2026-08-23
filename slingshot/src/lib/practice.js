const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
async function request(path, options = {}) { const response = await fetch(`${BASE}${path}`, options); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || 'Request failed.'); return payload }
export const getQuestions = (difficulty = '') => request(`/api/questions?source=bank${difficulty ? `&difficulty=${difficulty}` : ''}`)
export const getCodeforces = (difficulty = '') => request(`/api/codeforces-problems${difficulty ? `?difficulty=${difficulty}` : ''}`)
export const runCode = (data) => request('/api/run-code', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
export const getDebugHelp = (data) => request('/api/debug-help', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
