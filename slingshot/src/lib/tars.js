const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

export async function askTars(message, context, history = []) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/api/tars/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context, history }),
    })
  } catch {
    throw new Error('TARS is offline. Start python server\\app.py, then try again.')
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'TARS could not answer right now.')
  return payload.reply
}
