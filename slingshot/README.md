# Slingshot CareerOS

Slingshot is an AI-assisted **Career Command Center (CDC)** for students, freshers, and early-career software-engineering candidates. It turns a resume and career preferences into a living profile, then connects assessment, interview practice, readiness, applications, coding practice, GitHub evidence, and targeted career guidance in one workspace.

> **Pitch:** Slingshot helps candidates move from *claimed potential* to *verified job readiness* by combining their resume, skills, practice evidence, interview performance, and public GitHub work into clear next actions.

## Product flow

```text
Email login / email verification
        ↓
Resume upload (PDF, DOC, DOCX) + profile form
        ↓
Resume text extraction and structured profile creation
        ↓
Career Command Center
        ├── Overview and evidence-based readiness
        ├── Skills and verification quizzes
        ├── Coding Practice
        ├── ATS Resume Checker
        ├── Roadmap and Resources
        ├── Company Matches and Applications
        ├── AI Mock Interviews
        ├── GitHub Analytics
        └── TARS career copilot
```

### New and returning users

1. A new user signs in through email/password and lands on the resume/profile setup page.
2. Resume extraction plus the form create the only profile source used by the CDC.
3. A returning user signs in and sees their user-specific CDC profile.
4. **Update Resume** opens the same original upload/form flow. New extraction begins from blank fields, preventing old resume data from leaking into the refreshed profile.
5. The refreshed profile drives skills, company matches, ATS inputs, GitHub URL, and all profile-aware sections.

## Features

### Authentication

- **Supabase Auth** provides email/password sign-up, verification, sign-in, password reset, and sign-out.
- Supabase redirect URLs return the candidate to the deployed app after email actions.

### Resume and profile builder

- Uploads PDF, DOC, and DOCX files.
- Browser-side extraction identifies name, email, phone, location, education, graduation year, skills, projects, certifications, languages, LinkedIn, GitHub, and portfolio links when present.
- The candidate can correct every extracted field before entering the CDC.

### Career Command Center / Overview

- Shows current evidence-based readiness, verified skills, skill gaps, upcoming roadmap tasks, and the active application pipeline.
- The design uses a warm cream background with soft lavender, blush, and green pastel accents.

### Skills and verification

- Builds skills from the saved profile.
- Each skill is **Claimed**, **Verified**, or **Needs practice**.
- AI creates tailored multiple-choice technical quizzes.
- A score of 70% or higher verifies the skill; failed attempts receive a learning direction before retrying.

### Evidence-based readiness

Readiness deliberately does **not** use resume claims. The current deterministic formula is:

| Evidence | Weight |
| --- | ---: |
| Roadmap completion | 25% |
| Verified quiz/coding results | 30% |
| Mock interview performance | 45% |

- Missing evidence adds zero.
- A new candidate starts at 0% with low confidence rather than receiving an invented high score.
- The readiness page shows per-track status, verified evidence, weak areas, next actions, and interview trend.

### Personalized roadmap

- Uses current skills, level, target role, and available time.
- Generates phase-based preparation for DSA, CN, OS, System Design, Fullstack, and Aptitude where relevant.
- DSA tracks contain measurable LeetCode targets.
- The UI is a readable phase selector/detail reader rather than a hard-to-navigate graph.
- A deterministic fallback roadmap is returned if a model output is invalid.

### General Resources

- Separate left-panel page for direct general learning links.
- Includes DSA, LeetCode, system design, full-stack, CS fundamentals, and aptitude resources.
- The page is deliberately separate from Roadmap and does not call an LLM or live search when opened.

### Company readiness matching

- Ranks selected companies against the current profile.
- Shows a match score, tier, missing skills, strengths, summary, and next steps.

### Applications

- Add an application with company, role, current stage, and optional job link.
- Update stages: Applied, Screening, Interview, Offer, and Rejected.
- Displays live stage totals and context-aware pipeline advice instead of hardcoded rejection claims.

### AI mock interview environment

- Generates resume-aware project and technical questions.
- Supports camera/microphone permissions, browser speech recognition, countdowns, answer phases, and typed fallback.
- Uses MediaPipe face detection and warns for multiple faces, no face, and switching browser tabs.
- Evaluates technical accuracy, communication, relevance, understanding depth, confidence, strengths, weaknesses, and improvement actions.

### GitHub Analytics

- Uses the GitHub link from the saved profile.
- A Flask proxy, not the browser, calls GitHub and caches results for 10 minutes.
- Displays public repositories, descriptions, languages, stars, forks, public commits, public open-source activity, and branch count across up to 20 active public repositories.
- Private repositories and private contribution data are intentionally not accessed.

### ATS Resume Checker

- Uses the latest saved structured profile and an optional pasted job description.
- Produces an ATS score, summary, section scores, matched/missing keywords, strengths, and prioritized fixes.
- Is instructed not to invent formatting, page count, or resume facts not present in the extracted profile.

### Coding Practice (`/practice`)

The Coding Practice section is available in the left panel and by opening `/practice`.

#### My Bank

- Self-hosted questions live in `server/question_bank.json`.
- A question can contain difficulty, topic, description, examples, constraints, Python/JavaScript starter code, and owned test cases.
- Uses **Monaco Editor**.
- Runs owned question test cases through the free **Piston API**.
- Shows expected output, actual output, pass/fail status, and stderr.

#### Codeforces

- Uses Codeforces' free keyless `problemset.problems` API.
- Flask caches it for 24 hours.
- Difficulty mapping: below 1200 = Easy, 1200–1900 = Medium, above 1900 = Hard.
- Shows title, rating, tags, and a link to the original statement. It never scrapes the statement or test cases.

#### External Links

- Manually curated direct LeetCode and GeeksforGeeks links with assigned difficulty tags.
- Opens the original source in a new tab; no scraping is performed.

#### Debug Help

- Sends the selected question, code, and failed output to a hint-first programming mentor.
- **Show full fix** explicitly requests a complete corrected solution after the initial hint.

### TARS career copilot

- Persistent bottom-right assistant.
- Receives current profile, current CDC section, and verified skills as context.
- Answers career, resume, roadmap, interview, application, GitHub, coding-practice, and platform questions without inventing profile facts.

## AI and external services

| Service | Role | Requirement |
| --- | --- | --- |
| OpenRouter (`qwen/qwen3-30b-a3b`) | Skill quizzes, company matches, roadmap, mock interviews, ATS analysis, TARS | Required for those AI features; `OPENROUTER_API_KEY` is server-only |
| Ollama | Local Coding Practice debug hints | Optional, free/self-hosted; tries first |
| Groq | Hosted fallback for debug help | Optional free-tier fallback; configure `GROQ_API_KEY` |
| Supabase | Email authentication and verification | Required for auth |
| GitHub REST API | Public profile/repository analytics | Optional; `GITHUB_TOKEN` can raise rate limit |
| Codeforces API | Problem metadata | Optional and keyless; cached 24h |
| Piston API | Python/JavaScript execution | Used only for owned My Bank tests |
| MediaPipe | Browser-side face detection | Used in mock interview proctoring |
| Browser Speech Recognition | Interview transcription | Optional browser capability; typing remains available |

The Coding Practice debug order is:

```text
Local Ollama → Groq free-tier fallback → configuration error with instructions
```

## Architecture and components

```text
React + Vite frontend
├── Supabase Auth
├── Resume extraction in browser
├── CDC section components and local profile state
├── Monaco editor
├── MediaPipe / browser speech APIs
└── API client modules
        ↓
Flask backend
├── OpenRouter AI orchestration
├── deterministic readiness calculation
├── GitHub and Codeforces proxies/caches
├── Piston execution proxy
├── Ollama / Groq debug help
└── local JSON question bank
```

### Main frontend files

| File | Purpose |
| --- | --- |
| `src/App.jsx` | CDC application shell, onboarding, every visible section, local user state, TARS, practice UI |
| `src/context/AuthContext.jsx` | Supabase authentication state and actions |
| `src/pages/LoginPage.jsx` | Email login/sign-up UI |
| `src/lib/resumeParser.js` | PDF/DOC/DOCX text extraction and form-field parsing |
| `src/lib/assessment.js` | Skill assessment client |
| `src/lib/interview.js` | Mock interview generation/evaluation client |
| `src/lib/readiness.js` | Company matching client and API health validation |
| `src/lib/readinessAnalysis.js` | Readiness-analysis client |
| `src/lib/roadmap.js` | Roadmap-generation client |
| `src/lib/github.js` | GitHub analytics client |
| `src/lib/ats.js` | ATS checker client |
| `src/lib/tars.js` | TARS client |
| `src/lib/practice.js` | Coding Practice client |
| `src/index.css` | Responsive pastel visual system, mock-interview UI, and LeetCode-style practice workspace |

### Backend files

| File | Purpose |
| --- | --- |
| `server/app.py` | Flask routes, AI calls, deterministic readiness logic, proxies, caches, and API validation |
| `server/question_bank.json` | Self-hosted Coding Practice questions and owned test cases |
| `server/requirements.txt` | Python dependencies, including Gunicorn for production |

## API reference

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Backend health check |
| `/api/questions?difficulty=&source=bank` | GET | Local coding questions |
| `/api/codeforces-problems?difficulty=` | GET | Cached Codeforces metadata |
| `/api/run-code` | POST | Runs My Bank code with Piston |
| `/api/debug-help` | POST | Ollama/Groq debug help |
| `/api/github/<username>` | GET | Cached public GitHub analytics |
| `/api/ats/check` | POST | ATS profile/job comparison |
| `/api/tars/chat` | POST | Contextual TARS chat |
| `/api/assessments/generate` | POST | Skill quiz generation |
| `/api/interviews/generate` | POST | Mock question generation |
| `/api/interviews/evaluate` | POST | Mock answer evaluation |
| `/api/readiness/score` | POST | Company readiness matching |
| `/api/readiness/analyze` | POST | Deterministic readiness computation |
| `/api/roadmaps/generate` | POST | Personalized roadmap generation/fallback |
| `/api/resources/curate` | POST | Legacy live-curation endpoint; the UI Resources screen does not use it |

## Local setup

### Requirements

- Node.js 18+
- Python 3.10+
- Supabase project
- OpenRouter key for AI-enabled features
- Optional: Ollama for free local coding-debug help

### Install and run

```powershell
cd C:\Users\dhruv\Downloads\slingshot\slingshot
npm install
python -m pip install -r server\requirements.txt
```

Create `.env` from `.env.example`, then start Flask:

```powershell
python server\app.py
```

In a second terminal, start React:

```powershell
npm run dev
```

Backend verification:

```powershell
curl.exe http://127.0.0.1:3000/api/health
```

## Environment variables

```env
# Frontend values exposed to Vite/browser
VITE_API_BASE_URL=http://localhost:3000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Server-only AI key
OPENROUTER_API_KEY=your_openrouter_key_here

# Optional legacy live resource curation
TAVILY_API_KEY=your_tavily_key_here

# Optional GitHub higher rate limit
GITHUB_TOKEN=github_pat_your_token_here

# Optional local debug mentor
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Optional deployed debug fallback
GROQ_API_KEY=your_groq_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

Never commit `.env`, API tokens, or Supabase service-role keys.

## Deployment

Recommended architecture:

```text
Vercel (React/Vite frontend)
        ↓ VITE_API_BASE_URL
Render (Flask/Gunicorn backend)
        ↓
OpenRouter / GitHub / Codeforces / Piston / Groq

Supabase handles authentication.
```

### Render backend

```text
Build Command: pip install -r server/requirements.txt
Start Command: gunicorn --chdir server app:app --bind 0.0.0.0:$PORT
```

Set server-only `OPENROUTER_API_KEY`, optional `GITHUB_TOKEN`, and optional `GROQ_API_KEY` on Render.

### Vercel frontend

```text
Framework: Vite
Build Command: npm run build
Output Directory: dist
```

Set:

```env
VITE_API_BASE_URL=https://your-render-service.onrender.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

`vercel.json` routes `/practice` back to the single-page application.

In Supabase **Authentication → URL Configuration**, set the production Site URL and allow both:

```text
https://your-project.vercel.app/**
http://localhost:3000/**
```

## Data, privacy, and current limits

### Current persistence

- Supabase manages authentication.
- CDC profile and skill results are currently stored in browser `localStorage`, isolated by user ID.
- This is appropriate for an MVP, but a production deployment should persist profiles, quiz history, roadmap completion, applications, and interview history in Supabase/Postgres with Row Level Security.

### Recommended production hardening

1. Restrict Flask CORS to the deployed Vercel domain instead of `*`.
2. Add database persistence and Row Level Security.
3. Add per-user rate limits for AI, TARS, Piston, GitHub, and Codeforces requests.
4. Use Redis/database cache rather than in-memory cache for multi-instance deployments.
5. Use object storage and explicit user consent before persisting raw resumes.
6. Add background workers/queues for long AI tasks.
7. Add audit logs and abuse controls before scaling proctored mock interviews.

### External-service limitations

- GitHub data is public-only; private repositories need an OAuth authorization flow.
- Codeforces metadata does not include full problem statements/test cases in this product; the original problem page remains the source.
- LeetCode and GeeksforGeeks are provided as direct links only—no free official API is used and no scraping occurs.
- Piston is a public execution service; production should validate payload size and enforce strict rate limits.

## Build verification

```powershell
npm run build
python -m py_compile server\app.py
```
