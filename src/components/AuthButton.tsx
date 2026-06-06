import { useState, useRef, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isConfigured } from '../lib/supabase'

interface Props {
  user: User | null
  syncing: boolean
  lastSynced: Date | null
  onSynced: () => void
  onExport: () => void
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void
}

type PanelState = 'idle' | 'sending' | 'sent' | 'verifying'

export default function AuthButton({ user, syncing, lastSynced, onSynced, onExport, onImportFile }: Props) {
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

  // Must be before the early return — hooks can't be called conditionally
  const lastSyncedLabel = useMemo(() => {
    if (!lastSynced) return 'not yet'
    // eslint-disable-next-line react-hooks/purity -- Date.now() in useMemo is intentional
    const diff = Math.round((Date.now() - lastSynced.getTime()) / 1000)
    if (diff < 10)   return 'just now'
    if (diff < 60)   return `${diff}s ago`
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`
    return lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [lastSynced])

  // When Supabase is not configured (local dev / E2E without .env.local), render a
  // minimal settings button so Export / Import are still accessible everywhere.
  if (!isConfigured) {
    return (
      <div className="auth-wrap">
        <button
          ref={btnRef}
          aria-label="Settings"
          onClick={() => setOpen(o => !o)}
          title="Data backup"
          className="auth-avatar"
        >
          ⚙
        </button>
        {open && (
          <div ref={panelRef} className="auth-panel auth-panel--narrow">
            <div className="auth-panel-label">Data backup</div>
            <div className="auth-panel-btn-row">
              <button
                onClick={() => { onExport(); setOpen(false) }}
                className="auth-panel-btn"
              >
                ↓ Export
              </button>
              <label className="auth-panel-btn">
                ↑ Import
                <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => { onImportFile(e); setOpen(false) }} />
              </label>
            </div>
          </div>
        )}
      </div>
    )
  }

  const sendOtp = async () => {
    if (!email.trim()) return
    setError('')
    setPanelState('sending')
    const { error: err } = await supabase!.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Keep redirect for desktop / browser users who click the link;
        // PWA / home-screen users will use the 8-digit code instead.
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
        shouldCreateUser: true,
      },
    })
    if (err) { setError(err.message); setPanelState('idle') }
    else { setCode(''); setPanelState('sent') }
  }

  const verifyCode = async () => {
    const token = code.replace(/\D/g, '').slice(0, 8)
    if (token.length < 8) { setError('Enter the full 8-digit code.'); return }
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

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? ''

  return (
    <div className="auth-wrap">
      {/* ── Trigger button ── */}
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        title={user ? user.email : 'Sign in to sync'}
        className={`auth-avatar${user ? ' auth-avatar--signed-in' : ''}`}
      >
        {user ? initials : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        )}
        {syncing && <span className="auth-avatar__badge" />}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div ref={panelRef} className="auth-panel">
          {!user ? (
            <>
              {/* ── Step 1: email entry ── */}
              {(panelState === 'idle' || panelState === 'sending') && (
                <>
                  <div className="auth-panel-heading">Sync across devices</div>
                  <div className="auth-panel-sub">
                    Enter your email — we'll send an 8-digit code.
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendOtp()}
                    placeholder="your@email.com"
                    autoComplete="email"
                    className="tinput mb-8"
                  />
                  {error && <div className="auth-panel-error">{error}</div>}
                  <button
                    onClick={sendOtp}
                    disabled={panelState === 'sending' || !email.trim()}
                    className="auth-panel-btn auth-panel-btn--primary"
                    style={{ opacity: panelState === 'sending' || !email.trim() ? 0.6 : 1 }}
                  >
                    {panelState === 'sending' ? 'Sending…' : 'Send code'}
                  </button>
                </>
              )}

              {/* ── Step 2: code verification ── */}
              {(panelState === 'sent' || panelState === 'verifying') && (
                <>
                  <div className="auth-panel-heading">Enter your code</div>
                  <div className="auth-panel-sub">
                    Check <strong className="text-teal">{email}</strong> for a
                    8-digit code and enter it below.
                  </div>
                  <input
                    ref={codeRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={code}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                      setCode(v)
                      setError('')
                    }}
                    onKeyDown={e => e.key === 'Enter' && verifyCode()}
                    placeholder="12345678"
                    autoComplete="one-time-code"
                    className="tinput mb-8"
                    style={{ letterSpacing: '0.25em', fontSize: 20, textAlign: 'center', fontFamily: '"DM Mono", monospace' }}
                  />
                  {error && <div className="auth-panel-error">{error}</div>}
                  <button
                    onClick={verifyCode}
                    disabled={panelState === 'verifying' || code.length < 8}
                    className="auth-panel-btn auth-panel-btn--primary"
                    style={{ opacity: panelState === 'verifying' || code.length < 8 ? 0.6 : 1 }}
                  >
                    {panelState === 'verifying' ? 'Verifying…' : 'Verify code'}
                  </button>
                  <button onClick={reset} className="auth-panel-btn auth-panel-btn--ghost" style={{ textDecoration: 'underline', border: 'none', background: 'none', fontSize: 11 }}>
                    Use a different email
                  </button>
                </>
              )}
            </>
          ) : (
            // ── Signed-in panel ─────────────────────────────────
            <>
              <div className="auth-user-row">
                <div className="auth-user-avatar">{initials}</div>
                <div className="auth-user-info">
                  <div className="auth-user-email">{user.email}</div>
                  <div className="auth-user-status">
                    {syncing
                      ? <span className="text-amber">syncing…</span>
                      : <span>synced: <span className="text-teal">{lastSyncedLabel}</span></span>
                    }
                  </div>
                </div>
              </div>

              <button
                onClick={() => { onSynced(); setOpen(false) }}
                disabled={syncing}
                className="auth-panel-btn"
                style={{ color: syncing ? 'var(--muted2)' : undefined, cursor: syncing ? 'default' : undefined }}
              >
                {syncing ? 'syncing…' : '↻ Sync now'}
              </button>

              {/* Data backup */}
              <div className="auth-panel-btn-row">
                <button
                  onClick={() => { onExport(); setOpen(false) }}
                  className="auth-panel-btn"
                >
                  ↓ Export
                </button>
                <label className="auth-panel-btn">
                  ↑ Import
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => { onImportFile(e); setOpen(false) }} />
                </label>
              </div>

              <button onClick={signOut} className="auth-panel-btn auth-panel-btn--ghost">
                Sign out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
