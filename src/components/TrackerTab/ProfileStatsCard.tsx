import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { bodyStatsStore } from '../../hooks/useStore'
import { fetchOuraPersonalInfo, fetchOuraTdeeAvg } from '../../lib/oura'
import {
  kcalFromTdee, macrosFromKcal, protRangeStr, fatLossGoalStr, normaliseChronotype,
  type MacroSplit,
} from '../../lib/stats'
import type { UserBodyStats } from '../../lib/sync'

interface Props {
  user: User | null
  /** If true, card starts expanded (e.g. opened from the "Edit" button above). */
  defaultOpen?: boolean
  onSaved?: () => void
}

const grid2: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10,
}

export default function ProfileStatsCard({ user, defaultOpen = false, onSaved }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit state — initialised from store when form opens
  const [editWeight,    setEditWeight]    = useState('')
  const [editHeight,    setEditHeight]    = useState('')
  const [editAge,       setEditAge]       = useState('')
  const [editSex,       setEditSex]       = useState<UserBodyStats['biologicalSex']>('')
  const [editBodyFat,   setEditBodyFat]   = useState('')
  const [editEquipment, setEditEquipment] = useState('')
  const [editCycleType, setEditCycleType] = useState<UserBodyStats['cycleType']>('none')
  const [editChronotype,setEditChronotype]= useState<UserBodyStats['chronotype']>('')
  const [editLossRate,  setEditLossRate]  = useState('0')
  const [editSplit,     setEditSplit]     = useState<MacroSplit>('balanced')
  const [editTdee,      setEditTdee]      = useState('')
  const [editKcalOvr,   setEditKcalOvr]  = useState('')  // empty = auto-compute

  // Load store values into edit state whenever the panel opens
  useEffect(() => {
    if (!open) return
    const s = bodyStatsStore.get()
    setEditWeight(   s.weightKg      ? String(s.weightKg)    : '')
    setEditHeight(   s.heightM       ? String(s.heightM)     : '')
    setEditAge(      s.age           ? String(s.age)         : '')
    setEditSex(      (s.biologicalSex as UserBodyStats['biologicalSex']) ?? '')
    setEditBodyFat(  s.bodyFatPct    ? String(s.bodyFatPct)  : '')
    setEditEquipment(s.equipment     ?? '')
    setEditCycleType(s.cycleType     ?? 'none')
    setEditChronotype(normaliseChronotype(s.chronotype ?? '') as UserBodyStats['chronotype'])
    setEditLossRate( String(s.fatLossRateKg ?? 0))
    setEditSplit(    (s.macroSplit as MacroSplit) ?? 'balanced')
    setEditTdee(     s.tdeeKcal      ? String(s.tdeeKcal)    : '')

    // Show override only if stored kcalTarget differs from what auto-compute would give
    const autoKcal = s.tdeeKcal ? kcalFromTdee(s.tdeeKcal, s.fatLossRateKg ?? 0) : 0
    setEditKcalOvr(s.kcalTarget && s.kcalTarget !== autoKcal ? String(s.kcalTarget) : '')
  }, [open])

  // Live-computed kcal target
  const tdeeNum     = parseInt(editTdee)     || 0
  const lossRateNum = parseFloat(editLossRate) || 0
  const autoKcal    = tdeeNum > 0 ? kcalFromTdee(tdeeNum, lossRateNum) : 0
  const finalKcal   = editKcalOvr ? (parseInt(editKcalOvr) || autoKcal) : autoKcal
  const macros      = macrosFromKcal(finalKcal, editSplit)

  // ── Fetch from Oura ────────────────────────────────────────────────
  const fillFromOura = async () => {
    setFetching(true)
    try {
      const [info, tdee] = await Promise.all([
        fetchOuraPersonalInfo(),
        fetchOuraTdeeAvg(7),
      ])
      if (info) {
        if (info.weight != null) setEditWeight(String(info.weight))
        if (info.height != null) setEditHeight(String(info.height))
        if (info.age    != null) setEditAge(String(info.age))
        if (info.biological_sex) setEditSex(info.biological_sex as UserBodyStats['biologicalSex'])
      }
      if (tdee != null) {
        setEditTdee(String(tdee))
        setEditKcalOvr('')  // clear override so auto-compute re-runs
      }
    } catch {
      // silent — user can fill manually
    } finally {
      setFetching(false)
    }
  }

  // ── Save ────────────────────────────────────────────────────────────
  const save = () => {
    setSaving(true)
    const prot = macros?.prot ?? 0
    bodyStatsStore.set({
      weightKg:      parseFloat(editWeight)    || 0,
      heightM:       parseFloat(editHeight)    || 0,
      age:           parseInt(editAge)         || 0,
      biologicalSex: editSex,
      bodyFatPct:    parseFloat(editBodyFat)   || 0,
      cycleType:     editCycleType,
      equipment:     editEquipment.trim(),
      chronotype:    editChronotype,
      fatLossRateKg: parseFloat(editLossRate)  || 0,
      macroSplit:    editSplit,
      tdeeKcal:      parseInt(editTdee)        || 0,
      kcalTarget:    finalKcal,
      protRange:     protRangeStr(prot),
      fatLossGoal:   fatLossGoalStr(parseFloat(editLossRate) || 0),
    })
    setSaving(false)
    setOpen(false)
    onSaved?.()
  }

  // ── Collapsed grid data ─────────────────────────────────────────────
  const s = bodyStatsStore.get()
  const hasData = s.weightKg > 0 || s.kcalTarget > 0

  const fatMass  = s.weightKg > 0 && s.bodyFatPct > 0 ? +(s.weightKg * s.bodyFatPct / 100).toFixed(1) : null
  const leanMass = fatMass !== null ? +(s.weightKg - fatMass).toFixed(1) : null
  const STATS = hasData ? ([
    s.weightKg > 0   && { l: 'Weight',         v: `${s.weightKg} kg`,                       c: 'var(--text)' },
    s.bodyFatPct > 0 && { l: 'Body fat',        v: `${s.bodyFatPct}%`,                       c: 'var(--coral-light)' },
    fatMass !== null && { l: 'Fat mass',         v: `~${fatMass} kg`,                         c: 'var(--coral)' },
    leanMass !== null&& { l: 'Lean mass',        v: `~${leanMass} kg`,                        c: 'var(--green-light)' },
    s.heightM > 0    && { l: 'Height',           v: `${s.heightM} m`,                         c: 'var(--text)' },
    s.tdeeKcal > 0   && { l: 'TDEE',             v: `~${s.tdeeKcal.toLocaleString()} kcal`,   c: 'var(--amber-light)' },
    s.kcalTarget > 0 && { l: 'Daily target',     v: `~${s.kcalTarget.toLocaleString()} kcal`, c: 'var(--green)' },
    !!s.protRange    && { l: 'Protein target',   v: s.protRange,                              c: 'var(--blue-light)' },
    !!s.fatLossGoal  && { l: 'Fat loss goal',    v: s.fatLossGoal,                            c: 'var(--green-light)' },
  ] as const).filter((x): x is { l: string; v: string; c: string } => !!x) : []

  return (
    <div className="tcard mt-20 mb-20">
      <div className="flex-between" style={{ marginBottom: open ? 16 : hasData ? 12 : 0 }}>
        <div className="tlabel text-muted2" style={{ marginBottom: 0 }}>Profile &amp; Targets</div>
        <button
          onClick={() => setOpen(v => !v)}
          style={{ fontSize: 11, background: 'none', border: 'none', color: open ? 'var(--muted2)' : 'var(--teal-light)', cursor: 'pointer', fontFamily: 'sans-serif', padding: 0 }}
        >
          {open ? '✕ Close' : hasData ? '✎ Edit' : '+ Set up'}
        </button>
      </div>

      {/* Collapsed grid */}
      {!open && hasData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
          {STATS.map(stat => (
            <div key={stat.l} className="stat-tile">
              <div className="stat-tile__label">{stat.l}</div>
              <div className="stat-tile__value" style={{ color: stat.c }}>{stat.v}</div>
            </div>
          ))}
        </div>
      )}
      {!open && !hasData && (
        <div className="text-sm text-muted2 italic">
          Set up your profile to personalise calorie targets and your workout plan.
        </div>
      )}

      {/* Expanded edit form */}
      {open && (
        <div className="flex flex-col gap-16">

          {/* Fetch from Oura */}
          {user && (
            <button
              onClick={fillFromOura}
              disabled={fetching}
              className="oura-sync-btn oura-sync-btn--teal"
              style={{
                alignSelf: 'flex-start', padding: '5px 12px',
                opacity: fetching ? 0.6 : 1,
                cursor: fetching ? 'default' : 'pointer',
              }}
            >
              {fetching ? 'Fetching…' : '↺ Fill from Oura'}
            </button>
          )}

          {/* ── Body ─────────────────────────────── */}
          <div>
            <div className="tlabel text-muted2 mb-8">Body</div>
            <div style={grid2}>
              <label className="profile-form-lbl"><span className="profile-form-lspan">Weight (kg)</span>
                <input className="tnum" type="number" step="0.1" value={editWeight} onChange={e => setEditWeight(e.target.value)} placeholder="65" />
              </label>
              <label className="profile-form-lbl"><span className="profile-form-lspan">Height (m)</span>
                <input className="tnum" type="number" step="0.01" value={editHeight} onChange={e => setEditHeight(e.target.value)} placeholder="1.70" />
              </label>
              <label className="profile-form-lbl"><span className="profile-form-lspan">Age</span>
                <input className="tnum" type="number" value={editAge} onChange={e => setEditAge(e.target.value)} placeholder="28" />
              </label>
              <label className="profile-form-lbl"><span className="profile-form-lspan">Sex</span>
                <select className="tinput" value={editSex} onChange={e => setEditSex(e.target.value as UserBodyStats['biologicalSex'])}>
                  <option value="">Not specified</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="profile-form-lbl"><span className="profile-form-lspan">Body fat %</span>
                <input className="tnum" type="number" step="0.1" value={editBodyFat} onChange={e => setEditBodyFat(e.target.value)} placeholder="22" />
              </label>
            </div>
          </div>

          {/* ── Lifestyle ────────────────────────── */}
          <div>
            <div className="tlabel text-muted2 mb-8">Lifestyle</div>
            <div style={grid2}>
              <label className="profile-form-lbl"><span className="profile-form-lspan">Chronotype</span>
                <select className="tinput" value={editChronotype} onChange={e => setEditChronotype(e.target.value as UserBodyStats['chronotype'])}>
                  <option value="">Not set</option>
                  <option value="lion">🦁 Lion (early riser)</option>
                  <option value="bear">🐻 Bear (follows sun)</option>
                  <option value="wolf">🐺 Wolf (night owl)</option>
                  <option value="dolphin">🐬 Dolphin (light sleeper)</option>
                </select>
              </label>
              <label className="profile-form-lbl"><span className="profile-form-lspan">Equipment</span>
                <input className="tinput" type="text" value={editEquipment} onChange={e => setEditEquipment(e.target.value)} placeholder="Dumbbells, bands…" />
              </label>
              {/* Cycle type — only show when sex is female or unset */}
              {editSex !== 'male' && (
                <label className="profile-form-lbl"><span className="profile-form-lspan">Cycle type</span>
                  <select className="tinput" value={editCycleType} onChange={e => setEditCycleType(e.target.value as UserBodyStats['cycleType'])}>
                    <option value="none">None / N/A</option>
                    <option value="regular">Regular</option>
                    <option value="irregular">Irregular</option>
                  </select>
                </label>
              )}
            </div>
          </div>

          {/* ── Goals ────────────────────────────── */}
          <div>
            <div className="tlabel text-muted2 mb-8">Goals</div>
            <div style={grid2}>
              <label className="profile-form-lbl"><span className="profile-form-lspan">Fat loss rate</span>
                <select className="tinput" value={editLossRate} onChange={e => { setEditLossRate(e.target.value); setEditKcalOvr('') }}>
                  <option value="0">Maintenance (0 kg/wk)</option>
                  <option value="0.25">Mild − 0.25 kg/wk</option>
                  <option value="0.5">Moderate − 0.5 kg/wk</option>
                  <option value="0.75">Aggressive − 0.75 kg/wk</option>
                  <option value="1">Max − 1 kg/wk</option>
                </select>
              </label>
              <label className="profile-form-lbl"><span className="profile-form-lspan">Macro split</span>
                <select className="tinput" value={editSplit} onChange={e => setEditSplit(e.target.value as MacroSplit)}>
                  <option value="balanced">Balanced (30P / 40C / 30F)</option>
                  <option value="high_protein">High protein (35P / 35C / 30F)</option>
                  <option value="low_carb">Low carb (35P / 20C / 45F)</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
            </div>
          </div>

          {/* ── Computed targets ─────────────────── */}
          <div className="computed-targets">
            <div className="tlabel text-muted2 mb-10">Computed targets</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <label className="profile-form-lbl">
                <span className="profile-form-lspan">TDEE — 7-day avg from Oura</span>
                <input className="tnum" type="number" value={editTdee} onChange={e => { setEditTdee(e.target.value); setEditKcalOvr('') }} placeholder="2 100" />
              </label>
              <label className="profile-form-lbl">
                <span className="profile-form-lspan">
                  {autoKcal > 0 ? `Kcal target (auto: ${autoKcal.toLocaleString()})` : 'Kcal target override'}
                </span>
                <input
                  className="tnum"
                  type="number"
                  value={editKcalOvr}
                  onChange={e => setEditKcalOvr(e.target.value)}
                  placeholder={autoKcal > 0 ? String(autoKcal) : 'Enter TDEE first'}
                />
              </label>
            </div>
            {finalKcal > 0 && (
              <div className="flex flex-wrap gap-14 text-base">
                <span className="text-green font-600">{finalKcal.toLocaleString()} kcal</span>
                {macros ? (
                  <>
                    <span className="text-blue">P {macros.prot}g</span>
                    <span className="text-amber">C {macros.carb}g</span>
                    <span className="text-coral">F {macros.fat}g</span>
                    <span className="text-teal">Fi {macros.fiber}g</span>
                  </>
                ) : (
                  <span className="text-xs text-muted italic">
                    Set individual macro targets in the Daily Targets panel above.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-8">
            <button
              onClick={save}
              disabled={saving}
              className="tbtn"
              style={{ background: 'var(--teal)', color: '#fff', opacity: saving ? 0.6 : 1 }}
            >
              Save
            </button>
            <button
              onClick={() => setOpen(false)}
              className="tbtn"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
