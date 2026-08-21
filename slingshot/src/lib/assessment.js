const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

export async function generateSkillAssessment(profile, skill, questionCount = 5) {
  const response = await fetch(`${API_BASE_URL}/api/assessments/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, skill, questionCount }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to generate the assessment. Please try again.')
  if (!Array.isArray(payload.questions) || !payload.questions.length) throw new Error('The assessment service returned no questions.')
  return payload.questions
}

export function learningResourceFor(skill) {
  const key = skill.toLowerCase()
  if (/react/.test(key)) return { label: 'React Learn', url: 'https://react.dev/learn' }
  if (/javascript|typescript/.test(key)) return { label: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' }
  if (/python/.test(key)) return { label: 'Python Tutorial', url: 'https://docs.python.org/3/tutorial/' }
  if (/sql|database|postgres|mysql/.test(key)) return { label: 'SQLBolt', url: 'https://sqlbolt.com/' }
  if (/node|express/.test(key)) return { label: 'Node.js Learn', url: 'https://nodejs.org/en/learn' }
  if (/java/.test(key)) return { label: 'dev.java Learn', url: 'https://dev.java/learn/' }
  return { label: 'freeCodeCamp', url: 'https://www.freecodecamp.org/learn/' }
}
