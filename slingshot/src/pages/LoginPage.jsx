import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, Check, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const clearMessages = () => { setError(''); setSuccess('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearMessages()
    setLoading(true)
    try {
      if (mode === 'forgot') {
        await resetPassword(email)
        setSuccess('Password reset link sent! Check your inbox.')
        setTimeout(() => setMode('signin'), 3000)
      } else if (mode === 'signup') {
        await signUp(email, password)
        setSuccess('Account created! Check your email to confirm, then sign in.')
        setTimeout(() => { setMode('signin'); setSuccess('') }, 3500)
      } else {
        await signIn(email, password)
        // Auth state change will handle redirect
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    clearMessages()
  }

  return (
    <div className="login-shell">
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-orb login-orb--1" />
        <div className="login-orb login-orb--2" />
        <div className="login-orb login-orb--3" />
      </div>

      <div className="login-container">
        {/* Brand header */}
        <div className="login-brand">
          <span className="brand-mark"><Sparkles size={18} /></span>
          <span className="login-brand-text">Slingshot</span>
        </div>

        {/* Glass card */}
        <div className="login-card">
          <div className="login-card-header">
            <h1>
              {mode === 'forgot' ? 'Reset password' : mode === 'signup' ? 'Create account' : 'Welcome back'}
            </h1>
            <p>
              {mode === 'forgot'
                ? 'Enter your email and we\'ll send a reset link.'
                : mode === 'signup'
                ? 'Start building your career trajectory today.'
                : 'Sign in to your Slingshot workspace.'}
            </p>
          </div>

          {/* Error / success toast */}
          {error && (
            <div className="login-toast login-toast--error">
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="login-toast login-toast--success">
              <Check size={14} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <label className="login-field">
              <span>Email address</span>
              <div className="login-input-wrap">
                <Mail size={16} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            </label>

            {mode !== 'forgot' && (
              <label className="login-field">
                <span>Password</span>
                <div className="login-input-wrap">
                  <Lock size={16} />
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Your password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    className="login-eye"
                    onClick={() => setShowPw(!showPw)}
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </label>
            )}

            {mode === 'signin' && (
              <button
                type="button"
                className="login-forgot-link"
                onClick={() => switchMode('forgot')}
              >
                Forgot password?
              </button>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 size={16} className="login-spinner" /> Processing…</>
              ) : mode === 'forgot' ? (
                <>Send reset link <ArrowRight size={15} /></>
              ) : mode === 'signup' ? (
                <>Create account <Sparkles size={15} /></>
              ) : (
                <>Sign in <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <div className="login-divider">
            <span />
            <small>{mode === 'forgot' ? 'or' : 'or continue with'}</small>
            <span />
          </div>

          <div className="login-switch">
            {mode === 'forgot' ? (
              <p>
                Remembered it?{' '}
                <button type="button" onClick={() => switchMode('signin')}>
                  Back to sign in
                </button>
              </p>
            ) : mode === 'signup' ? (
              <p>
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('signin')}>
                  Sign in
                </button>
              </p>
            ) : (
              <p>
                Don't have an account?{' '}
                <button type="button" onClick={() => switchMode('signup')}>
                  Create one
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Trust badges */}
        <div className="login-trust">
          <span><Check size={12} /> Resume intelligence</span>
          <span><Check size={12} /> Verified skills</span>
          <span><Check size={12} /> Role matching</span>
        </div>
      </div>
    </div>
  )
}
