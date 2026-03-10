import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'error'|'success', text }

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      setLoading(false)
      if (error) setMessage({ type: 'error', text: error.message })
      else setMessage({ type: 'success', text: 'Check your email for a reset link.' })
      return
    }

    const fn = mode === 'signup' ? supabase.auth.signUp : supabase.auth.signInWithPassword
    const { error } = await fn.call(supabase.auth, { email, password })
    setLoading(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else if (mode === 'signup') {
      setMessage({ type: 'success', text: 'Check your email to confirm your account.' })
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <div style={styles.logoName}>Curiosity Map</div>
          <div style={styles.logoSub}>Your personal travel journal</div>
        </div>

        <form onSubmit={handle} style={styles.form}>
          <div style={styles.modeRow}>
            {['signin', 'signup'].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setMessage(null) }}
                style={{ ...styles.modeBtn, ...(mode === m ? styles.modeBtnOn : {}) }}
              >
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {message && (
            <div style={{ ...styles.msg, ...(message.type === 'error' ? styles.msgErr : styles.msgOk) }}>
              {message.text}
            </div>
          )}

          <label style={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={styles.input}
            placeholder="you@example.com"
            autoComplete="email"
          />

          {mode !== 'reset' && (
            <>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                style={styles.input}
                placeholder="••••••••"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </>
          )}

          <button type="submit" disabled={loading} style={styles.submit}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>

          {mode === 'signin' && (
            <button type="button" onClick={() => { setMode('reset'); setMessage(null) }} style={styles.forgotBtn}>
              Forgot password?
            </button>
          )}
          {mode === 'reset' && (
            <button type="button" onClick={() => { setMode('signin'); setMessage(null) }} style={styles.forgotBtn}>
              ← Back to sign in
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

const styles = {
  page: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f7f7f5',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  card: {
    background: '#fff',
    border: '1px solid #e8e8e4',
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 4px 32px rgba(0,0,0,0.06)',
  },
  logoWrap: { textAlign: 'center', marginBottom: 28 },
  logoName: { fontSize: 22, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.3px' },
  logoSub: { fontSize: 13, color: '#999', marginTop: 4 },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  modeRow: {
    display: 'flex',
    background: '#f0f0ee',
    borderRadius: 10,
    padding: 3,
    marginBottom: 6,
    gap: 3,
  },
  modeBtn: {
    flex: 1,
    border: 'none',
    background: 'none',
    borderRadius: 8,
    padding: '8px 0',
    fontSize: 13,
    fontFamily: 'inherit',
    fontWeight: 500,
    color: '#888',
    cursor: 'pointer',
  },
  modeBtnOn: {
    background: '#fff',
    color: '#1a1a1a',
    fontWeight: 600,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  msg: {
    padding: '10px 13px',
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.5,
  },
  msgErr: { background: '#fff5f5', border: '1px solid #fcc', color: '#c44' },
  msgOk: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
    marginBottom: -4,
  },
  input: {
    width: '100%',
    background: '#fafaf8',
    border: '1.5px solid #e8e8e4',
    borderRadius: 9,
    padding: '10px 13px',
    fontSize: 14,
    fontFamily: 'inherit',
    color: '#1a1a1a',
    outline: 'none',
    boxSizing: 'border-box',
  },
  submit: {
    marginTop: 6,
    background: '#1a1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: 9,
    padding: '12px',
    fontSize: 14,
    fontFamily: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
  forgotBtn: {
    background: 'none',
    border: 'none',
    color: '#999',
    fontSize: 12,
    fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'center',
    padding: '4px 0',
  },
}
