import { useState, useRef, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isConfigured } from '../lib/supabase'

interface Props {
  user: User | null
  syncing: boolean
  lastSynced: Date | null
  onSynced: () => void
}

type PanelState = 'idle' | 'sending' | 'sent' | 'verifying'

export default function AuthButton({ user, syncing, lastSynced, onSynced }: Props) {
  const [open, setOpen]               = useState(false)
  const [email, setEmail]             = useState('')
  const [code, setCode]               = useState('')
  const [panelState, setPanelState]   = useState<PanelState>('idle')
  const [error, setError]             = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef   = useRef<HTMLButtonElement>(null)
  const codeRef  = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current   && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus code input when it appears
  useEffect(() => {
    if (panelState === 'sent') setTimeout(() => codeRef.current?.focus(), 50)
  }, [panelState])

  if (!isConfigured) return null

  const sendOtp = async () => {
    if (!email.trim()) return
    setError('')
    setPanelState('sending')
    const { error: err } = await supabase!.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Keep redirect for desktop / browser users who click the link;
        // PWA / home-screen users will use the 6-digit code instead.
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
        shouldCreateUser: true,
      },
    })
    if (err) { setError(err.message); setPanelState('idle') }
    else { setCode(''); setPanelState('sent') }
  }

  const verifyCode = async () => {
    const token = code.replace(/\D/g, '').slice(0, 6)
    if (token.length < 6) { setError('Enter the full 6-digit code.'); return }
    setError('')
    setPanelState('verifying')
    const { error: err } = await supabase!.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    })
    if (err) { setError(err.message); setPanelState('sent') }
    // On success the onAuthStateChange listener in App.tsx fires automatically
    else setOpen(false)
  }

  const reset = () => { setPanelState('idle'); setEmail(''); setCode(''); setError('') }

  const signOut = async () => { await supabase!.auth.signOut(); setOpen(false) }

  const formatLastSynced = () => {
    if (!lastSynced) return 'not yet'
    const diff = Math.round((Date.now() - lastSynced.getTime()) / 1000)
    if (diff < 10)   return 'just now'
    if (diff < 60)   return `${diff}s ago`
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`
    return lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? ''

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Trigger button ── */}
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        title={user ? user.email : 'Sign in to sync'}
        style={{
          width: 32, height: 32, borderRadius: '50%',
          border: `1px solid ${user ? 'var(--teal)' : 'var(--border2)'}`,
          background: user ? 'rgba(58,144,144,0.15)' : 'var(--bg3)',
          color: user ? 'var(--teal-light)' : 'var(--muted)',
          cursor: 'pointer', fontSize: 11,
          fontFamily: '"DM Mono", monospace', fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .2s', flexShrink: 0, position: 'relative',
        }}
      >
        {user ? initials : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        )}
        {syncing && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--amber)', border: '1.5px solid var(--bg)',
            animation: 'pulse 1s infinite',
          }} />
        )}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute', top: 40, right: 0, zIndex: 200,
            width: 278, background: 'var(--bg2)',
            border: '1px solid var(--border2)', borderRadius: 12,
            padding: 18, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            fontFamily: '"DM Sans", sans-serif',
          }}
        >
          {!user ? (
            <>
              {/* ── Step 1: email entry ── */}
              {(panelState === 'idle' || panelState === 'sending') && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
                    Sync across devices
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
                    Enter your email — we'll send a 6-digit code.
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendOtp()}
                    placeholder="your@email.com"
                    autoComplete="email"
                    style={inputStyle}
                  />
                  {error && <div style={errorStyle}>{error}</div>}
                  <button
                    onClick={sendOtp}
                    disabled={panelState === 'sending' || !email.trim()}
                    style={{
                      ...primaryBtn,
                      opacity: panelState === 'sending' || !email.trim() ? 0.6 : 1,
                    }}
                  >
                    {panelState === 'sending' ? 'Sending…' : 'Send code'}
                  </button>
                </>
              )}

              {/* ── Step 2: code verification ── */}
              {(panelState === 'sent' || panelState === 'verifying') && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
                    Enter your code
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
                    Check <strong style={{ color: 'var(--teal-light)' }}>{email}</strong> for a
                    6-digit code and enter it below.
                  </div>
                  <input
                    ref={codeRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setCode(v)
                      setError('')
                    }}
                    onKeyDown={e => e.key === 'Enter' && verifyCode()}
                    placeholder="123456"
                    autoComplete="one-time-code"
                    style={{
                      ...inputStyle,
                      letterSpacing: '0.25em',
                      fontSize: 20,
                      textAlign: 'center',
                      fontFamily: '"DM Mono", monospace',
                    }}
                  />
                  {error && <div style={errorStyle}>{error}</div>}
                  <button
                    onClick={verifyCode}
                    disabled={panelState === 'verifying' || code.length < 6}
                    style={{
                      ...primaryBtn,
                      opacity: panelState === 'verifying' || code.length < 6 ? 0.6 : 1,
                      marginBottom: 8,
                    }}
                  >
                    {panelState === 'verifying' ? 'Verifying…' : 'Verify code'}
                  </button>
                  <button onClick={reset} style={linkBtn}>
                    Use a different email
                  </button>
                </>
              )}
            </>
          ) : (
            // ── Signed-in panel ─────────────────────────────────
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(58,144,144,0.2)', border: '1px solid var(--teal)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: 'var(--teal-light)',
                  fontFamily: '"DM Mono", monospace', flexShrink: 0,
                }}>
                  {initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: '"DM Mono", monospace', marginTop: 2 }}>
                    {syncing
                      ? <span style={{ color: 'var(--amber-light)' }}>syncing…</span>
                      : <span>synced: <span style={{ color: 'var(--teal-light)' }}>{formatLastSynced()}</span></span>
                    }
                  </div>
                </div>
              </div>

              <button
                onClick={() => { onSynced(); setOpen(false) }}
                disabled={syncing}
                style={{
                  width: '100%', padding: '7px 0', marginBottom: 6,
                  background: 'var(--bg3)', border: '1px solid var(--border2)',
                  borderRadius: 7, color: syncing ? 'var(--muted2)' : 'var(--muted)',
                  fontSize: 12, cursor: syncing ? 'default' : 'pointer',
                  fontFamily: '"DM Mono", monospace',
                }}
              >
                {syncing ? 'syncing…' : '↻ Sync now'}
              </button>

              <button
                onClick={signOut}
                style={{
                  width: '100%', padding: '7px 0',
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 7, color: 'var(--muted)',
                  fontSize: 12, cursor: 'pointer',
                  fontFamily: '"DM Mono", monospace',
                }}
              >
                Sign out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', marginBottom: 8,
  background: 'var(--bg3)', border: '1px solid var(--border2)',
  borderRadius: 7, padding: '9px 10px',
  color: 'var(--text)', fontSize: 14,
  fontFamily: '"DM Sans", sans-serif', outline: 'none',
}

const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '9px 0',
  background: 'var(--teal)', border: '1px solid var(--teal)',
  borderRadius: 7, color: '#fff',
  fontSize: 13, cursor: 'pointer',
  fontFamily: '"DM Mono", monospace',
}

const errorStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--coral-light)', marginBottom: 8, lineHeight: 1.4,
}

const linkBtn: React.CSSProperties = {
  display: 'block', width: '100%',
  background: 'none', border: 'none', color: 'var(--muted)',
  fontSize: 11, cursor: 'pointer', textAlign: 'center',
  fontFamily: '"DM Sans", sans-serif', textDecoration: 'underline',
  padding: '4px 0',
}
