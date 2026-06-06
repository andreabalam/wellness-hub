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
    <div className="cooking-overlay">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="cooking-topbar">
        <button onClick={onClose} className="cooking-topbar__back">
          ✕ Exit cooking mode
        </button>
        <span className="cooking-topbar__title">{r.name}</span>
      </div>

      <div className="cooking-body">

        {/* ── Ingredients ──────────────────────────────────────── */}
        <div className="mb-24">
          <div className={`flex-between ${ingsOpen ? 'mb-10' : ''}`}>
            <div className="tlabel text-muted2" style={{ margin: 0 }}>
              INGREDIENTS ({r.ings.length})
            </div>
            <button onClick={() => setIngsOpen(o => !o)} className="hide-toggle-btn">
              {ingsOpen ? '↑ Hide' : '↓ Show'}
            </button>
          </div>

          {ingsOpen && r.ings.map(([ing, amt], i) => (
            <div
              key={i}
              onClick={() => toggleIng(i)}
              className="cooking-ing-row"
            >
              {/* circle indicator */}
              <div className={`cooking-ing-check ${checkedIngs.has(i) ? 'checked' : ''}`}>
                {checkedIngs.has(i) ? '✓' : ''}
              </div>
              <span className={`cooking-ing-text ${checkedIngs.has(i) ? 'checked' : ''}`}>
                {ing}
              </span>
              <span className="cooking-ing-amt">{amt}</span>
            </div>
          ))}
        </div>

        {/* ── Steps ────────────────────────────────────────────── */}
        <div>
          <div className="flex-between mb-14">
            <div className="tlabel text-muted2" style={{ margin: 0 }}>
              STEPS ({stepCount})
            </div>
            <div className="flex gap-6">
              <button
                onClick={() => setStepMode(false)}
                className={`step-mode-btn ${!stepMode ? 'active' : ''}`}
              >
                ≡ All steps
              </button>
              <button
                onClick={() => { setStepMode(true); setCurrentStep(0) }}
                className={`step-mode-btn ${stepMode ? 'active' : ''}`}
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
              className={`cooking-step-row ${currentStep === i ? 'active' : ''}`}
            >
              <div className={`cooking-step-num ${currentStep === i ? 'active' : ''}`}>
                {i + 1}
              </div>
              <p className={`cooking-step-text ${currentStep === i ? 'active' : ''}`}>
                {step}
              </p>
            </div>
          ))}

          {/* Step-by-step mode */}
          {stepMode && (
            <div className="step-solo">
              <p className="step-solo__text">{r.steps[currentStep]}</p>
            </div>
          )}
        </div>

        {/* ── Tip ──────────────────────────────────────────────── */}
        {r.tip && (
          <div className="cooking-tip">
            <div className="cooking-tip__label">TIP</div>
            <p className="cooking-tip__text">{r.tip}</p>
          </div>
        )}
      </div>

      {/* ── Step navigator (always visible at bottom) ─────────── */}
      <div className="cooking-footer">
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

        <span className="cooking-step-counter">
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
