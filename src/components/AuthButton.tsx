import { useState, useRef, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isConfigured } from '../lib/supabase'

interface Props {
  user: User | null
  syncing: boolean
  lastSynced: Date | null
  onSynced: () => void   // called by parent after syncAll completes
}

type PanelState = 'idle' | 'sending' | 'sent'

export default function AuthButton({ user, syncing, lastSynced, onSynced }: Props) {
  const [open, setOpen]           = useState(false)
  const [email, setEmail]         = useState('')
  const [panelState, setPanelState] = useState<PanelState>('idle')
  const [error, setError]         = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef   = useRef<HTMLButtonElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!isConfigured) return null  // no env vars — hide completely

  const sendLink = async () => {
    if (!email.trim()) return
    setError('')
    setPanelState('sending')
    const redirectTo = window.location.origin + import.meta.env.BASE_URL
    const { error: err } = await supabase!.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    })
    if (err) { setError(err.message); setPanelState('idle') }
    else setPanelState('sent')
  }

  const signOut = async () => {
    await supabase!.auth.signOut()
    setOpen(false)
  }

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
          transition: 'all .2s', flexShrink: 0,
          position: 'relative',
        }}
      >
        {user ? initials : (
          // Person icon SVG
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        )}
        {/* Sync pulse dot */}
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
            width: 270, background: 'var(--bg2)',
            border: '1px solid var(--border2)', borderRadius: 12,
            padding: 18, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            fontFamily: '"DM Sans", sans-serif',
          }}
        >
          {!user ? (
            // ── Signed-out panel ────────────────────────────────
            panelState === 'sent' ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>📬</div>
                <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>Check your email</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
                  We sent a sign-in link to <strong style={{ color: 'var(--teal-light)' }}>{email}</strong>.
                  Click it to sync your data.
                </div>
                <button
                  onClick={() => { setPanelState('idle'); setEmail('') }}
                  style={linkBtn}
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
                  Sync across devices
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
                  Sign in with a magic link — no password needed.
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendLink()}
                  placeholder="your@email.com"
                  style={{
                    width: '100%', marginBottom: 8,
                    background: 'var(--bg3)', border: '1px solid var(--border2)',
                    borderRadius: 7, padding: '8px 10px',
                    color: 'var(--text)', fontSize: 12,
                    fontFamily: '"DM Sans", sans-serif', outline: 'none',
                  }}
                />
                {error && (
                  <div style={{ fontSize: 11, color: 'var(--coral-light)', marginBottom: 6 }}>{error}</div>
                )}
                <button
                  onClick={sendLink}
                  disabled={panelState === 'sending' || !email.trim()}
                  style={{
                    width: '100%', padding: '8px 0',
                    background: panelState === 'sending' ? 'var(--bg3)' : 'var(--teal)',
                    border: '1px solid var(--teal)', borderRadius: 7,
                    color: panelState === 'sending' ? 'var(--muted)' : '#fff',
                    fontSize: 12, cursor: 'pointer',
                    fontFamily: '"DM Mono", monospace',
                  }}
                >
                  {panelState === 'sending' ? 'Sending…' : 'Send magic link'}
                </button>
              </>
            )
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
                    {syncing ? (
                      <span style={{ color: 'var(--amber-light)' }}>syncing…</span>
                    ) : (
                      <span>synced: <span style={{ color: 'var(--teal-light)' }}>{formatLastSynced()}</span></span>
                    )}
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

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--teal-light)',
  fontSize: 11, cursor: 'pointer', marginTop: 10,
  fontFamily: '"DM Sans", sans-serif', textDecoration: 'underline',
}
