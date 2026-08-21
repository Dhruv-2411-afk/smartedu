import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  Activity, ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays, Check, ChevronRight,
  CircleHelp, Code2, FileText, GitBranch, Home, LineChart, Lock, Menu, MessageSquare,
  Plus, Search, Settings, Sparkles, Target, TrendingUp, Upload, Users, Video, X, Zap,
  Loader2, LogOut
} from 'lucide-react'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import { parseResume } from './lib/resumeParser'
import { generateSkillAssessment, learningResourceFor } from './lib/assessment'
import { evaluateMockAnswer, generateMockInterview } from './lib/interview'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const NAV = [
  ['Overview', Home], ['Readiness', Target], ['Skills', Code2], ['Roadmap', FileText],
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
const COMPANIES=[
  {name:'Microsoft',role:'Software Engineer',match:86,missing:['DSA','System Design']},{name:'Razorpay',role:'Frontend Engineer',match:92,missing:['Testing']},{name:'Google',role:'SWE Intern',match:78,missing:['Advanced DSA','System Design']},{name:'Zoho',role:'Product Engineer',match:74,missing:['DSA','Aptitude']}
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
 const [section,setSection]=useState('Overview'); const [skills,setSkills]=useState([]); const [tasks,setTasks]=useState([]); const [apps,setApps]=useState(APPLICATIONS); const [search,setSearch]=useState(''); const [showNav,setShowNav]=useState(false)
 const [quiz,setQuiz]=useState(null); const [quizLoading,setQuizLoading]=useState(false); const [quizError,setQuizError]=useState('')
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
 useEffect(()=>{
   if (!profile) return
   setSkills(analysis.skills)
   setTasks(analysis.tasks)
 },[profile,analysis])
 const verified=skills.filter(s=>s.status==='Verified').length; const score=Math.min(96,analysis.readiness+verified*2); const missing=skills.filter(s=>s.status!=='Verified').slice(0,3)
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
    {NAV.map(([label,Icon])=><button key={label} onClick={()=>{setSection(label);setShowNav(false)}} className={`side-link ${section===label?'active':''}`}><Icon size={17}/><span>{label}</span>{label==='Analytics'&&<em>2</em>}</button>)}
    <div className="side-divider"/><div className="side-label">CAREER TWIN</div>
    <div className="twin-card"><div className="twin-head"><span className="twin-avatar"><Sparkles size={13}/></span><div><strong>Career Twin</strong><small>Synced just now</small></div></div><div className="twin-score"><b>{score}%</b><span>readiness</span></div><div className="mini-bar"><span style={{width:`${score}%`}}/></div></div>
    <div className="side-bottom"><button className="side-link"><Settings size={17}/><span>Settings</span></button><button className="side-link"><CircleHelp size={17}/><span>Help</span></button></div>
   </aside>
   <main className="main">
    <div className="main-inner">
      <div className="command-head"><div><div className="breadcrumb">Workspace <ChevronRight size={12}/> {section}</div><h1>{title}</h1><p>{section==='Overview' ? `${profile?.form?.role || 'Your target role'} profile, gaps, active applications and next actions in one live workspace.` : 'Career intelligence built around your current resume and target role.'}</p></div><div className="head-actions"><button className="ghost-btn" onClick={()=>setOnboarded(false)}><Upload size={14}/> Update resume</button><button className="primary-btn" onClick={()=>setSection('Skills')}><Zap size={14}/> Verify skill</button></div></div>
      {quizError&&<div className="parse-toast parse-toast--error">{quizError}</div>}
      {section==='Overview'&&<Overview score={score} missing={missing} tasks={tasks} apps={apps} setSection={setSection} role={profile?.form?.role} skills={skills}/>} 
      {section==='Readiness'&&<Readiness score={score}/>} 
      {section==='Skills'&&<Skills skills={filtered} search={search} setSearch={setSearch} verify={startVerification} loading={quizLoading}/>} 
      {section==='Roadmap'&&<Roadmap tasks={tasks} toggle={toggle}/>} 
      {section==='Companies'&&<Companies setSection={setSection} role={profile?.form?.role} skills={skills}/>} 
      {section==='Applications'&&<Applications apps={apps} stage={stage}/>} 
      {section==='Interviews'&&<Interviews profile={profile?.form}/>} 
      {section==='Analytics'&&<Analytics/>}
      {quiz&&<SkillQuiz quiz={quiz} setQuiz={setQuiz} onFinish={finishQuiz} onClose={()=>setQuiz(null)}/>}
    </div>
   </main>

 </div>
}
function Overview({score,missing,tasks,apps,setSection,role,skills}){const verified=skills.filter(skill=>skill.status==='Verified').length; return <>
 <div className="overview-grid">
  <Card className="readiness-card"><div className="card-top"><Eyebrow>READINESS</Eyebrow><span className="status-chip green"><span/> On track</span></div><div className="readiness-main"><div><div className="readiness-number">{score}<small>%</small></div><h2>ready for {role || 'your target role'} opportunities</h2><p>Your current resume, stated skills and completed roadmap tasks drive this score.</p><button className="primary-btn" onClick={()=>setSection('Readiness')}>Open readiness <ArrowUpRight size={14}/></button></div><div className="ring" style={{'--score':score}}><div><b>{score}%</b><small>overall</small></div></div></div></Card>
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
function Readiness({score}){return <div className="content-grid"><Card className="large-card"><div className="readiness-dashboard"><div className="big-ring" style={{'--score':score}}><div><b>{score}%</b><small>overall</small></div></div><div><Eyebrow>READINESS MODEL</Eyebrow><h2>Four signals shape your career readiness.</h2><p>Every verified skill, roadmap completion and interview outcome feeds the Career Twin.</p>{Object.entries(READINESS).map(([k,v])=><div className="pillar" key={k}><span>{k}</span><div><i style={{width:`${v}%`}}/></div><b>{v}%</b></div>)}</div></div></Card><Card><Eyebrow>WHAT MOVES THIS NEXT</Eyebrow>{['Verify DSA','Complete aptitude set','Practice system design'].map((x,i)=><div className="priority" key={x}><span>{i+1}</span><div><strong>{x}</strong><small>Estimated impact +{4-i}% readiness</small></div><ChevronRight size={14}/></div>)}</Card></div>}
function Skills({skills,search,setSearch,verify,loading}){return <Card><div className="toolbar"><div><Eyebrow>SKILL GRAPH</Eyebrow><h2>Verify each claimed skill with a tailored assessment.</h2></div><div className="search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search skills"/></div></div><div className="skill-table">{skills.map(s=><div className="skill-row" key={s.name}><div><strong>{s.name}</strong><small>{s.cat}</small></div><span className={`status ${s.status.toLowerCase().replace(/\s+/g,'-')}`}>{s.status}</span><div className="skill-bar"><i style={{width:`${s.score||0}%`}}/></div><b>{s.score!==null?`${s.score}%`:'—'}</b>{s.status!=='Verified'&&<button className="verify-btn" disabled={loading} onClick={()=>verify(s)}>{loading?'Preparing…':s.status==='Needs practice'?'Retry quiz':'Verify'}</button>}</div>)}</div></Card>}
function SkillQuiz({quiz,setQuiz,onFinish,onClose}){const resource=learningResourceFor(quiz.skill.name); const unanswered=quiz.questions.some(question=>!quiz.answers[question.id]); return <div className="modal-backdrop"><section className="modal quiz-modal"><div className="quiz-header"><div><Eyebrow>SKILL ASSESSMENT</Eyebrow><h2>{quiz.skill.name} verification</h2><p>{quiz.questions.length} questions · Pass at 70%</p></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>{quiz.questions.map((question,index)=><div className="quiz-question" key={question.id}><div className="quiz-question-head"><span>{index+1}</span><div><small>{question.difficulty} · {question.topic}</small><strong>{question.question}</strong></div></div><div className="quiz-options">{Object.entries(question.options).map(([key,value])=>{const checked=quiz.answers[question.id]===key; const answerClass=quiz.submitted?(key===question.correct_answer?'correct':checked?'incorrect':''):''; return <label className={`quiz-option ${answerClass}`} key={key}><input type="radio" name={`question-${question.id}`} checked={checked} disabled={quiz.submitted} onChange={()=>setQuiz(current=>({...current,answers:{...current.answers,[question.id]:key}}))}/><span>{key}</span>{value}</label>})}</div>{quiz.submitted&&<p className="quiz-explanation">{question.explanation}</p>}</div>)}{quiz.submitted?<div className={`quiz-result ${quiz.passed?'pass':'fail'}`}><strong>{quiz.passed?`Verified — ${quiz.score}%`:`Not verified — ${quiz.score}%`}</strong><p>{quiz.passed?'This skill is now reflected as verified throughout your CDC.':<>Review <a href={resource.url} target="_blank" rel="noreferrer">{resource.label}</a>, then retake this assessment when you are ready.</>}</p><button className="primary-btn" onClick={onClose}>Back to skills</button></div>:<div className="quiz-footer"><span>{unanswered?'Answer every question to submit.':'Ready to submit your assessment.'}</span><button className="primary-btn" disabled={unanswered} onClick={onFinish}>Submit assessment <ArrowUpRight size={14}/></button></div>}</section></div>}
function Roadmap({tasks,toggle}){return <div className="content-grid"><Card className="large-card"><div className="card-head"><div><Eyebrow>SKILL GAP ENGINE</Eyebrow><h2>Four-week path to close your biggest gaps.</h2></div><span className="status-chip purple"><Sparkles size={12}/> Auto-generated</span></div><div className="roadmap-line">{tasks.map((t,i)=><div className={`roadmap-task ${t.done?'done':''}`} key={t.id}><button onClick={()=>toggle(t.id)} className="check">{t.done&&<Check size={13}/>}</button><div className="week">W{i+1}</div><div><strong>{t.title}</strong><small>{t.due} · {t.impact}</small></div><ChevronRight size={14}/></div>)}</div></Card><Card><Eyebrow>PROGRESS</Eyebrow><div className="progress-number">{tasks.filter(t=>t.done).length}<small> / {tasks.length}</small></div><p>weeks/tasks currently on track.</p><div className="mini-bar"><span style={{width:`${tasks.filter(t=>t.done).length/tasks.length*100}%`}}/></div></Card></div>}
function Companies({setSection,role,skills}){const have=skills.map(s=>s.name).slice(0,3); return <Card><div className="card-head"><div><Eyebrow>COMPANY MATCH</Eyebrow><h2>Where your profile is strongest.</h2></div><span className="status-chip blue"><Target size={12}/> Skill gap engine</span></div><div className="company-grid">{COMPANIES.map(c=>{const missing=c.missing.filter(item=>!skills.some(skill=>skill.name.toLowerCase().includes(item.toLowerCase()))); const match=Math.min(96,Math.max(55,c.match+(skills.length-3)*2-missing.length*2)); return <div className="company-card" key={c.name}><div className="company-head"><div className="company-logo">{c.name[0]}</div><div><strong>{c.name}</strong><small>{role || c.role}</small></div><b>{match}%</b></div><div className="matchbar"><i style={{width:`${match}%`}}/></div><div className="have-missing"><div><small>You have</small><span>{have.join(' · ') || 'Add skills in your profile'}</span></div><div><small>Missing</small><span className="missing">{missing.join(' · ') || 'No priority gaps'}</span></div></div><button className="text-btn" onClick={()=>setSection(match>=85?'Applications':'Roadmap')}>{match>=85?'Apply flow':'Close skill gap'} <ArrowUpRight size={13}/></button></div>})}</div></Card>}
function Applications({apps,stage}){return <div className="content-grid"><Card className="large-card"><div className="card-head"><div><Eyebrow>APPLICATION TRACKER</Eyebrow><h2>Your placement pipeline.</h2></div><button className="primary-btn"><Plus size={14}/> Add application</button></div>{apps.map((a,i)=><div className="application-row" key={a.company}><div className="company-logo small">{a.company[0]}</div><div><strong>{a.company}</strong><small>{a.role} · {a.date}</small></div><select value={a.stage} onChange={e=>stage(i,e.target.value)}><option>Applied</option><option>Screening</option><option>Interview</option><option>Offer</option><option>Rejected</option></select><ChevronRight size={14}/></div>)}</Card><Card><Eyebrow>REJECTION INTELLIGENCE</Eyebrow><div className="rejection-number">4 / 5</div><p>recent rejections involve DSA or technical rounds.</p><div className="recommendation"><strong>Recommended action</strong><span>Add 3 DSA practice blocks to your roadmap.</span></div></Card></div>}
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
function Analytics(){const points='0,140 90,126 180,118 270,92 360,84 450,64 540,46 630,35';return <><Card className="analytics-card"><div className="card-head"><div><Eyebrow>CAREER TWIN TREND</Eyebrow><h2>Readiness over time</h2></div><span className="trend"><TrendingUp size={14}/> +12% this month</span></div><div className="chart"><svg viewBox="0 0 630 160" preserveAspectRatio="none"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg><div className="chart-labels"><span>Jul 1</span><span>Jul 15</span><span>Aug 1</span><span>Aug 21</span></div></div></Card><div className="content-grid"><Card><Eyebrow>REJECTION INTELLIGENCE</Eyebrow><div className="rejection-number">DSA</div><p>4 of your last 5 rejections included a DSA-heavy round.</p><div className="recommendation"><strong>Next move</strong><span>Prioritize timed DSA practice before your next interview.</span></div></Card><Card><div className="card-head"><div><Eyebrow>ROLE VIEW</Eyebrow><h2>Student analytics</h2></div><span className="status-chip green"><Users size={12}/> Cohort ready</span></div><div className="cohort"><Metric label="Avg readiness" value="74" suffix="%"/><Metric label="Skill gap" value="3.2" suffix=" avg"/><Metric label="Placement" value="68" suffix="%"/></div></Card></div></>}
export default App
