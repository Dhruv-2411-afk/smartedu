const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
export async function curateResources(topic, level) {
  const response = await fetch(`${API_BASE_URL}/api/resources/curate`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({topic,level}) })
  const payload = await response.json().catch(()=>({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to find resources.')
  return payload
}
