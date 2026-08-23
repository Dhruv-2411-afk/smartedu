import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  Activity, ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays, Check, ChevronRight,
  BookOpen, CircleHelp, Code2, FileText, GitBranch, Home, LineChart, Lock, Menu, MessageSquare,
  Plus, Search, Settings, Sparkles, Target, TrendingUp, Upload, Users, Video, X, Zap,
  Loader2, LogOut
} from 'lucide-react'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import { parseResume } from './lib/resumeParser'
import { generateSkillAssessment, learningResourceFor } from './lib/assessment'
import { evaluateMockAnswer, generateMockInterview } from './lib/interview'
import { scoreCompanyReadiness } from './lib/readiness'
import { generateCareerRoadmap } from './lib/roadmap'
import { analyzeReadiness } from './lib/readinessAnalysis'
import { askTars } from './lib/tars'
import { checkAtsResume } from './lib/ats'
import { getCodeforces, getDebugHelp, getQuestions, runCode } from './lib/practice'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { fetchGithubAnalytics, githubUsername } from './lib/github'
import Editor from '@monaco-editor/react'

const NAV = [
  ['Overview', Home], ['Readiness', Target], ['Skills', Code2], ['Coding Practice', Code2], ['ATS Checker', FileText], ['Roadmap', FileText], ['Resources', BookOpen],
  ['Companies', BriefcaseBusiness], ['Applications', FileText], ['Interviews', Video], ['Analytics', LineChart],
]
const SKILLS = [
  {name:'JavaScript',cat:'Programming',status:'Verified',score:91},{name:'Python',cat:'Programming',status:'Verified',score:84},
  {name:'React',cat:'Web',status:'Verified',score:88},{name:'Node.js',cat:'Web',status:'Claimed',score:null},
  {name:'SQL',cat:'Database',status:'Verified',score:79},{name:'DSA',cat:'Programming',status:'Untested',score:null},
  {name:'System Design',cat:'Tools',status:'Claimed',score:null},{name:'Communication',cat:'Communication',status:'Verified',score:76},
]
const TASKS=[
  {id:1,title:'Master DSA arrays & strings',due:'Aug 24',impact:'+4 readiness',done:true},
  {id:2,title:'Complete 2 timed aptitude sets',due:'Aug 26',impact:'+3 readiness',done:false},
  {id:3,title:'Build system design notes',due:'Aug 28',impact:'+5 readiness',done:false},
  {id:4,title:'Verify Node.js skill',due:'Aug 30',impact:'+4 readiness',done:false},
]

const APPLICATIONS=[
  {company:'Microsoft',role:'Software Engineer',stage:'Interview',date:'Aug 18'},{company:'Razorpay',role:'Frontend Engineer',stage:'Screening',date:'Aug 15'},{company:'Google',role:'SWE Intern',stage:'Applied',date:'Aug 10'},{company:'Zoho',role:'Product Engineer',stage:'Rejected',date:'Aug 02'}
]
const READINESS={coding:78,aptitude:62,communication:76,projects:84}
const EMPTY_FORM = {name:'',email:'',phone:'',location:'',headline:'',role:'',experience:'',education:'',university:'',graduation:'',skills:'',linkedin:'',github:'',portfolio:'',projects:'',certifications:'',languages:'',notice:'',employment:''}
const ROLE_SKILLS = ['JavaScript', 'React', 'TypeScript', 'Node.js', 'SQL', 'DSA', 'System Design']
const categoryFor = (skill) => /react|node|html|css|javascript|typescript|next|angular|vue/i.test(skill) ? 'Web' : /sql|mongo|firebase|postgres/i.test(skill) ? 'Database' : /communication|english/i.test(skill) ? 'Communication' : 'Programming'
const skillList = (value = '') => [...new Set(value.split(/[\n,;|•]+/).map(item => item.replace(/^[-–\s]+/, '').trim()).filter(item => item && item.length < 50))]
const buildProfileAnalysis = (form, results = {}) => {
 const names = skillList(form.skills)
 const skills = names.map((name, index) => ({ name, cat: categoryFor(name), status: results[name]?.status || 'Claimed', score: results[name]?.score ?? null, key: `${name}-${index}` }))
 const normalized = names.map(name => name.toLowerCase())
 const missingNames = ROLE_SKILLS.filter(skill => !normalized.some(name => name.includes(skill.toLowerCase())))
 const role = form.role || 'your target role'
 const readiness = Math.min(94, Math.max(42, 48 + names.length * 4 + (form.projects ? 6 : 0) + (form.education ? 4 : 0)))
 const tasks = missingNames.slice(0, 4).map((name, index) => ({ id: `profile-${name}`, title: `Build ${name} skills for ${role}`, due: `Week ${index + 1}`, impact: `+${Math.max(2, 6 - index)} readiness`, done: false }))
 return { skills, readiness, missingNames, tasks }
}
function Card({children,className=''}){return <section className={`card ${className}`}>{children}</section>}
function Eyebrow({children}){return <div className="eyebrow">{children}</div>}
function TarsChat({profile,section,skills}){
 const [open,setOpen]=useState(false),[input,setInput]=useState(''),[messages,setMessages]=useState([{role:'assistant',content:'Hi, I’m TARS. Ask me about your resume, skills, roadmap, interviews, projects, or any career doubt.'}]),[sending,setSending]=useState(false)
 const send=async event=>{event?.preventDefault();const question=input.trim();if(!question||sending)return;const nextMessages=[...messages,{role:'user',content:question}];setMessages(nextMessages);setInput('');setSending(true);try{const reply=await askTars(question,{profile:profile?.form||{},current_section:section,skills:(skills||[]).map(skill=>({name:skill.name,status:skill.status,score:skill.score}))},nextMessages.slice(-6));setMessages(current=>[...current,{role:'assistant',content:reply}])}catch(error){setMessages(current=>[...current,{role:'assistant',content:`I couldn’t reach my reasoning service. ${error.message}`}])}finally{setSending(false)}}
 return <div className={`tars ${open?'open':''}`}>{open&&<section className="tars-panel"><header><div><span><Sparkles size={14}/></span><div><b>TARS</b><small>Career copilot</small></div></div><button className="icon-btn" onClick={()=>setOpen(false)} aria-label="Close TARS"><X size={17}/></button></header><div className="tars-messages">{messages.map((message,index)=><div className={`tars-message ${message.role}`} key={`${message.role}-${index}`}>{message.content}</div>)}{sending&&<div className="tars-message assistant typing">TARS is thinking…</div>}</div><form onSubmit={send}><textarea value={input} onChange={event=>setInput(event.target.value)} placeholder="Ask TARS anything…" rows="2" onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}}}/><button className="primary-btn" disabled={!input.trim()||sending} type="submit">Send <ArrowUpRight size={14}/></button></form></section>}<button className="tars-launch" onClick={()=>setOpen(value=>!value)} aria-label="Open TARS"><MessageSquare size={19}/><span>TARS</span></button></div>
}
function Landing({onComplete, initialProfile=null, onCancel}){
 const [resume,setResume]=useState(null)
 const [form,setForm]=useState(()=>initialProfile?.form || EMPTY_FORM)
 const [drag,setDrag]=useState(false)
 const [parsing,setParsing]=useState(false)
 const [parseError,setParseError]=useState('')
 const [parseSuccess,setParseSuccess]=useState(false)
 const update=(key,value)=>setForm(prev=>({...prev,[key]:value}))
 const ready=resume && form.name.trim() && form.email.trim() && form.role.trim() && form.education.trim()
 const submit=e=>{e.preventDefault(); if(ready) onComplete({resume,form})}

 const handleResumeFile = useCallback(async (file) => {
   if (!file) return
   setResume(file)
   setParsing(true)
   setParseError('')
   setParseSuccess(false)
   try {
     const extracted = await parseResume(file)
     // A new file is a new source of truth. Starting from a blank form prevents
     // fields absent from the new resume from leaking in from the previous one.
     setForm(() => ({ ...EMPTY_FORM, ...extracted }))
     setParseSuccess(true)
     setTimeout(() => setParseSuccess(false), 4000)
   } catch (err) {
     console.error('Resume parse error:', err)
     setParseError(err.message || 'Could not parse resume. Please fill in details manually.')
     setTimeout(() => setParseError(''), 5000)
   } finally {
     setParsing(false)
   }
 }, [])

 return <div className="landing-shell">
   {/* Parsing overlay */}
   {parsing && <div className="parse-overlay"><div className="parse-modal"><Loader2 size={32} className="parse-spinner" /><h3>Extracting resume details…</h3><p>Analyzing your resume to autofill your profile.</p></div></div>}
   <header className="landing-nav">
     <button className="brand landing-brand" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}><span className="brand-mark"><Sparkles size={16}/></span>Slingshot</button>
     <div className="landing-nav-note"><span className="live-dot"/> Career intelligence workspace</div>
   </header>
   <main className="landing-main">
     <section className="hero-copy">
       <div className="hero-eyebrow"><span className="hero-dot"/> Your career, in motion</div>
       <h1>Turn your profile into a <span>career trajectory.</span></h1>
       <p>Slingshot builds a living career profile from your resume, education, experience, skills and goals, then turns skill gaps into clear actions, target roles and a path to getting hired.</p>
       <div className="hero-points"><span><Check size={14}/> Resume intelligence</span><span><Check size={14}/> Verified skills</span><span><Check size={14}/> Role matching</span><span><Check size={14}/> Application tracking</span></div>
     </section>
     <section className="onboarding-card">
       <div className="onboarding-head"><div><Eyebrow>BUILD YOUR PROFILE</Eyebrow><h2>Start your Slingshot workspace</h2><p>Complete your professional profile like LinkedIn or Unstop. Your resume and details become the starting point for your Career Twin.</p></div><div className="step-chip">PROFILE</div></div>
       {parseError && <div className="parse-toast parse-toast--error">{parseError}</div>}
       {parseSuccess && <div className="parse-toast parse-toast--success"><Check size={14}/> Resume parsed! Fields have been autofilled.</div>}
       <form onSubmit={submit}>
         <div className="profile-section-title"><Eyebrow>RESUME</Eyebrow><span>Upload the latest version for extraction.</span></div>
         <label className={`resume-drop ${drag?'dragging':''} ${resume?'has-file':''}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);handleResumeFile(e.dataTransfer.files?.[0]||null)}}>
           <input type="file" accept=".pdf,.doc,.docx" onChange={e=>handleResumeFile(e.target.files?.[0]||null)}/>
           <div className="upload-icon">{parsing ? <Loader2 size={20} className="parse-spinner" /> : <Upload size={20}/>}</div>
           <div><strong>{resume?resume.name:'Drop your resume here'}</strong><span>{parsing?'Analyzing resume…':resume?'Resume ready — fields autofilled':'PDF, DOC or DOCX · up to 10 MB'}</span></div>
           <button type="button" className="ghost-btn" onClick={e=>{e.preventDefault();e.currentTarget.parentElement?.querySelector('input')?.click()}}>Browse</button>
         </label>

         <div className="details-label"><Eyebrow>BASIC DETAILS</Eyebrow><span>Core information used for profile matching.</span></div>
         <div className="form-grid">
           <label><span>Full name *</span><input required value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Your full name"/></label>
           <label><span>Email *</span><input required type="email" value={form.email} onChange={e=>update('email',e.target.value)} placeholder="you@example.com"/></label>
           <label><span>Phone</span><input value={form.phone} onChange={e=>update('phone',e.target.value)} placeholder="+91 98765 43210"/></label>
           <label><span>Current location</span><input value={form.location} onChange={e=>update('location',e.target.value)} placeholder="City, State"/></label>
           <label className="full-field"><span>Professional headline</span><input value={form.headline} onChange={e=>update('headline',e.target.value)} placeholder="e.g. Computer Science student | Aspiring Software Engineer"/></label>
         </div>

         <div className="details-label"><Eyebrow>CAREER PREFERENCES</Eyebrow><span>Tell Slingshot what you're targeting.</span></div>
         <div className="form-grid">
           <label><span>Target role *</span><input required value={form.role} onChange={e=>update('role',e.target.value)} placeholder="Software Engineer"/></label>
           <label><span>Experience</span><select value={form.experience} onChange={e=>update('experience',e.target.value)}><option value="">Select</option><option>Student / Fresher</option><option>0–2 years</option><option>2–5 years</option><option>5+ years</option></select></label>
           <label><span>Preferred employment</span><select value={form.employment} onChange={e=>update('employment',e.target.value)}><option value="">Select</option><option>Full-time</option><option>Internship</option><option>Part-time</option><option>Contract</option></select></label>
           <label><span>Notice period</span><select value={form.notice} onChange={e=>update('notice',e.target.value)}><option value="">Select</option><option>Immediate</option><option>15 days</option><option>30 days</option><option>60 days</option><option>90+ days</option></select></label>
         </div>

         <div className="details-label"><Eyebrow>EDUCATION</Eyebrow><span>Your academic background.</span></div>
         <div className="form-grid">
           <label><span>Highest qualification *</span><input required value={form.education} onChange={e=>update('education',e.target.value)} placeholder="B.Tech, B.E., MCA, MBA…"/></label>
           <label><span>University / College</span><input value={form.university} onChange={e=>update('university',e.target.value)} placeholder="College or university"/></label>
           <label><span>Graduation year</span><select value={form.graduation} onChange={e=>update('graduation',e.target.value)}><option value="">Select</option>{Array.from({length:10},(_,i)=>2026-i).map(y=><option key={y}>{y}</option>)}</select></label>
         </div>

         <div className="details-label"><Eyebrow>SKILLS & WORK</Eyebrow><span>These can also be extracted from your resume.</span></div>
         <div className="form-grid">
           <label className="full-field"><span>Skills</span><textarea value={form.skills} onChange={e=>update('skills',e.target.value)} placeholder="JavaScript, React, Python, SQL, DSA…"/></label>
           <label className="full-field"><span>Projects / experience highlights</span><textarea value={form.projects} onChange={e=>update('projects',e.target.value)} placeholder="Key projects, internships, achievements or work highlights"/></label>
           <label className="full-field"><span>Certifications</span><textarea value={form.certifications} onChange={e=>update('certifications',e.target.value)} placeholder="Certification name, issuer…"/></label>
         </div>

         <div className="details-label"><Eyebrow>ONLINE PRESENCE</Eyebrow><span>Optional links for profile enrichment.</span></div>
         <div className="form-grid">
           <label><span>LinkedIn</span><input value={form.linkedin} onChange={e=>update('linkedin',e.target.value)} placeholder="linkedin.com/in/yourname"/></label>
           <label><span>GitHub</span><input value={form.github} onChange={e=>update('github',e.target.value)} placeholder="github.com/yourname"/></label>
           <label><span>Portfolio / website</span><input value={form.portfolio} onChange={e=>update('portfolio',e.target.value)} placeholder="yourportfolio.com"/></label>
           <label><span>Languages</span><input value={form.languages} onChange={e=>update('languages',e.target.value)} placeholder="English, Hindi, Tamil…"/></label>
         </div>

         <div className="launch-actions"><button className="primary-btn launch-btn" disabled={!ready} type="submit"><Sparkles size={15}/> {initialProfile ? 'Save & refresh CDC' : 'Build my Career Twin'} <ArrowUpRight size={14}/></button>{onCancel&&<button type="button" className="ghost-btn" onClick={onCancel}>Cancel</button>}</div>
         {!ready&&<small className="form-hint">Resume, full name, email and highest qualification are required to continue.</small>}
       </form>
     </section>
   </main>
   <footer className="landing-footer"><span>SLINGSHOT</span><span>Resume → Profile → Readiness → Roles → Applications → Placement</span></footer>
 </div>
}
function App(){
 const { user, loading, signOut } = useAuth()
 const [onboarded,setOnboarded]=useState(false)
 const [profile,setProfile]=useState(null)
 const [section,setSection]=useState(()=>window.location.pathname==='/practice'?'Coding Practice':'Overview'); const [skills,setSkills]=useState([]); const [tasks,setTasks]=useState([]); const [apps,setApps]=useState(APPLICATIONS); const [search,setSearch]=useState(''); const [showNav,setShowNav]=useState(false)
 const [quiz,setQuiz]=useState(null); const [quizLoading,setQuizLoading]=useState(false); const [quizError,setQuizError]=useState('')

 // --- Company matches (single source of truth; no duplicate declarations) ---
 const [companyMatches, setCompanyMatches] = useState([])
 const [companyLoading, setCompanyLoading] = useState(false)
 const [companyError, setCompanyError] = useState('')

 const generateCompanyMatches = useCallback(async () => {
   if (!profile?.form) return
   setCompanyLoading(true)
   setCompanyError('')
   try {
     setCompanyMatches(await scoreCompanyReadiness(profile.form))
   } catch (err) {
     console.error(err)
     setCompanyError(err.message || 'Could not load company matches. Please try again.')
     setCompanyMatches([])
   } finally {
     setCompanyLoading(false)
   }
 }, [profile])

 useEffect(() => {
   if (profile) generateCompanyMatches()
 }, [profile, generateCompanyMatches])

 const storageKey = user ? `slingshot-profile-${user.id}` : null
 useEffect(()=>{
   // Auth changes must never inherit the previous user's in-memory CDC state.
   setProfile(null); setOnboarded(false); setSkills([]); setTasks([]); setSection('Overview')
   if (!storageKey) return
   const saved = window.localStorage.getItem(storageKey)
   if (!saved) return
   try { const savedProfile = JSON.parse(saved); setProfile(savedProfile); setOnboarded(true) } catch { window.localStorage.removeItem(storageKey) }
 },[storageKey])
 const analysis=useMemo(()=>buildProfileAnalysis(profile?.form || EMPTY_FORM, profile?.skillResults),[profile])

 const verified=skills.filter(s=>s.status==='Verified').length; const verifiedScores=Object.values(profile?.skillResults||{}).map(result=>Number(result?.score)).filter(Number.isFinite); const score=verifiedScores.length?Math.round((verifiedScores.reduce((total,value)=>total+value,0)/verifiedScores.length)*.30):0; const missing=skills.filter(s=>s.status!=='Verified').slice(0,3)
 const filtered=useMemo(()=>skills.filter(s=>`${s.name} ${s.cat}`.toLowerCase().includes(search.toLowerCase())),[skills,search])
 const startVerification=async skill=>{
   setQuizError(''); setQuizLoading(true)
   try { const questions=await generateSkillAssessment(profile.form,skill.name); setQuiz({skill,questions,answers:{},submitted:false}) }
   catch(error) { setQuizError(error.message) }
   finally { setQuizLoading(false) }
 }
 const finishQuiz=()=>{
   const correct=quiz.questions.filter(question=>quiz.answers[question.id]===question.correct_answer).length
   const score=Math.round((correct/quiz.questions.length)*100); const passed=score>=70
   const nextProfile={...profile,skillResults:{...profile.skillResults,[quiz.skill.name]:{status:passed?'Verified':'Needs practice',score}}}
   setProfile(nextProfile); window.localStorage.setItem(storageKey,JSON.stringify(nextProfile)); setQuiz(current=>({...current,submitted:true,score,passed}))
 }

 const toggle=id=>setTasks(p=>p.map(t=>t.id===id?{...t,done:!t.done}:t))
 const stage=(i,v)=>setApps(p=>p.map((a,n)=>n===i?{...a,stage:v}:a))
 const addApplication=application=>setApps(current=>[{...application,id:`application-${Date.now()}`,date:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})},...current])
 // Auth loading state
 if(loading) return <div className="auth-loading"><Loader2 size={36} className="parse-spinner" /><p>Loading…</p></div>
 // Auth gate: not logged in → login page
 if(!user) return <LoginPage />
 // Logged in but not onboarded → profile builder
 if(!onboarded) return <Landing initialProfile={profile} onCancel={profile?()=>setOnboarded(true):undefined} onComplete={(data)=>{const nextProfile={form:data.form,resumeName:data.resume?.name || '',skillResults:{}}; setProfile(nextProfile); setSkills(buildProfileAnalysis(data.form).skills); setTasks(buildProfileAnalysis(data.form).tasks); window.localStorage.setItem(storageKey, JSON.stringify(nextProfile)); setOnboarded(true); setSection('Overview')}}/>
 const title=section==='Overview'?'Career command center':section
 return <div className="app-shell">
   <header className="topbar">
    <button className="mobile-menu" onClick={()=>setShowNav(!showNav)}><Menu size={18}/></button>
    <button className="brand" onClick={()=>setSection('Overview')}><span className="brand-mark"><Sparkles size={16}/></span>Slingshot</button>
    <div className="workspace-pill"><span className="live-dot"/> Student workspace <ChevronRight size={13}/></div>
    <div className="top-search"><Search size={15}/><input placeholder="Search skills, roles, companies…" /></div>
    <div className="top-actions"><button className="icon-btn" title="Update resume" onClick={()=>setOnboarded(false)}><Home size={17}/></button><button className="icon-btn"><CircleHelp size={17}/></button><button className="icon-btn"><Bell size={17}/><i/></button><button className="icon-btn" title="Sign Out" onClick={signOut}><LogOut size={17}/></button><div className="avatar">{profile?.form?.name?.[0]?.toUpperCase()||'A'}</div></div>
   </header>
   <aside className={`sidebar ${showNav?'open':''}`}>
    <div className="side-label">WORKSPACE</div>
    {NAV.map(([label,Icon])=><button key={label} onClick={()=>{setSection(label);if(label==='Coding Practice')window.history.pushState({},'', '/practice');else if(window.location.pathname==='/practice')window.history.pushState({},'', '/');setShowNav(false)}} className={`side-link ${section===label?'active':''}`}><Icon size={17}/><span>{label}</span>{label==='Analytics'&&<em>2</em>}</button>)}
    <div className="side-divider"/><div className="side-label">CAREER TWIN</div>
    <div className="twin-card"><div className="twin-head"><span className="twin-avatar"><Sparkles size={13}/></span><div><strong>Career Twin</strong><small>Synced just now</small></div></div><div className="twin-score"><b>{score}%</b><span>readiness</span></div><div className="mini-bar"><span style={{width:`${score}%`}}/></div></div>
    <div className="side-bottom"><button className="side-link"><Settings size={17}/><span>Settings</span></button><button className="side-link"><CircleHelp size={17}/><span>Help</span></button></div>
   </aside>
   <main className="main">
    <div className="main-inner">
      <div className="command-head"><div><div className="breadcrumb">Workspace <ChevronRight size={12}/> {section}</div><h1>{title}</h1><p>{section==='Overview' ? `${profile?.form?.role || 'Your target role'} profile, gaps, active applications and next actions in one live workspace.` : 'Career intelligence built around your current resume and target role.'}</p></div><div className="head-actions"><button className="ghost-btn" onClick={()=>setOnboarded(false)}><Upload size={14}/> Update resume</button><button className="primary-btn" onClick={()=>setSection('Skills')}><Zap size={14}/> Verify skill</button></div></div>
      {quizError&&<div className="parse-toast parse-toast--error">{quizError}</div>}
      {section==='Overview'&&<Overview score={score} missing={missing} tasks={tasks} apps={apps} setSection={setSection} role={profile?.form?.role} skills={skills}/>} 
      {section==='Readiness'&&<Readiness score={score} profile={profile}/>} 
      {section==='Skills'&&<Skills skills={filtered} search={search} setSearch={setSearch} verify={startVerification} loading={quizLoading}/>} 
      {section==='Coding Practice'&&<CodingPractice/>}
      {section==='ATS Checker'&&<AtsChecker profile={profile?.form}/>} 
      {section==='Roadmap'&&<Roadmap profile={profile?.form}/>} 
      {section==='Resources'&&<Resources/>}
      {section==='Companies'&&
  <Companies
    setSection={setSection}
    role={profile?.form?.role}
    skills={skills}
    matches={companyMatches}
    loading={companyLoading}
    error={companyError}
    onRetry={generateCompanyMatches}
  />
}
      {section==='Applications'&&<Applications apps={apps} stage={stage} onAdd={addApplication}/>} 
      {section==='Interviews'&&<Interviews profile={profile?.form}/>} 
      {section==='Analytics'&&<Analytics profile={profile?.form}/>} 
      {quiz&&<SkillQuiz quiz={quiz} setQuiz={setQuiz} onFinish={finishQuiz} onClose={()=>setQuiz(null)}/>}
    </div>
   </main>
   <TarsChat profile={profile} section={section} skills={skills}/>
 </div>
}
function Overview({score,missing,tasks,apps,setSection,role,skills}){const verified=skills.filter(skill=>skill.status==='Verified').length; return <>
 <div className="overview-grid">
  <Card className="readiness-card"><div className="card-top"><Eyebrow>READINESS</Eyebrow><span className="status-chip blue"><span/> Evidence-based</span></div><div className="readiness-main"><div><div className="readiness-number">{score}<small>%</small></div><h2>ready for {role || 'your target role'} opportunities</h2><p>This starts at zero and rises only from recorded quizzes, roadmap progress, and mock interviews—not resume claims.</p><button className="primary-btn" onClick={()=>setSection('Readiness')}>Open readiness <ArrowUpRight size={14}/></button></div><div className="ring" style={{'--score':score}}><div><b>{score}%</b><small>evidence</small></div></div></div></Card>
  <Card className="next-card"><Eyebrow>NEXT BEST ACTION</Eyebrow><div className="next-icon"><Zap size={17}/></div><h2>{missing[0] ? `Verify ${missing[0].name}` : 'Keep your skills current'}</h2><p>A short quiz updates your verified skills, readiness and company-match accuracy.</p><button className="text-btn" onClick={()=>setSection('Skills')}>Start verification <ChevronRight size={14}/></button></Card>
 </div>
 <div className="metrics"><Metric label="Time to ready" value={Math.max(7,28-verified*3)} suffix="days"/><Metric label="Verified skills" value={verified} suffix={` / ${skills.length}`}/><Metric label="Readiness" value={score} suffix="%"/><Metric label="Active applications" value={apps.length} suffix=""/></div>
 <div className="content-grid">
  <Card><div className="card-head"><div><Eyebrow>SKILL GAPS</Eyebrow><h2>What moves the score next</h2></div><button className="text-btn" onClick={()=>setSection('Skills')}>View all <ChevronRight size={14}/></button></div>{missing.map((s,i)=><button className="gap-row" key={s.name} onClick={()=>setSection('Skills')}><span className="gap-index">0{i+1}</span><span><strong>{s.name}</strong><small>{s.status==='Untested'?'Untested':'Resume claimed'} · high impact</small></span><ArrowUpRight size={14}/></button>)}</Card>
  <Card><div className="card-head"><div><Eyebrow>ROADMAP</Eyebrow><h2>Next tasks</h2></div><button className="text-btn" onClick={()=>setSection('Roadmap')}>Open <ChevronRight size={14}/></button></div>{tasks.slice(0,3).map(t=><div className={`task-row ${t.done?'done':''}`} key={t.id}><button className="check" onClick={()=>{}}>{t.done&&<Check size={13}/>}</button><div><strong>{t.title}</strong><small>{t.due} · {t.impact}</small></div><ChevronRight size={14}/></div>)}</Card>
 </div>
 <Card><div className="card-head"><div><Eyebrow>APPLICATIONS</Eyebrow><h2>Live pipeline</h2></div><button className="text-btn" onClick={()=>setSection('Applications')}>Manage <ChevronRight size={14}/></button></div><div className="pipeline"><Pipeline n={1} label="Applied"/><Pipeline n={1} label="Screening"/><Pipeline n={1} label="Interview"/><Pipeline n={0} label="Offer"/></div><div className="application-mini">{apps.slice(0,3).map(a=><div key={a.company}><span className="company-badge">{a.company[0]}</span><div><strong>{a.company}</strong><small>{a.role}</small></div><span className={`stage ${a.stage.toLowerCase()}`}>{a.stage}</span></div>)}</div></Card>
 </>}
function Metric({label,value,suffix}){return <div className="metric"><span>{label}</span><b>{value}<small>{suffix}</small></b></div>}
function Pipeline({n,label}){return <div className="pipeline-item"><b>{n}</b><span>{label}</span></div>}
function Readiness({score,profile}){const [analysis,setAnalysis]=useState(null),[error,setError]=useState(''); const activity=useMemo(()=>({roadmap_progress:{phases_completed:0,phases_total:0,tracks:{DSA:{problems_solved:0,target:0,topics_weak:[]},CN:{completion_pct:0},OS:{completion_pct:0},'System Design':{completion_pct:0},Fullstack:{completion_pct:0},Aptitude:{completion_pct:0}}},skill_verification:{quizzes_taken:Object.entries(profile?.skillResults||{}).map(([topic,result])=>({topic,score_pct:result.score,date:new Date().toISOString().slice(0,10)})),coding_tests_taken:[]},mock_interviews:[],target_role:profile?.form?.role||'Software Engineer',time_remaining_weeks:24}),[profile]);useEffect(()=>{let active=true;analyzeReadiness(activity).then(value=>active&&setAnalysis(value)).catch(err=>active&&setError(err.message));return()=>{active=false}},[activity]);const displayScore=analysis?.overall_readiness_pct??0;return <div className="content-grid"><Card className="large-card"><div className="readiness-dashboard"><div className="big-ring" style={{'--score':displayScore}}><div><b>{displayScore}%</b><small>overall</small></div></div><div><Eyebrow>ACTIVITY-BASED READINESS</Eyebrow><h2>{analysis?`Confidence: ${analysis.confidence}`:'Analyzing your recorded activity…'}</h2><p>{error||'This score is deterministic: 25% roadmap completion, 30% verified quiz/coding results, and 45% mock interviews. Missing evidence contributes zero.'}</p>{(analysis?.tracks||Object.entries(READINESS).map(([name,completion_pct])=>({name,completion_pct,verified_score_pct:null,status:'not started'}))).map(track=><div className="pillar" key={track.name}><span>{track.name}</span><div><i style={{width:`${track.completion_pct}%`}}/></div><b>{track.verified_score_pct===null?'—':`${track.verified_score_pct}%`}</b></div>)}</div></div></Card><Card><Eyebrow>BEFORE YOUR NEXT INTERVIEW</Eyebrow>{(analysis?.next_actions||['Complete a skill quiz to establish a verified baseline.','Finish a roadmap phase to record progress.','Take a mock interview for a real interview-performance signal.']).map((action,index)=><div className="priority" key={action}><span>{index+1}</span><div><strong>{action}</strong></div><ChevronRight size={14}/></div>)}</Card></div>}
function Skills({skills,search,setSearch,verify,loading}){return <Card><div className="toolbar"><div><Eyebrow>SKILL GRAPH</Eyebrow><h2>Verify each claimed skill with a tailored assessment.</h2></div><div className="search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search skills"/></div></div><div className="skill-table">{skills.map(s=><div className="skill-row" key={s.name}><div><strong>{s.name}</strong><small>{s.cat}</small></div><span className={`status ${s.status.toLowerCase().replace(/\s+/g,'-')}`}>{s.status}</span><div className="skill-bar"><i style={{width:`${s.score||0}%`}}/></div><b>{s.score!==null?`${s.score}%`:'—'}</b>{s.status!=='Verified'&&<button className="verify-btn" disabled={loading} onClick={()=>verify(s)}>{loading?'Preparing…':s.status==='Needs practice'?'Retry quiz':'Verify'}</button>}</div>)}</div></Card>}
function SkillQuiz({quiz,setQuiz,onFinish,onClose}){const resource=learningResourceFor(quiz.skill.name); const unanswered=quiz.questions.some(question=>!quiz.answers[question.id]); return <div className="modal-backdrop"><section className="modal quiz-modal"><div className="quiz-header"><div><Eyebrow>SKILL ASSESSMENT</Eyebrow><h2>{quiz.skill.name} verification</h2><p>{quiz.questions.length} questions · Pass at 70%</p></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>{quiz.questions.map((question,index)=><div className="quiz-question" key={question.id}><div className="quiz-question-head"><span>{index+1}</span><div><small>{question.difficulty} · {question.topic}</small><strong>{question.question}</strong></div></div><div className="quiz-options">{Object.entries(question.options).map(([key,value])=>{const checked=quiz.answers[question.id]===key; const answerClass=quiz.submitted?(key===question.correct_answer?'correct':checked?'incorrect':''):''; return <label className={`quiz-option ${answerClass}`} key={key}><input type="radio" name={`question-${question.id}`} checked={checked} disabled={quiz.submitted} onChange={()=>setQuiz(current=>({...current,answers:{...current.answers,[question.id]:key}}))}/><span>{key}</span>{value}</label>})}</div>{quiz.submitted&&<p className="quiz-explanation">{question.explanation}</p>}</div>)}{quiz.submitted?<div className={`quiz-result ${quiz.passed?'pass':'fail'}`}><strong>{quiz.passed?`Verified — ${quiz.score}%`:`Not verified — ${quiz.score}%`}</strong><p>{quiz.passed?'This skill is now reflected as verified throughout your CDC.':<>Review <a href={resource.url} target="_blank" rel="noreferrer">{resource.label}</a>, then retake this assessment when you are ready.</>}</p><button className="primary-btn" onClick={onClose}>Back to skills</button></div>:<div className="quiz-footer"><span>{unanswered?'Answer every question to submit.':'Ready to submit your assessment.'}</span><button className="primary-btn" disabled={unanswered} onClick={onFinish}>Submit assessment <ArrowUpRight size={14}/></button></div>}</section></div>}
function Roadmap({profile}){
 const [form,setForm]=useState(()=>({current_skills:profile?.skills||'',current_level:profile?.experience||'Student / Fresher',target_role:profile?.role||'',time_available:'6 months'})); const [roadmap,setRoadmap]=useState(null); const [loading,setLoading]=useState(false); const [error,setError]=useState(''); const [selectedId,setSelectedId]=useState(null)
 const update=(key,value)=>setForm(current=>({...current,[key]:value}))
 const generate=async event=>{event.preventDefault();setLoading(true);setError('');try{const next=await generateCareerRoadmap(form);setRoadmap(next);setSelectedId(next.phases[0]?.id||null)}catch(err){setError(err.message)}finally{setLoading(false)}}
 if(!roadmap)return <Card className="roadmap-builder"><div className="card-head"><div><Eyebrow>AI ROADMAP GENERATOR</Eyebrow><h2>Build your Big Tech interview plan</h2><p>Turn your profile and available time into a practical, phase-based plan.</p></div><span className="status-chip purple"><Sparkles size={12}/> Personalized</span></div>{error&&<div className="parse-toast parse-toast--error">{error}</div>}<form className="roadmap-form" onSubmit={generate}><label><span>Current skills</span><textarea required value={form.current_skills} onChange={event=>update('current_skills',event.target.value)} placeholder="Python, React, SQL…"/></label><label><span>Current level</span><select value={form.current_level} onChange={event=>update('current_level',event.target.value)}><option>Student / Fresher</option><option>1–3 years</option><option>3+ years</option></select></label><label><span>Target role</span><input required value={form.target_role} onChange={event=>update('target_role',event.target.value)} placeholder="SDE-1, Backend Engineer…"/></label><label><span>Time available</span><select value={form.time_available} onChange={event=>update('time_available',event.target.value)}><option>8 weeks</option><option>3 months</option><option>6 months</option><option>1 year</option></select></label><button className="primary-btn" disabled={loading} type="submit"><Sparkles size={14}/>{loading?'Generating roadmap…':'Generate roadmap'}</button></form></Card>
 const selected=roadmap.phases.find(phase=>phase.id===selectedId)||roadmap.phases[0]
 return <><Card className="roadmap-summary"><div><Eyebrow>PERSONALIZED ROADMAP</Eyebrow><h2>{roadmap.target_role} · {roadmap.total_duration_weeks} weeks</h2><p>Choose a phase to see its measurable study plan. General learning links live in Resources.</p></div><button className="ghost-btn" onClick={()=>setRoadmap(null)}>Create another</button></Card><div className="roadmap-reader"><nav className="roadmap-phase-list">{roadmap.phases.map((phase,index)=><button key={phase.id} className={phase.id===selected?.id?'active':''} onClick={()=>setSelectedId(phase.id)}><span>PHASE {index+1} · {phase.duration_weeks} WKS</span><b>{phase.title}</b></button>)}</nav>{selected&&<Card className="roadmap-detail"><Eyebrow>{selected.id.toUpperCase()}</Eyebrow><h2>{selected.title}</h2><p className="roadmap-milestone">Milestone: {selected.milestone}</p>{selected.tracks.map(track=><article className="roadmap-track" key={track.name}><div><b>{track.name}</b>{track.leetcode_target!==null&&<span>{track.leetcode_target} LeetCode problems</span>}</div><ul>{track.goals.map(goal=><li key={goal}>{goal}</li>)}</ul><small>{track.resources.join(' · ')}</small></article>)}</Card>}</div></>
}
function Companies({ matches, loading, error, onRetry, setSection }) {

  if (loading) {
    return (
      <Card>
        <h2>Generating company matches…</h2>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <Eyebrow>AI COMPANY MATCHES</Eyebrow>
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button className="primary-btn" onClick={onRetry}>Retry</button>
      </Card>
    )
  }

  if (!matches || matches.length === 0) {
    return (
      <Card>
        <Eyebrow>AI COMPANY MATCHES</Eyebrow>
        <h2>No company matches yet</h2>
        <p>Complete your profile to see AI-ranked company matches.</p>
      </Card>
    )
  }

  return (
    <Card>
      <div className="card-head">
        <div>
          <Eyebrow>AI COMPANY MATCHES</Eyebrow>
          <h2>Companies ranked for your profile</h2>
        </div>
      </div>

      <div className="company-grid">

        {matches.map(company => (

          <div
            key={company.company}
            className="company-card"
          >

            <div className="company-head">
              <strong>{company.company}</strong>
              <b>{company.score}%</b>
            </div>

            <div className="matchbar">
              <i style={{ width: `${company.score}%` }} />
            </div>

            <p>
              <strong>Tier:</strong> {company.tier}
            </p>

            <p>
              <strong>Summary:</strong> {company.summary}
            </p>

            <div className="have-missing">
              <div>
                <small>Missing Skills</small>

                <span>
                  {company.missingSkills.join(" • ") || "No critical gaps found"}
                </span>
              </div>
            </div>

            {company.nextSteps.length > 0 && <p><strong>Next step:</strong> {company.nextSteps[0]}</p>}

            <button
              className="text-btn"
              onClick={() => setSection("Roadmap")}
            >
              Improve Match
            </button>

          </div>

        ))}

      </div>
    </Card>
  )
}
function Applications({apps,stage,onAdd}){const [adding,setAdding]=useState(false),[form,setForm]=useState({company:'',role:'',stage:'Applied',link:''});const counts=useMemo(()=>Object.fromEntries(['Applied','Screening','Interview','Offer','Rejected'].map(name=>[name,apps.filter(app=>app.stage===name).length])),[apps]);const submit=event=>{event.preventDefault();if(!form.company.trim()||!form.role.trim())return;onAdd({company:form.company.trim(),role:form.role.trim(),stage:form.stage,link:form.link.trim()});setForm({company:'',role:'',stage:'Applied',link:''});setAdding(false)};return <><div className="application-summary">{['Applied','Screening','Interview','Offer'].map(name=><div key={name}><b>{counts[name]}</b><span>{name}</span></div>)}</div><div className="content-grid"><Card className="large-card"><div className="card-head"><div><Eyebrow>APPLICATION TRACKER</Eyebrow><h2>Every opportunity, clearly tracked.</h2><p>Keep the current stage up to date to make your pipeline useful.</p></div><button className="primary-btn" onClick={()=>setAdding(true)}><Plus size={14}/> Add application</button></div>{apps.length===0?<div className="empty-applications"><BriefcaseBusiness size={22}/><strong>No applications yet</strong><span>Add your first role to start tracking your pipeline.</span></div>:apps.map((a,i)=><div className="application-row" key={a.id||`${a.company}-${i}`}><div className="company-logo small">{a.company[0]?.toUpperCase()}</div><div><strong>{a.company}</strong><small>{a.role} · Added {a.date}{a.link&&<> · <a href={a.link.startsWith('http')?a.link:`https://${a.link}`} target="_blank" rel="noreferrer">Job link</a></>}</small></div><select aria-label={`Stage for ${a.company}`} value={a.stage} onChange={e=>stage(i,e.target.value)}><option>Applied</option><option>Screening</option><option>Interview</option><option>Offer</option><option>Rejected</option></select><ChevronRight size={14}/></div>)}</Card><Card><Eyebrow>PIPELINE INSIGHT</Eyebrow><div className="rejection-number">{counts.Interview+counts.Screening}</div><p>applications are currently in an active hiring stage.</p><div className="recommendation"><strong>Next move</strong><span>{counts.Interview?'Prepare for your active interviews in the Interview workspace.':counts.Screening?'Follow up on screening-stage roles and keep preparing.':'Add a role or move an application forward to unlock useful pipeline insights.'}</span></div><div className="application-stage-list">{['Applied','Screening','Interview','Offer','Rejected'].map(name=><span key={name}><i className={name.toLowerCase()}/>{name}<b>{counts[name]}</b></span>)}</div></Card></div>{adding&&<div className="modal-backdrop"><form className="modal application-form" onSubmit={submit}><div className="card-head"><div><Eyebrow>NEW APPLICATION</Eyebrow><h2>Add an opportunity</h2></div><button className="icon-btn" type="button" onClick={()=>setAdding(false)}><X size={18}/></button></div><label>Company<input autoFocus required value={form.company} onChange={event=>setForm(current=>({...current,company:event.target.value}))} placeholder="e.g. Atlassian"/></label><label>Role<input required value={form.role} onChange={event=>setForm(current=>({...current,role:event.target.value}))} placeholder="e.g. Software Engineer Intern"/></label><label>Current stage<select value={form.stage} onChange={event=>setForm(current=>({...current,stage:event.target.value}))}><option>Applied</option><option>Screening</option><option>Interview</option><option>Offer</option><option>Rejected</option></select></label><label>Job link <small>(optional)</small><input value={form.link} onChange={event=>setForm(current=>({...current,link:event.target.value}))} placeholder="company.com/jobs/..."/></label><div className="application-form-actions"><button className="ghost-btn" type="button" onClick={()=>setAdding(false)}>Cancel</button><button className="primary-btn" type="submit">Save application <ArrowUpRight size={14}/></button></div></form></div>}</>}
function Interviews({profile}){
 const [questions,setQuestions]=useState(null),[index,setIndex]=useState(0),[phase,setPhase]=useState('ready'),[seconds,setSeconds]=useState(30),[transcript,setTranscript]=useState(''),[interim,setInterim]=useState(''),[evaluations,setEvaluations]=useState([]),[loading,setLoading]=useState(false),[evaluating,setEvaluating]=useState(false),[error,setError]=useState(''),[warnings,setWarnings]=useState(0),[warningMessage,setWarningMessage]=useState(''),[showWarning,setShowWarning]=useState(false),[faceCount,setFaceCount]=useState(0),[proctorStatus,setProctorStatus]=useState('Camera ready'),[finished,setFinished]=useState(false),[terminated,setTerminated]=useState(false),[listening,setListening]=useState(false)
 const videoRef=useRef(null),streamRef=useRef(null),recognitionRef=useRef(null),faceRef=useRef(null),frameRef=useRef(null),lastFrameRef=useRef(-1),missingSinceRef=useRef(null),warningRef=useRef(0),lastWarningRef=useRef({}),transcriptRef=useRef('')
 const question=questions?.[index], active=Boolean(question)&&!finished&&!terminated
 const stopResources=useCallback(()=>{recognitionRef.current?.stop?.();if(frameRef.current)cancelAnimationFrame(frameRef.current);faceRef.current?.close?.();streamRef.current?.getTracks().forEach(track=>track.stop());if(videoRef.current)videoRef.current.srcObject=null;streamRef.current=null;faceRef.current=null;frameRef.current=null;setListening(false)},[])
 const terminate=useCallback(()=>{stopResources();setShowWarning(false);setTerminated(true)},[stopResources])
 const addWarning=useCallback((message,type='generic')=>{const now=Date.now();if(now-(lastWarningRef.current[type]||0)<8000)return;lastWarningRef.current[type]=now;const next=warningRef.current+1;warningRef.current=next;setWarnings(next);if(next>=3){terminate();return}setWarningMessage(message);setShowWarning(true)},[terminate])
 const processFaces=useCallback((count)=>{setFaceCount(count);if(count>1){setProctorStatus('Multiple faces detected');addWarning('Multiple faces were detected. Ensure only you are visible.','multiple');return}if(count===0){setProctorStatus('Face not detected');if(!missingSinceRef.current)missingSinceRef.current=Date.now();if(Date.now()-missingSinceRef.current>=4000){addWarning('Your face was not detected for several seconds.','missing');missingSinceRef.current=Date.now()}return}missingSinceRef.current=null;setProctorStatus('Single candidate detected')},[addWarning])
 const startFaceDetection=useCallback(async()=>{try{setProctorStatus('Loading face detection…');const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.1/wasm');faceRef.current=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numFaces:2,minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5,minTrackingConfidence:.5});const detect=()=>{const video=videoRef.current;if(video&&faceRef.current&&video.readyState>=2){if(video.currentTime!==lastFrameRef.current){lastFrameRef.current=video.currentTime;processFaces(faceRef.current.detectForVideo(video,performance.now()).faceLandmarks?.length||0)}}frameRef.current=requestAnimationFrame(detect)};detect()}catch{setProctorStatus('Face detection unavailable')}},[processFaces])
 const startSpeech=useCallback(()=>{const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){setError('Speech recognition is unavailable in this browser. You can type your answer instead.');return}const recognition=new Recognition();recognition.continuous=true;recognition.interimResults=true;recognition.lang='en-US';recognition.onstart=()=>setListening(true);recognition.onend=()=>setListening(false);recognition.onresult=event=>{let finalText='',interimText='';for(let i=event.resultIndex;i<event.results.length;i++){const text=event.results[i][0].transcript;if(event.results[i].isFinal)finalText+=`${text} `;else interimText+=text}if(finalText){transcriptRef.current+=finalText;setTranscript(transcriptRef.current)}setInterim(interimText)};recognitionRef.current=recognition;try{recognition.start()}catch{}},[])
 const submitAnswer=useCallback(async()=>{if(!question||evaluating)return;recognitionRef.current?.stop?.();setEvaluating(true);try{const answer=transcriptRef.current.trim()||'[No response provided]';const evaluation=await evaluateMockAnswer(profile,question.question,answer);const next=[...evaluations,{question,answer,evaluation}];setEvaluations(next);if(index===questions.length-1){stopResources();setFinished(true)}else{setIndex(value=>value+1);setPhase('thinking');setSeconds(30);setTranscript('');setInterim('');transcriptRef.current=''}}catch(err){setError(err.message)}finally{setEvaluating(false)}},[question,evaluating,profile,evaluations,index,questions,stopResources])
 useEffect(()=>{if(!active||evaluating)return;if(seconds<=0){if(phase==='thinking'){setPhase('answer');setSeconds(120);startSpeech()}else submitAnswer();return}const timer=setTimeout(()=>setSeconds(value=>value-1),1000);return()=>clearTimeout(timer)},[active,evaluating,seconds,phase,startSpeech,submitAnswer])
 useEffect(()=>{const onHidden=()=>{if(document.hidden&&active)addWarning('You switched away from the interview window.','tab')};document.addEventListener('visibilitychange',onHidden);return()=>document.removeEventListener('visibilitychange',onHidden)},[active,addWarning])
 useEffect(()=>()=>stopResources(),[stopResources])
 const start=async()=>{setLoading(true);setError('');try{const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:true});streamRef.current=stream;setQuestions(await generateMockInterview(profile));setIndex(0);setPhase('thinking');setSeconds(30);setWarnings(0);warningRef.current=0;setEvaluations([]);setFinished(false);setTerminated(false);setTimeout(()=>{if(videoRef.current){videoRef.current.srcObject=stream;videoRef.current.play().catch(()=>{})}startFaceDetection()},150)}catch(err){stopResources();setError(err.name==='NotAllowedError'?'Allow camera and microphone access to begin the proctored interview.':err.message)}finally{setLoading(false)}}
 if(terminated)return <Card className="proctor-page"><Eyebrow>INTERVIEW TERMINATED</Eyebrow><h2>Integrity warning limit reached</h2><p>This mock interview ended after {warnings} warnings. Start again when your camera, microphone and interview tab are ready.</p><button className="primary-btn" onClick={()=>{setTerminated(false);setQuestions(null);setPhase('ready')}}>Return to interview setup</button></Card>
 if(finished){const average=(evaluations.reduce((sum,item)=>sum+(item.evaluation?.score||0),0)/Math.max(1,evaluations.length)).toFixed(1);return <Card className="proctor-page interview-result"><Eyebrow>MOCK INTERVIEW COMPLETE</Eyebrow><div className="feedback-score">{average}</div><h2>AI evaluation</h2>{evaluations.map(item=><div className="interview-feedback" key={item.question.id}><strong>{item.question.category} question · {item.evaluation?.score||0}/10</strong><p>{item.evaluation?.feedback}</p><small><b>Strengths:</b> {(item.evaluation?.strengths||[]).join(' · ')||'—'}<br/><b>Improve:</b> {item.evaluation?.improvement}</small></div>)}<button className="primary-btn" onClick={()=>{setFinished(false);setQuestions(null);setPhase('ready')}}>Start another mock</button></Card>}
 return <div className="proctor-layout"><section className="proctor-main"><div className="proctor-title"><div><Eyebrow>AI MOCK INTERVIEW</Eyebrow><h2>{question?`Question ${index+1} of ${questions.length}`:'Technical interview workspace'}</h2></div>{active&&<span className={`proctor-timer ${phase}`}>{phase==='thinking'?'🧠':'⏱'} {String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</span>}</div>{error&&<div className="parse-toast parse-toast--error">{error}</div>}{!question?<div className="mock-start"><div className="next-icon"><Video size={17}/></div><h2>Ready for your interview?</h2><p>Your camera and microphone are required. You will get 30 seconds to think and two minutes to answer each personalized question.</p><button className="primary-btn" disabled={loading} onClick={start}><Video size={14}/>{loading?'Preparing secure session…':'Start interview'}</button></div>:<><article className="proctor-question"><span className="status-chip purple">{question.category} question</span><h2>{question.question}</h2><p>{phase==='thinking'?'Use this time to structure your response. Your microphone starts with the answer phase.':'Speak naturally; your response is transcribed below. You may edit it before submitting.'}</p></article><section className="proctor-answer"><div><h3>Your answer</h3><span className={listening?'mic-live':''}>{listening?'● Microphone listening':'○ Microphone off'}</span></div><textarea value={transcript} onChange={event=>{transcriptRef.current=event.target.value;setTranscript(event.target.value)}} disabled={phase==='thinking'} placeholder={phase==='thinking'?'Think through your answer…':'Your spoken response will appear here. You can also type.'}/>{interim&&<p className="interim-text">{interim}</p>}<button className="primary-btn" disabled={phase==='thinking'||evaluating} onClick={submitAnswer}>{evaluating?'AI is evaluating…':index===questions.length-1?'Finish interview':'Next question'} <ArrowUpRight size={14}/></button></section></>}</section><aside className="proctor-side"><section className="camera-card"><div className="camera-head"><div><strong>Camera</strong><small>{proctorStatus}</small></div>{active&&<span>● LIVE</span>}</div><div className="camera-view"><video ref={videoRef} autoPlay muted playsInline/>{!active&&<div>🎥<br/><small>Camera preview starts when you begin.</small></div>}</div></section><section className="integrity-card"><Eyebrow>INTERVIEW INTEGRITY</Eyebrow><h3>Automated proctoring</h3><div className="integrity-row"><span>Warnings</span><b>{warnings} / 3</b></div><div className="integrity-row"><span>Face detection</span><b>{faceCount===1?'✓ Single candidate':faceCount>1?'! Multiple faces':'— Waiting'}</b></div><div className="integrity-row"><span>Browser activity</span><b>{active?'● Monitoring':'Ready'}</b></div><small>Leaving the tab, an absent face, or multiple faces creates a warning.</small></section><section className="interview-format"><Eyebrow>FORMAT</Eyebrow><p>2 personalized questions</p><p>30 sec thinking · 2 min answer</p><p>Camera + microphone required</p></section></aside>{showWarning&&<div className="warning-overlay"><div className="warning-modal"><b>WARNING {warnings} OF 3</b><h2>Interview integrity notice</h2><p>{warningMessage}</p><button className="primary-btn" onClick={()=>setShowWarning(false)}>I understand</button></div></div>}</div>
}
const GENERAL_RESOURCES = [
 {title:'NeetCode practice',topic:'DSA',note:'Structured coding patterns and interview problem practice.',url:'https://neetcode.io/practice'},
 {title:'Striver’s A2Z DSA Sheet',topic:'DSA',note:'Topic-by-topic DSA learning and problem sheet.',url:'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2/'},
 {title:'LeetCode problem set',topic:'Practice',note:'Solve and filter coding questions by topic and difficulty.',url:'https://leetcode.com/problemset/'},
 {title:'System Design Primer',topic:'System Design',note:'Open-source guide to scalable system design concepts and interviews.',url:'https://github.com/donnemartin/system-design-primer'},
 {title:'Full Stack Open',topic:'Fullstack',note:'Free University of Helsinki course for React, Node, APIs, databases and TypeScript.',url:'https://fullstackopen.com/en/'},
 {title:'GeeksforGeeks CS Core Subjects',topic:'CS Fundamentals',note:'Reference material for operating systems, networks, DBMS and OOP.',url:'https://www.geeksforgeeks.org/computer-science-subjects/'},
 {title:'IndiaBIX aptitude',topic:'Aptitude',note:'Quantitative and logical-reasoning practice questions.',url:'https://www.indiabix.com/'},
]
function Resources(){return <><Card><Eyebrow>STUDY LIBRARY</Eyebrow><h2>General interview-prep resources</h2><p>These direct links are separate from your roadmap. Open any resource whenever you want—no AI request is made.</p></Card><div className="resource-library">{GENERAL_RESOURCES.map(resource=><a key={resource.title} href={resource.url} target="_blank" rel="noreferrer"><span>{resource.topic}</span><b>{resource.title}</b><p>{resource.note}</p><small>Open website <ArrowUpRight size={12}/></small></a>)}</div></>}
const EXTERNAL_PRACTICE_LINKS=[{title:'LeetCode Two Sum',difficulty:'Easy',url:'https://leetcode.com/problems/two-sum/'},{title:'LeetCode Number of Islands',difficulty:'Medium',url:'https://leetcode.com/problems/number-of-islands/'},{title:'GeeksforGeeks Array Problems',difficulty:'Medium',url:'https://www.geeksforgeeks.org/array-data-structure/'}]
function CodingPractice(){
 const [source,setSource]=useState('bank'),[difficulty,setDifficulty]=useState(''),[items,setItems]=useState([]),[selectedQuestion,setSelectedQuestion]=useState(null),[loading,setLoading]=useState(true),[language,setLanguage]=useState('python'),[code,setCode]=useState(''),[running,setRunning]=useState(false),[runResult,setRunResult]=useState(null),[help,setHelp]=useState(''),[helpLoading,setHelpLoading]=useState(false),[showFix,setShowFix]=useState(false),[error,setError]=useState('')
 useEffect(()=>{let active=true;setLoading(true);setError('');setSelectedQuestion(null);setRunResult(null);setHelp('');const finish=data=>{if(active){setItems(data);setLoading(false)}};if(source==='external'){finish(EXTERNAL_PRACTICE_LINKS.filter(item=>!difficulty||item.difficulty.toLowerCase()===difficulty.toLowerCase()));return()=>{active=false}};(source==='codeforces'?getCodeforces(difficulty):getQuestions(difficulty)).then(data=>finish(data.problems||data.questions||[])).catch(err=>{if(active){setItems([]);setError(err.message);setLoading(false)}});return()=>{active=false}},[source,difficulty])
 const selectQuestion=item=>{setSelectedQuestion(item);setRunResult(null);setHelp('');setShowFix(false);setCode(item.starterCode?.[language]||'')}
 const changeLanguage=value=>{setLanguage(value);setCode(selectedQuestion?.starterCode?.[value]||'')}
 const execute=async()=>{if(!selectedQuestion||source!=='bank')return;setRunning(true);setError('');try{setRunResult(await runCode({question_id:selectedQuestion.id,language,code}))}catch(err){setError(err.message)}finally{setRunning(false)}}
 const askHelp=async fullFix=>{if(!selectedQuestion)return;setHelpLoading(true);setShowFix(fullFix);try{const failed=runResult?.results?.find(item=>!item.passed);const data=await getDebugHelp({question:selectedQuestion,code,output:failed?`${failed.stderr||''}\nExpected: ${failed.expected}\nReceived: ${failed.output}`:'No test run yet.',full_fix:fullFix});setHelp(data.reply)}catch(err){setHelp(err.message)}finally{setHelpLoading(false)}}
 const external=source==='external', runnable=source==='bank'
 return <><Card className="practice-hero"><div><Eyebrow>CODING PRACTICE</Eyebrow><h2>Practise, run, and debug in one workspace.</h2><p>My Bank includes runnable tests. Codeforces and external questions keep their full statement at the source.</p></div><Code2 size={32}/></Card><div className="practice-controls"><div className="source-tabs">{[['bank','My Bank'],['codeforces','Codeforces'],['external','External Links']].map(([key,label])=><button key={key} className={source===key?'active':''} onClick={()=>setSource(key)}>{label}</button>)}</div><select value={difficulty} onChange={event=>setDifficulty(event.target.value)}><option value="">All difficulties</option><option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option></select></div>{error&&<div className="parse-toast parse-toast--error">{error}</div>}<div className="practice-layout"><Card className="practice-list"><Eyebrow>{source==='bank'?'MY QUESTION BANK':source.toUpperCase()}</Eyebrow>{loading?<div className="practice-skeleton"><i/><i/><i/><i/></div>:items.length===0?<p>No questions match this filter.</p>:items.map(item=><button className={selectedQuestion?.id===item.id?'selected':''} key={item.id||item.url} onClick={()=>selectQuestion(item)}><span className={item.difficulty.toLowerCase()}>{item.difficulty}</span><b>{item.title}</b><small>{item.topic}{item.rating?` · ${item.rating}`:''}</small>{!runnable&&<ArrowUpRight size={13}/>}</button>)}</Card>{!selectedQuestion?<Card className="practice-empty"><Code2 size={28}/><h2>{loading?'Loading questions…':'Select a question'}</h2><p>Choose a question from the list to open the problem workspace.</p></Card>:<section className="leetcode-workspace"><article className="problem-pane"><div className="problem-pane-inner"><span className={`difficulty-tag ${selectedQuestion.difficulty.toLowerCase()}`}>{selectedQuestion.difficulty}</span><h2>{selectedQuestion.title}</h2><p className="problem-tags">{selectedQuestion.topic}{selectedQuestion.rating?` · Rating ${selectedQuestion.rating}`:''}</p>{runnable?<><h3>Description</h3><p>{selectedQuestion.description}</p><h3>Examples</h3>{selectedQuestion.examples?.map(example=><pre key={example.input}>Input: {example.input}{'\n'}Output: {example.output}</pre>)}<h3>Constraints</h3><ul>{selectedQuestion.constraints?.map(value=><li key={value}>{value}</li>)}</ul></>:<><h3>Problem details</h3><p>{external?'This is an external practice link.':'Codeforces supplies this metadata through its free API; the full statement remains on Codeforces.'}</p><p>Difficulty: {selectedQuestion.difficulty}{selectedQuestion.rating?` (${selectedQuestion.rating})`:''}</p><a className="primary-btn source-link" href={selectedQuestion.url} target="_blank" rel="noreferrer">{external?'Open external problem':'Full problem statement on Codeforces'} <ArrowUpRight size={14}/></a></>}</div></article><article className="code-pane"><div className="editor-toolbar"><div><b>Solution</b><small>{runnable?'Run against local hidden test cases.':'Execution is available only for My Bank questions with owned test cases.'}</small></div><select value={language} onChange={event=>changeLanguage(event.target.value)}><option value="python">Python</option><option value="javascript">JavaScript</option></select><button className="ghost-btn" onClick={()=>askHelp(false)} disabled={helpLoading}>{helpLoading?'Thinking…':'Get help'}</button><button className="primary-btn" onClick={execute} disabled={running||!runnable}>{running?'Running…':runnable?'Run code':'Run unavailable'}</button></div><Editor height="390px" language={language==='python'?'python':'javascript'} value={code} onChange={value=>setCode(value||'')} theme="vs-light" options={{minimap:{enabled:false},fontSize:13,automaticLayout:true}}/><div className="code-console"><Eyebrow>OUTPUT</Eyebrow>{running?<div className="console-loading">Executing private tests…</div>:runResult?<><b>{runResult.passed} / {runResult.total} tests passed</b>{runResult.results.map((item,index)=><div className={item.passed?'pass':'fail'} key={index}>Test {index+1}: {item.passed?'Passed':'Failed'} · expected {item.expected}, got {item.output||'—'} {item.stderr&&`(${item.stderr})`}</div>)}</>:<p>{runnable?'Run your code to see test results, stdout, and errors.':'Execution results are not available for external-source questions.'}</p>}</div>{help&&<div className="debug-help"><Eyebrow>{showFix?'DEBUG FIX':'DEBUG HINT'}</Eyebrow><p>{help}</p>{!showFix&&<button className="text-btn" onClick={()=>askHelp(true)}>Show full fix <ChevronRight size={13}/></button>}</div>}</article></section>}</div></>}
function AtsChecker({profile}){const [jobDescription,setJobDescription]=useState(''),[result,setResult]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');const run=async event=>{event.preventDefault();setLoading(true);setError('');try{setResult(await checkAtsResume(profile,jobDescription))}catch(err){setError(err.message)}finally{setLoading(false)}};return <><Card className="ats-hero"><div><Eyebrow>ATS RESUME CHECKER</Eyebrow><h2>Check your resume before you apply.</h2><p>Uses the profile extracted from your latest saved resume. Add a job description for a role-specific keyword comparison.</p></div><div className="ats-score-placeholder">{result?<><b>{result.score}</b><span>ATS score</span></>:<><FileText size={24}/><span>Ready to scan</span></>}</div></Card><Card><form className="ats-form" onSubmit={run}><label><span>Target job description <small>(optional but recommended)</small></span><textarea value={jobDescription} onChange={event=>setJobDescription(event.target.value)} placeholder="Paste the job description here to compare skills and ATS keywords…"/></label><button className="primary-btn" disabled={loading} type="submit"><Sparkles size={14}/>{loading?'Checking resume…':'Run ATS check'}</button></form>{error&&<div className="parse-toast parse-toast--error">{error}</div>}</Card>{result&&<><div className="ats-grid"><Card><Eyebrow>ATS SCORE</Eyebrow><div className="ats-score"><b>{result.score}</b><span>/100</span></div><p>{result.summary}</p></Card><Card><Eyebrow>KEYWORD COVERAGE</Eyebrow><h2>Matched vs missing</h2><div className="keyword-group"><b>Matched</b><div>{(result.matched_keywords||[]).map(item=><span className="matched" key={item}>{item}</span>)||'—'}</div></div><div className="keyword-group"><b>Missing / strengthen</b><div>{(result.missing_keywords||[]).map(item=><span className="missing" key={item}>{item}</span>)||'—'}</div></div></Card></div><div className="ats-grid"><Card><Eyebrow>SECTION HEALTH</Eyebrow>{(result.section_scores||[]).map(item=><div className="ats-section" key={item.name}><div><b>{item.name}</b><small>{item.note}</small></div><span>{item.score}%</span></div>)}</Card><Card><Eyebrow>PRIORITY FIXES</Eyebrow>{(result.improvements||[]).map(item=><div className="ats-fix" key={`${item.priority}-${item.title}`}><span className={item.priority}>{item.priority}</span><div><b>{item.title}</b><p>{item.detail}</p></div></div>)}</Card></div></>}</>}
function Analytics({profile}){const username=githubUsername(profile?.github||'');const [data,setData]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');const fetchedUsername=useRef('');const load=useCallback(async(force=false)=>{if(!username||(!force&&fetchedUsername.current===username))return;fetchedUsername.current=username;setLoading(true);setError('');try{setData(await fetchGithubAnalytics(username))}catch(err){setData(null);setError(err.message)}finally{setLoading(false)}},[username]);useEffect(()=>{load()},[load]);if(!username)return <Card><Eyebrow>GITHUB ANALYTICS</Eyebrow><h2>Add your GitHub profile first</h2><p>Use Update resume to add a public GitHub URL, then return here to see repositories, branches, recent public commits and open-source activity.</p></Card>;return <><Card className="github-hero"><div className="card-head"><div><Eyebrow>GITHUB ANALYTICS</Eyebrow><h2>{data?.account?.name||username}</h2><p>{data?.account?.bio||'Loading public GitHub profile…'}</p></div><button className="ghost-btn" onClick={()=>load(true)} disabled={loading}>{loading?'Loading…':'Refresh'}</button></div>{error&&<p className="resource-error">{error}</p>}{data&&<><div className="github-profile"><img src={data.account.avatar} alt="GitHub profile"/><a href={data.account.profileUrl} target="_blank" rel="noreferrer">@{data.account.login} <ArrowUpRight size={13}/></a></div><div className="metrics github-metrics"><Metric label="Public repos" value={data.stats.repositories} suffix=""/><Metric label="Recent public commits" value={data.stats.recentCommits} suffix=""/><Metric label="Branches scanned" value={data.stats.branches} suffix=""/><Metric label="Open-source activity" value={data.stats.openSourceActivity} suffix=""/></div><p className="github-note">Branches are counted across the {data.stats.scannedRepositories} most recently updated public repositories. Commit and contribution activity reflects GitHub’s recent public activity feed.</p></>}</Card>{data&&<Card><div className="card-head"><div><Eyebrow>PUBLIC REPOSITORIES</Eyebrow><h2>Projects and descriptions</h2></div><span className="status-chip blue"><GitBranch size={12}/> Public data</span></div><div className="github-repos">{data.repositories.map(repo=><a href={repo.url} target="_blank" rel="noreferrer" key={repo.url}><b>{repo.name}</b><p>{repo.description}</p><span>{repo.language} · ★ {repo.stars} · Forks {repo.forks}</span></a>)}</div></Card>}</>}
export default App
