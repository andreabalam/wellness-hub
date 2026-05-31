import { useState, useEffect, useCallback } from 'react'
import type { Recipe } from '../../data/recipes'

interface Props {
  recipe: Recipe
  onClose: () => void
}

export default function CookingMode({ recipe: r, onClose }: Props) {
  const [checkedIngs, setCheckedIngs] = useState<Set<number>>(new Set())
  const [currentStep, setCurrentStep] = useState(0)
  const [stepMode, setStepMode]       = useState(false)
  const [ingsOpen, setIngsOpen]       = useState(true)

  // ── Keep-awake ────────────────────────────────────────────────
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    ;(navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } })
      .wakeLock.request('screen')
      .then(l => { lock = l })
      .catch(() => { /* not supported or denied — silent fail */ })
    return () => { lock?.release().catch(() => {}) }
  }, [])

  // ── Keyboard navigation in step mode ─────────────────────────
  useEffect(() => {
    if (!stepMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown')
        setCurrentStep(s => Math.min(s + 1, r.steps.length - 1))
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
        setCurrentStep(s => Math.max(s - 1, 0))
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stepMode, r.steps.length, onClose])

  const toggleIng = useCallback((i: number) => {
    setCheckedIngs(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }, [])

  const stepCount = r.steps.length

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'var(--bg)', overflowY: 'auto',
      }}
    >
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1,
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: 'var(--muted)',
            fontSize: 13, cursor: 'pointer', fontFamily: 'sans-serif',
            display: 'flex', alignItems: 'center', gap: 5, padding: 0,
          }}
        >
          ✕ Exit cooking mode
        </button>
        <span style={{
          fontFamily: '"DM Serif Display", serif', fontSize: 18,
          color: 'var(--text)', textAlign: 'right', flex: 1,
        }}>
          {r.name}
        </span>
      </div>

      <div style={{ padding: '20px 20px 80px' }}>

        {/* ── Ingredients ──────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: ingsOpen ? 10 : 0,
          }}>
            <div className="tlabel" style={{ color: 'var(--muted2)', margin: 0 }}>
              INGREDIENTS ({r.ings.length})
            </div>
            <button
              onClick={() => setIngsOpen(o => !o)}
              style={{
                background: 'none', border: 'none', color: 'var(--muted)',
                fontSize: 12, cursor: 'pointer', fontFamily: 'sans-serif',
              }}
            >
              {ingsOpen ? '↑ Hide' : '↓ Show'}
            </button>
          </div>

          {ingsOpen && r.ings.map(([ing, amt], i) => (
            <div
              key={i}
              onClick={() => toggleIng(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0', borderBottom: '1px solid var(--border)',
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              {/* circle indicator */}
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${checkedIngs.has(i) ? 'var(--teal)' : 'var(--border2)'}`,
                background: checkedIngs.has(i) ? 'var(--teal)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: '#fff', transition: 'all .15s',
              }}>
                {checkedIngs.has(i) ? '✓' : ''}
              </div>
              <span style={{
                flex: 1, fontSize: 15,
                color: checkedIngs.has(i) ? 'var(--muted2)' : 'var(--text)',
                textDecoration: checkedIngs.has(i) ? 'line-through' : 'none',
              }}>
                {ing}
              </span>
              <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: '"DM Mono", monospace' }}>
                {amt}
              </span>
            </div>
          ))}
        </div>

        {/* ── Steps ────────────────────────────────────────────── */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <div className="tlabel" style={{ color: 'var(--muted2)', margin: 0 }}>
              STEPS ({stepCount})
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setStepMode(false)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11,
                  border: `1px solid ${!stepMode ? 'var(--teal)' : 'var(--border)'}`,
                  background: !stepMode ? 'rgba(58,125,90,0.15)' : 'var(--bg3)',
                  color: !stepMode ? 'var(--teal-light)' : 'var(--muted)',
                  cursor: 'pointer', fontFamily: 'sans-serif',
                }}
              >
                ≡ All steps
              </button>
              <button
                onClick={() => { setStepMode(true); setCurrentStep(0) }}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11,
                  border: `1px solid ${stepMode ? 'var(--teal)' : 'var(--border)'}`,
                  background: stepMode ? 'rgba(58,125,90,0.15)' : 'var(--bg3)',
                  color: stepMode ? 'var(--teal-light)' : 'var(--muted)',
                  cursor: 'pointer', fontFamily: 'sans-serif',
                }}
              >
                → Step by step
              </button>
            </div>
          </div>

          {/* Scroll-all mode */}
          {!stepMode && r.steps.map((step, i) => (
            <div
              key={i}
              onClick={() => setCurrentStep(i)}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '12px 14px', marginBottom: 6, borderRadius: 8,
                background: currentStep === i ? 'rgba(58,125,90,0.10)' : 'transparent',
                borderLeft: `3px solid ${currentStep === i ? 'var(--teal)' : 'transparent'}`,
                cursor: 'pointer', transition: 'all .2s',
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: currentStep === i ? 'var(--teal)' : 'var(--bg3)',
                border: `1px solid ${currentStep === i ? 'var(--teal)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontFamily: '"DM Mono", monospace',
                color: currentStep === i ? '#fff' : 'var(--muted)',
                transition: 'all .2s',
              }}>
                {i + 1}
              </div>
              <p style={{
                margin: 0, fontSize: 15, lineHeight: 1.7,
                color: currentStep === i ? 'var(--text)' : 'var(--muted)',
              }}>
                {step}
              </p>
            </div>
          ))}

          {/* Step-by-step mode */}
          {stepMode && (
            <div style={{ padding: '24px 0' }}>
              <p style={{
                fontSize: 20, lineHeight: 1.7, color: 'var(--text)',
                margin: '0 0 32px',
              }}>
                {r.steps[currentStep]}
              </p>
            </div>
          )}
        </div>

        {/* ── Tip ──────────────────────────────────────────────── */}
        {r.tip && (
          <div style={{
            padding: '12px 16px', borderRadius: 8,
            borderLeft: '3px solid var(--amber)',
            background: 'rgba(201,145,58,0.08)',
            marginTop: 8,
          }}>
            <div style={{ fontSize: 11, color: 'var(--amber-light)', fontFamily: '"DM Mono",monospace', marginBottom: 4 }}>
              TIP
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>{r.tip}</p>
          </div>
        )}
      </div>

      {/* ── Step navigator (always visible at bottom) ─────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg2)', borderTop: '1px solid var(--border)',
        padding: '12px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
      }}>
        <button
          onClick={() => setCurrentStep(s => Math.max(s - 1, 0))}
          disabled={currentStep === 0}
          style={{
            background: currentStep === 0 ? 'var(--bg3)' : 'var(--teal)',
            border: 'none', borderRadius: 8, padding: '8px 18px',
            fontSize: 13, color: currentStep === 0 ? 'var(--muted)' : '#fff',
            cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'sans-serif', transition: 'all .15s',
          }}
        >
          ◀ Prev
        </button>

        <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: '"DM Mono",monospace' }}>
          Step {currentStep + 1} of {stepCount}
        </span>

        <button
          onClick={() => setCurrentStep(s => Math.min(s + 1, stepCount - 1))}
          disabled={currentStep === stepCount - 1}
          style={{
            background: currentStep === stepCount - 1 ? 'var(--bg3)' : 'var(--teal)',
            border: 'none', borderRadius: 8, padding: '8px 18px',
            fontSize: 13, color: currentStep === stepCount - 1 ? 'var(--muted)' : '#fff',
            cursor: currentStep === stepCount - 1 ? 'not-allowed' : 'pointer',
            fontFamily: 'sans-serif', transition: 'all .15s',
          }}
        >
          Next ▶
        </button>
      </div>
    </div>
  )
}
