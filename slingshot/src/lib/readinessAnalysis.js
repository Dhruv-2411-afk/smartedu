const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
export async function analyzeReadiness(activity) {
  const response = await fetch(`${API_BASE_URL}/api/readiness/analyze`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activity})})
  const payload=await response.json().catch(()=>({}))
  if(!response.ok) throw new Error(payload.error || 'Unable to analyze readiness.')
  return payload
}
