import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

/**
 * Parse a resume file (PDF or DOCX) and extract structured data.
 * Returns an object with fields matching the profile form.
 */
export async function parseResume(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  let text = ''

  if (ext === 'pdf') {
    text = await extractPdfText(file)
  } else if (ext === 'docx' || ext === 'doc') {
    text = await extractDocxText(file)
  } else {
    throw new Error('Unsupported file format. Please upload a PDF or DOCX file.')
  }

  return extractFields(text)
}

// ── PDF text extraction ──────────────────────────────────
async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((item) => item.str).join(' ')
    pages.push(pageText)
  }

  return pages.join('\n')
}

// ── DOCX text extraction ─────────────────────────────────
async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

// ── Field extraction from raw text ───────────────────────
function extractFields(text) {
  const fields = {}

  // Email
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i)
  if (emailMatch) fields.email = emailMatch[0]

  // Phone (Indian & international)
  const phoneMatch = text.match(/(?:\+?\d{1,3}[\s\-]?)?\(?\d{2,5}\)?[\s\-]?\d{3,5}[\s\-]?\d{3,5}/)
  if (phoneMatch) {
    const cleaned = phoneMatch[0].replace(/[^\d+\-\s()]/g, '').trim()
    if (cleaned.replace(/\D/g, '').length >= 10) fields.phone = cleaned
  }

  // Name — heuristic: first non-empty line that isn't an email/phone/URL
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean)
  for (const line of lines.slice(0, 5)) {
    const clean = line.replace(/\s+/g, ' ').trim()
    if (
      clean.length > 2 && clean.length < 60 &&
      !clean.includes('@') && !clean.match(/^\+?\d/) &&
      !clean.match(/^https?:/) && !clean.match(/resume|curriculum|cv|portfolio/i)
    ) {
      // Check if it looks like a person's name (mostly alpha + spaces)
      if (/^[A-Za-z\s.\-']+$/.test(clean) && clean.split(/\s+/).length <= 5) {
        fields.name = clean
        break
      }
    }
  }

  // Location — look for city patterns near contact section
  const locationPatterns = [
    /(?:address|location|city|based in|residing)[:\s]*([A-Za-z\s,]+(?:India|USA|UK|Canada|Australia)?)/i,
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s*(?:[-–]\s*\d{6})?/,
  ]
  for (const pat of locationPatterns) {
    const m = text.match(pat)
    if (m) {
      fields.location = (m[1] || m[0]).replace(/\s+/g, ' ').trim().slice(0, 60)
      break
    }
  }

  // LinkedIn
  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/i)
  if (linkedinMatch) fields.linkedin = linkedinMatch[0]

  // GitHub
  const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9\-_]+/i)
  if (githubMatch) fields.github = githubMatch[0]

  // Portfolio
  const portfolioMatch = text.match(/(?:portfolio|website|site)[:\s]*(https?:\/\/[^\s,]+)/i)
  if (portfolioMatch) fields.portfolio = portfolioMatch[1]

  // Education — degree detection
  const degreePatterns = [
    /\b(B\.?Tech|B\.?E\.?|B\.?Sc|B\.?C\.?A|M\.?Tech|M\.?B\.?A|M\.?Sc|M\.?C\.?A|Ph\.?D|B\.?Com|M\.?Com|B\.?A|M\.?A)\b/i
  ]
  for (const pat of degreePatterns) {
    const m = text.match(pat)
    if (m) { fields.education = m[1]; break }
  }

  // University — look near education section
  const uniPatterns = [
    /(?:university|college|institute|school|iit|nit|iiit|bits)[:\s]*(?:of\s)?([A-Za-z\s,]+)/i,
    /((?:Indian Institute|National Institute|Birla Institute|VIT|SRM|Amity|Chandigarh|Punjab|Delhi|Mumbai|Pune|Bangalore)[A-Za-z\s,]*)/i,
  ]
  for (const pat of uniPatterns) {
    const m = text.match(pat)
    if (m) {
      fields.university = m[1]?.replace(/\s+/g, ' ').trim().slice(0, 100) || m[0]?.trim()
      break
    }
  }

  // Graduation year
  const gradMatch = text.match(/(?:graduat|expected|batch|passing|class of)[^\d]*(\d{4})/i)
  if (gradMatch) {
    const yr = parseInt(gradMatch[1])
    if (yr >= 2015 && yr <= 2030) fields.graduation = String(yr)
  }

  // Skills — extract from "Skills" section or common tech keywords
  const skillsSection = text.match(/(?:skills|technical skills|technologies|tech stack)[:\s\-]*([\s\S]{20,600}?)(?:\n\s*\n|(?:experience|education|project|certification|achievement|award|extra))/i)
  if (skillsSection) {
    fields.skills = skillsSection[1]
      .replace(/[\n\r]+/g, ', ')
      .replace(/[•·\-|]/g, ',')
      .replace(/,\s*,+/g, ', ')
      .replace(/^\s*,\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()
  } else {
    // Fallback: look for common programming terms
    const techKeywords = [
      'JavaScript', 'Python', 'Java', 'C\\+\\+', 'C#', 'TypeScript', 'React', 'Angular',
      'Vue', 'Node\\.js', 'Express', 'Django', 'Flask', 'Spring', 'SQL', 'MongoDB',
      'PostgreSQL', 'MySQL', 'AWS', 'Azure', 'Docker', 'Kubernetes', 'Git', 'HTML',
      'CSS', 'REST', 'GraphQL', 'TensorFlow', 'PyTorch', 'Machine Learning', 'DSA',
      'Data Structures', 'Algorithms', 'Linux', 'Firebase', 'Tailwind', 'Next\\.js',
      'Flutter', 'Swift', 'Kotlin', 'Go', 'Rust', 'PHP', 'Ruby', 'R\\b', 'MATLAB',
      'Figma', 'Photoshop', 'Power BI', 'Tableau'
    ]
    const found = []
    for (const kw of techKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i')
      if (regex.test(text)) {
        // Normalize display
        const display = kw.replace(/\\\+/g, '+').replace(/\\\./g, '.').replace(/\\b/g, '')
        if (!found.includes(display)) found.push(display)
      }
    }
    if (found.length > 0) fields.skills = found.join(', ')
  }

  // Projects / experience highlights
  const projSection = text.match(/(?:projects?|experience|work experience|internship)[:\s\-]*([\s\S]{30,800}?)(?:\n\s*\n|(?:education|skills|certif|achiev|award|extra|hobbi))/i)
  if (projSection) {
    fields.projects = projSection[1]
      .replace(/[\n\r]+/g, '\n')
      .replace(/[•·]/g, '- ')
      .trim()
      .slice(0, 500)
  }

  // Certifications
  const certSection = text.match(/(?:certif|licenses?)[:\s\-]*([\s\S]{15,500}?)(?:\n\s*\n|(?:education|skills|project|experience|achiev|award|extra|hobbi))/i)
  if (certSection) {
    fields.certifications = certSection[1]
      .replace(/[\n\r]+/g, '\n')
      .replace(/[•·]/g, '- ')
      .trim()
      .slice(0, 400)
  }

  // Languages
  const langSection = text.match(/(?:languages?\s*(?:known|spoken|proficiency)?)[:\s\-]*([\s\S]{5,200}?)(?:\n\s*\n|(?:education|skills|project|experience|certif|achiev|hobbi))/i)
  if (langSection) {
    fields.languages = langSection[1]
      .replace(/[\n\r]+/g, ', ')
      .replace(/[•·\-|]/g, ',')
      .replace(/,\s*,+/g, ', ')
      .replace(/^\s*,\s*/, '')
      .trim()
  }

  // Professional headline — auto-generate from degree + skills
  if (!fields.headline && (fields.education || fields.skills)) {
    const parts = []
    if (fields.education) parts.push(`${fields.education} Student`)
    if (fields.skills) {
      const topSkills = fields.skills.split(',').slice(0, 2).map(s => s.trim()).filter(Boolean)
      if (topSkills.length) parts.push(topSkills.join(' & ') + ' Developer')
    }
    fields.headline = parts.join(' | ')
  }

  return fields
}
