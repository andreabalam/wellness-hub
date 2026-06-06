import { useState } from 'react'
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

// ── Form state ────────────────────────────────────────────────────

const CM_PER_IN = 2.54

type FormFields = {
  weight:     string
  height:     string
  age:        string
  sex:        UserBodyStats['biologicalSex']
  bodyFat:    string
  waist:      string
  glutes:     string
  unit:       UserBodyStats['measurementUnit']
  equipment:  string
  cycleType:  UserBodyStats['cycleType']
  chronotype: UserBodyStats['chronotype']
  lossRate:   string
  split:      MacroSplit
  tdee:       string
  kcalOvr:    string
}

function fieldsFromStore(): FormFields {
  const s = bodyStatsStore.get()
  const autoKcal = s.tdeeKcal ? kcalFromTdee(s.tdeeKcal, s.fatLossRateKg ?? 0) : 0
  const unit = s.measurementUnit ?? 'cm'
  const toDisplay = (cm: number) =>
    cm > 0 ? String(unit === 'in' ? +(cm / CM_PER_IN).toFixed(1) : cm) : ''
  return {
    weight:    s.weightKg   ? String(s.weightKg)  : '',
    height:    s.heightM    ? String(s.heightM)    : '',
    age:       s.age        ? String(s.age)        : '',
    sex:       (s.biologicalSex as UserBodyStats['biologicalSex']) ?? '',
    bodyFat:   s.bodyFatPct ? String(s.bodyFatPct) : '',
    waist:     toDisplay(s.waistCm  ?? 0),
    glutes:    toDisplay(s.glutesCm ?? 0),
    unit,
    equipment: s.equipment  ?? '',
    cycleType: s.cycleType  ?? 'none',
    chronotype: normaliseChronotype(s.chronotype ?? '') as UserBodyStats['chronotype'],
    lossRate:  String(s.fatLossRateKg ?? 0),
    split:     (s.macroSplit as MacroSplit) ?? 'balanced',
    tdee:      s.tdeeKcal   ? String(s.tdeeKcal)  : '',
    // Show override only if stored kcalTarget differs from what auto-compute would give
    kcalOvr:   s.kcalTarget && s.kcalTarget !== autoKcal ? String(s.kcalTarget) : '',
  }
}


// ── Edit form — only mounts when open, so lazy init reads the store once ──

interface EditFormProps {
  user: User | null
  onClose: () => void
  onSaved?: () => void
}

function EditForm({ user, onClose, onSaved }: EditFormProps) {
  // Lazy initializer: called once at mount (which is when the panel opens).
  // No useEffect needed — mounting IS the open event.
  const [f, setF]             = useState<FormFields>(fieldsFromStore)
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving]   = useState(false)

  const set = <K extends keyof FormFields>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF(prev => ({ ...prev, [k]: e.target.value }))

  // Live-computed kcal target
  const tdeeNum     = parseInt(f.tdee)     || 0
  const lossRateNum = parseFloat(f.lossRate) || 0
  const autoKcal    = tdeeNum > 0 ? kcalFromTdee(tdeeNum, lossRateNum) : 0
  const finalKcal   = f.kcalOvr ? (parseInt(f.kcalOvr) || autoKcal) : autoKcal
  const macros      = macrosFromKcal(finalKcal, f.split)

  const fillFromOura = async () => {
    setFetching(true)
    try {
      const [info, tdee] = await Promise.all([
        fetchOuraPersonalInfo(),
        fetchOuraTdeeAvg(7),
      ])
      setF(prev => ({
        ...prev,
        ...(info?.weight != null  && { weight: String(info.weight) }),
        ...(info?.height != null  && { height: String(info.height) }),
        ...(info?.age    != null  && { age:    String(info.age)    }),
        ...(info?.biological_sex  && { sex:    info.biological_sex as UserBodyStats['biologicalSex'] }),
        ...(tdee != null          && { tdee: String(tdee), kcalOvr: '' }),
      }))
    } catch {
      // silent — user can fill manually
    } finally {
      setFetching(false)
    }
  }

  const save = () => {
    setSaving(true)
    const prot = macros?.prot ?? 0
    const toCm = (v: string) => {
      const n = parseFloat(v) || 0
      return f.unit === 'in' ? +(n * CM_PER_IN).toFixed(1) : n
    }
    bodyStatsStore.set({
      weightKg:        parseFloat(f.weight)    || 0,
      heightM:         parseFloat(f.height)    || 0,
      age:             parseInt(f.age)         || 0,
      biologicalSex:   f.sex,
      bodyFatPct:      parseFloat(f.bodyFat)   || 0,
      waistCm:         toCm(f.waist),
      glutesCm:        toCm(f.glutes),
      measurementUnit: f.unit,
      cycleType:       f.cycleType,
      equipment:       f.equipment.trim(),
      chronotype:      f.chronotype,
      fatLossRateKg:   parseFloat(f.lossRate)  || 0,
      macroSplit:      f.split,
      tdeeKcal:        parseInt(f.tdee)        || 0,
      kcalTarget:      finalKcal,
      protRange:       protRangeStr(prot),
      fatLossGoal:     fatLossGoalStr(parseFloat(f.lossRate) || 0),
    })
    setSaving(false)
    onClose()
    onSaved?.()
  }

  return (
    <div className="flex flex-col gap-16">

      {/* Fetch from Oura */}
      {user && (
        <button
          onClick={fillFromOura}
          disabled={fetching}
          className="oura-sync-btn oura-sync-btn--teal"
          style={{ alignSelf: 'flex-start', padding: '5px 12px' }}
        >
          {fetching ? 'Fetching…' : '↺ Fill from Oura'}
        </button>
      )}

      {/* ── Body ─────────────────────────────── */}
      <div>
        <div className="tlabel text-muted2 mb-8">Body</div>
        <div className="profile-grid">
          <label className="profile-form-lbl"><span className="profile-form-lspan">Weight (kg)</span>
            <input className="tnum" type="number" step="0.1" value={f.weight} onChange={set('weight')} placeholder="65" />
          </label>
          <label className="profile-form-lbl"><span className="profile-form-lspan">Height (m)</span>
            <input className="tnum" type="number" step="0.01" value={f.height} onChange={set('height')} placeholder="1.70" />
          </label>
          <label className="profile-form-lbl"><span className="profile-form-lspan">Age</span>
            <input className="tnum" type="number" value={f.age} onChange={set('age')} placeholder="28" />
          </label>
          <label className="profile-form-lbl"><span className="profile-form-lspan">Sex</span>
            <select className="tinput" value={f.sex} onChange={set('sex')}>
              <option value="">Not specified</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="profile-form-lbl"><span className="profile-form-lspan">Body fat %</span>
            <input className="tnum" type="number" step="0.1" value={f.bodyFat} onChange={set('bodyFat')} placeholder="22" />
          </label>
        </div>
      </div>

      {/* ── Measurements ─────────────────────── */}
      <div>
        <div className="flex-between mb-8">
          <div className="tlabel text-muted2">Measurements</div>
          <div className="flex gap-6">
            <button
              type="button"
              onClick={() => setF(prev => {
                if (prev.unit === 'cm') return prev
                return {
                  ...prev,
                  unit:   'cm',
                  waist:  prev.waist  ? String(+(parseFloat(prev.waist)  * CM_PER_IN).toFixed(1)) : '',
                  glutes: prev.glutes ? String(+(parseFloat(prev.glutes) * CM_PER_IN).toFixed(1)) : '',
                }
              })}
              className={`med-style-btn ${f.unit === 'cm' ? 'active' : ''}`}
            >cm</button>
            <button
              type="button"
              onClick={() => setF(prev => {
                if (prev.unit === 'in') return prev
                return {
                  ...prev,
                  unit:   'in',
                  waist:  prev.waist  ? String(+(parseFloat(prev.waist)  / CM_PER_IN).toFixed(1)) : '',
                  glutes: prev.glutes ? String(+(parseFloat(prev.glutes) / CM_PER_IN).toFixed(1)) : '',
                }
              })}
              className={`med-style-btn ${f.unit === 'in' ? 'active' : ''}`}
            >in</button>
          </div>
        </div>
        <div className="profile-grid">
          <label className="profile-form-lbl">
            <span className="profile-form-lspan">Waist ({f.unit})</span>
            <input className="tnum" type="number" step="0.1" value={f.waist}  onChange={set('waist')}  placeholder={f.unit === 'cm' ? '75' : '30'} />
          </label>
          <label className="profile-form-lbl">
            <span className="profile-form-lspan">Glutes ({f.unit})</span>
            <input className="tnum" type="number" step="0.1" value={f.glutes} onChange={set('glutes')} placeholder={f.unit === 'cm' ? '95' : '37'} />
          </label>
        </div>
      </div>

      {/* ── Lifestyle ────────────────────────── */}
      <div>
        <div className="tlabel text-muted2 mb-8">Lifestyle</div>
        <div className="profile-grid">
          <label className="profile-form-lbl"><span className="profile-form-lspan">Chronotype</span>
            <select className="tinput" value={f.chronotype} onChange={set('chronotype')}>
              <option value="">Not set</option>
              <option value="lion">🦁 Lion (early riser)</option>
              <option value="bear">🐻 Bear (follows sun)</option>
              <option value="wolf">🐺 Wolf (night owl)</option>
              <option value="dolphin">🐬 Dolphin (light sleeper)</option>
            </select>
          </label>
          <label className="profile-form-lbl"><span className="profile-form-lspan">Equipment</span>
            <input className="tinput" type="text" value={f.equipment} onChange={set('equipment')} placeholder="Dumbbells, bands…" />
          </label>
          {/* Cycle type — only show when sex is female or unset */}
          {f.sex !== 'male' && (
            <label className="profile-form-lbl"><span className="profile-form-lspan">Cycle type</span>
              <select className="tinput" value={f.cycleType} onChange={set('cycleType')}>
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
        <div className="profile-grid">
          <label className="profile-form-lbl"><span className="profile-form-lspan">Fat loss rate</span>
            <select className="tinput" value={f.lossRate} onChange={e => setF(prev => ({ ...prev, lossRate: e.target.value, kcalOvr: '' }))}>
              <option value="0">Maintenance (0 kg/wk)</option>
              <option value="0.25">Mild − 0.25 kg/wk</option>
              <option value="0.5">Moderate − 0.5 kg/wk</option>
              <option value="0.75">Aggressive − 0.75 kg/wk</option>
              <option value="1">Max − 1 kg/wk</option>
            </select>
          </label>
          <label className="profile-form-lbl"><span className="profile-form-lspan">Macro split</span>
            <select className="tinput" value={f.split} onChange={set('split')}>
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
        <div className="profile-grid--2col">
          <label className="profile-form-lbl">
            <span className="profile-form-lspan">TDEE — 7-day avg from Oura</span>
            <input className="tnum" type="number" value={f.tdee} onChange={e => setF(prev => ({ ...prev, tdee: e.target.value, kcalOvr: '' }))} placeholder="2 100" />
          </label>
          <label className="profile-form-lbl">
            <span className="profile-form-lspan">
              {autoKcal > 0 ? `Kcal target (auto: ${autoKcal.toLocaleString()})` : 'Kcal target override'}
            </span>
            <input
              className="tnum"
              type="number"
              value={f.kcalOvr}
              onChange={set('kcalOvr')}
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
          style={{ background: 'var(--teal)', color: '#fff' }}
        >
          Save
        </button>
        <button
          onClick={onClose}
          className="tbtn"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--muted)' }} // slight variant of tbtn ghost
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main card ─────────────────────────────────────────────────────

export default function ProfileStatsCard({ user, defaultOpen = false, onSaved }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const s = bodyStatsStore.get()
  const hasData = s.weightKg > 0 || s.kcalTarget > 0

  const fatMass  = s.weightKg > 0 && s.bodyFatPct > 0 ? +(s.weightKg * s.bodyFatPct / 100).toFixed(1) : null
  const leanMass = fatMass !== null ? +(s.weightKg - fatMass).toFixed(1) : null
  const unit = s.measurementUnit ?? 'cm'
  const displayMeasure = (cm: number) =>
    unit === 'in' ? `${+(cm / CM_PER_IN).toFixed(1)} in` : `${cm} cm`
  const STATS = hasData ? ([
    s.weightKg > 0   && { l: 'Weight',         v: `${s.weightKg} kg`,                       c: 'var(--text)' },
    s.bodyFatPct > 0 && { l: 'Body fat',        v: `${s.bodyFatPct}%`,                       c: 'var(--coral-light)' },
    fatMass !== null && { l: 'Fat mass',         v: `~${fatMass} kg`,                         c: 'var(--coral)' },
    leanMass !== null&& { l: 'Lean mass',        v: `~${leanMass} kg`,                        c: 'var(--green-light)' },
    s.heightM > 0    && { l: 'Height',           v: `${s.heightM} m`,                         c: 'var(--text)' },
    (s.waistCm  ?? 0) > 0 && { l: 'Waist',      v: displayMeasure(s.waistCm!),               c: 'var(--amber)' },
    (s.glutesCm ?? 0) > 0 && { l: 'Glutes',     v: displayMeasure(s.glutesCm!),              c: 'var(--teal)' },
    s.tdeeKcal > 0   && { l: 'TDEE',             v: `~${s.tdeeKcal.toLocaleString()} kcal`,   c: 'var(--amber-light)' },
    s.kcalTarget > 0 && { l: 'Daily target',     v: `~${s.kcalTarget.toLocaleString()} kcal`, c: 'var(--green)' },
    !!s.protRange    && { l: 'Protein target',   v: s.protRange,                              c: 'var(--blue-light)' },
    !!s.fatLossGoal  && { l: 'Fat loss goal',    v: s.fatLossGoal,                            c: 'var(--green-light)' },
  ] as const).filter((x): x is { l: string; v: string; c: string } => !!x) : []

  return (
    <div className="tcard mt-20 mb-20">
      <div className="flex-between" style={{ marginBottom: open ? 16 : hasData ? 12 : 0 }}>
        <div className="tlabel text-muted2" style={{ marginBottom: 0 }}>Profile &amp; Targets</div>
        <button onClick={() => setOpen(v => !v)} className={`open-toggle-btn ${open ? 'text-muted2' : 'text-teal'}`}>
          {open ? '✕ Close' : hasData ? '✎ Edit' : '+ Set up'}
        </button>
      </div>

      {/* Collapsed grid */}
      {!open && hasData && (
        <div className="stats-grid">
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

      {/* EditForm only mounts when open — lazy init reads the store exactly once */}
      {open && (
        <EditForm
          user={user}
          onClose={() => setOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
