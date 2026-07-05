import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import {
  fetchOuraDailyActivity,
  fetchOuraReadiness,
  fetchOuraSleep,
  fetchOuraSleepSession,
  fetchOuraWorkouts,
  fetchOuraSessions,
  fetchOuraCardiovascularAge,
  fetchOuraSpo2,
  fetchOuraStress,
  fetchOuraResilience,
  fetchOuraWorkoutRoute,
  startOuraOAuth,
  exchangePendingCode,
  disconnectOura,
  readinessColor,
  readinessLabel,
  type OuraDailyActivity,
  type OuraReadiness,
  type OuraSleep,
  type OuraSleepSession,
  type OuraWorkout,
  type OuraSession,
  type OuraCardiovascularAge,
  type OuraSpo2,
  type OuraStress,
  type OuraResilience,
} from '../../lib/oura'

// ── Date helpers ──────────────────────────────────────────────────

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayStr() {
  return localDateStr(new Date())
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return localDateStr(d)
}

function fmtDate(dateStr: string): string {
  const today = todayStr()
  if (dateStr === today) return 'Today'
  if (dateStr === addDays(today, -1)) return 'Yesterday'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function fmtTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Color helpers ─────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 85) return 'var(--green-light)'
  if (score >= 70) return 'var(--teal-light)'
  if (score >= 50) return 'var(--amber-light)'
  return 'var(--coral-light)'
}

function spo2Color(avg: number): string {
  if (avg >= 95) return 'var(--green-light)'
  if (avg >= 91) return 'var(--amber-light)'
  return 'var(--coral-light)'
}

function stressColor(summary: string | null): string {
  if (!summary || summary === 'no_data') return 'var(--muted)'
  if (summary === 'restored') return 'var(--green-light)'
  if (summary === 'normal') return 'var(--teal-light)'
  return 'var(--coral-light)'
}

function resilienceColor(level: string | null): string {
  if (!level) return 'var(--muted)'
  if (level === 'exceptional' || level === 'strong') return 'var(--green-light)'
  if (level === 'adequate') return 'var(--teal-light)'
  if (level === 'limited') return 'var(--amber-light)'
  return 'var(--coral-light)'
}

function fmtActivity(act: string): string {
  return act.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const SESSION_ICON: Record<string, string> = {
  meditation: '🧘',
  breathing: '🫁',
  body_status: '🧠',
  nap: '😴',
}

const SESSION_LABEL: Record<string, string> = {
  meditation: 'Meditation',
  breathing: 'Breathing',
  body_status: 'Body Scan',
  nap: 'Nap',
}

function moodColor(mood: string | null): string {
  if (!mood) return 'var(--muted)'
  if (['good', 'great', 'relieved'].includes(mood)) return 'var(--green-light)'
  if (['bad', 'terrible'].includes(mood)) return 'var(--coral-light)'
  return 'var(--teal-light)'
}

// ── Sub-components ────────────────────────────────────────────────

function CardHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="oura-card-header">
      <span>{icon}</span>
      <span>{title}</span>
    </div>
  )
}

function BigStat({ value, color, unit }: { value: string | number; color: string; unit?: string }) {
  return (
    <div className="flex items-baseline gap-4 mb-8">
      <span className="metric-val" style={{ color }}>
        {value}
      </span>
      {unit && <span className="text-sm text-muted">{unit}</span>}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="oura-metric-row">
      <span className="text-muted text-sm">{label}</span>
      <span className="oura-metric-row__val">{value}</span>
    </div>
  )
}

function Chip({ value, teal }: { value: string; teal?: boolean }) {
  return (
    <span className={`oura-badge font-mono ${teal ? 'oura-badge--teal' : 'oura-badge--default'}`}>
      {value}
    </span>
  )
}

function Skeleton() {
  return <div className="text-base text-muted">Loading…</div>
}

function Empty() {
  return <div className="text-base text-muted2 italic">No data</div>
}

function SessionRow({ session: s }: { session: OuraSession }) {
  const durationSecs = Math.round(
    (new Date(s.end_datetime).getTime() - new Date(s.start_datetime).getTime()) / 1000,
  )
  return (
    <div className="oura-session-row flex flex-wrap items-center gap-10">
      <span className="flex-shrink-0 text-xl" style={{ lineHeight: 1 }}>
        {SESSION_ICON[s.type] ?? '🧘'}
      </span>
      <div className="flex-1 min-w-0" style={{ minWidth: 100 }}>
        <div className="text-base text-default font-500">
          {SESSION_LABEL[s.type] ?? fmtActivity(s.type)}
        </div>
        <div className="text-xs text-muted mt-4">{fmtTime(s.start_datetime)}</div>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <Chip value={fmtDuration(durationSecs)} />
        {s.average_hrv != null && <Chip value={`HRV ${s.average_hrv}`} />}
        {s.average_heart_rate != null && <Chip value={`${s.average_heart_rate} bpm`} />}
        {s.mood && (
          <span className="font-mono uppercase text-xs" style={{ color: moodColor(s.mood) }}>
            ♥ {s.mood}
          </span>
        )}
      </div>
    </div>
  )
}

function WorkoutRow({ workout, hasRoute }: { workout: OuraWorkout; hasRoute: boolean }) {
  const durationSecs = Math.round(
    (new Date(workout.end_datetime).getTime() - new Date(workout.start_datetime).getTime()) / 1000,
  )
  return (
    <div className="oura-workout-row flex flex-wrap items-start gap-10">
      <div className="flex-1 min-w-0" style={{ minWidth: 130 }}>
        <div className="text-base text-default font-500">{fmtActivity(workout.activity)}</div>
        <div className="text-xs text-muted mt-4">
          {fmtTime(workout.start_datetime)} – {fmtTime(workout.end_datetime)}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <Chip value={fmtDuration(durationSecs)} />
        {workout.calories > 0 && <Chip value={`${workout.calories} kcal`} />}
        {workout.distance != null && workout.distance > 0 && (
          <Chip value={`${(workout.distance / 1000).toFixed(2)} km`} />
        )}
        {workout.average_heart_rate != null && (
          <Chip value={`${workout.average_heart_rate} bpm avg`} />
        )}
        {workout.max_heart_rate != null && <Chip value={`${workout.max_heart_rate} bpm max`} />}
        {hasRoute && <Chip value="🗺 Route" teal />}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

interface Props {
  user: User | null
}

export default function OuraTab({ user }: Props) {
  const [date, setDate] = useState(todayStr)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noToken, setNoToken] = useState(false)

  // ── Connection management ─────────────────────────────────────────
  const [connecting, setConnecting] = useState(false)
  const [connError, setConnError] = useState<string | null>(null)

  // On mount: if App.tsx detected an OAuth callback, there will be a pending
  // code in sessionStorage. Exchange it for tokens now, then reload data.
  useEffect(() => {
    const pending = sessionStorage.getItem('oura_oauth_pending_code')
    if (!pending || !user) return
    const ctrl = { cancelled: false }
    // Defer setState out of the synchronous effect body so React doesn't cascade renders
    Promise.resolve().then(() => {
      if (ctrl.cancelled) return
      setConnecting(true)
      setConnError(null)
      setNoToken(true)
      exchangePendingCode()
        .then(() => {
          if (!ctrl.cancelled) {
            setNoToken(false)
            fetchAll(date)
          }
        })
        .catch(err => {
          if (!ctrl.cancelled)
            setConnError(err instanceof Error ? err.message : 'Connection failed')
        })
        .finally(() => {
          if (!ctrl.cancelled) setConnecting(false)
        })
    })
    return () => {
      ctrl.cancelled = true
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  async function disconnect() {
    await disconnectOura()
    setNoToken(true)
    setError(null)
    setActivity(null)
    setReadiness(null)
    setSleep(null)
    setSleepSession(null)
    setWorkouts([])
    setWorkoutErr(null)
    setSessions([])
    setCardioAge(null)
    setSpo2(null)
    setStress(null)
    setResilience(null)
    setRouteIds(new Set())
  }

  const [activity, setActivity] = useState<OuraDailyActivity | null>(null)
  const [readiness, setReadiness] = useState<OuraReadiness | null>(null)
  const [sleep, setSleep] = useState<OuraSleep | null>(null)
  const [sleepSession, setSleepSession] = useState<OuraSleepSession | null>(null)
  const [workouts, setWorkouts] = useState<OuraWorkout[]>([])
  const [workoutErr, setWorkoutErr] = useState<string | null>(null)
  const [sessions, setSessions] = useState<OuraSession[]>([])
  const [cardioAge, setCardioAge] = useState<OuraCardiovascularAge | null>(null)
  const [spo2, setSpo2] = useState<OuraSpo2 | null>(null)
  const [stress, setStress] = useState<OuraStress | null>(null)
  const [resilience, setResilience] = useState<OuraResilience | null>(null)
  const [routeIds, setRouteIds] = useState<Set<string>>(new Set())

  async function fetchAll(d: string) {
    setLoading(true)
    setError(null)
    setNoToken(false)
    setActivity(null)
    setReadiness(null)
    setSleep(null)
    setSleepSession(null)
    setWorkouts([])
    setWorkoutErr(null)
    setSessions([])
    setCardioAge(null)
    setSpo2(null)
    setStress(null)
    setResilience(null)
    setRouteIds(new Set())

    try {
      const [actR, rdR, slR, slSessR, wkR, sessR, caR, sp2R, stR, reR] = await Promise.allSettled([
        fetchOuraDailyActivity(d),
        fetchOuraReadiness(d),
        fetchOuraSleep(d),
        fetchOuraSleepSession(d),
        fetchOuraWorkouts(d),
        fetchOuraSessions(d),
        fetchOuraCardiovascularAge(d),
        fetchOuraSpo2(d),
        fetchOuraStress(d),
        fetchOuraResilience(d),
      ])

      // Redirect to connect screen for any auth / token / scope problem
      const NO_TOKEN_MSGS = [
        'No Oura account connected',
        'Oura session expired',
        'Not signed in',
        'not authorized', // scope errors: "Token is not authorized access X scope"
        'insufficient_scope',
      ]
      const allResults = [actR, rdR, slR, slSessR, wkR, sessR, caR, sp2R, stR, reR]
      const scopeErr = allResults.find(
        r =>
          r.status === 'rejected' &&
          (r as PromiseRejectedResult).reason?.message?.toLowerCase().includes('not authorized'),
      )
      if (scopeErr) {
        // Token exists but is missing required scopes — prompt reconnect
        setConnError(
          'Your Oura authorisation is missing required permissions. Please reconnect to grant them.',
        )
        setNoToken(true)
        return
      }
      if (
        allResults.some(
          r =>
            r.status === 'rejected' &&
            NO_TOKEN_MSGS.some(m => (r as PromiseRejectedResult).reason?.message?.includes(m)),
        )
      ) {
        setNoToken(true)
        return
      }

      // Only surface errors that are NOT "Unknown endpoint" (those just mean the
      // edge function hasn't been redeployed yet — individual cards show "No data")
      const realFail = allResults.find(
        r =>
          r.status === 'rejected' &&
          !(r as PromiseRejectedResult).reason?.message?.includes('Unknown endpoint'),
      ) as PromiseRejectedResult | undefined
      if (realFail) setError(realFail.reason?.message ?? 'Could not load Oura data')

      setActivity(actR.status === 'fulfilled' ? actR.value : null)
      setReadiness(rdR.status === 'fulfilled' ? rdR.value : null)
      setSleep(slR.status === 'fulfilled' ? slR.value : null)
      setSleepSession(slSessR.status === 'fulfilled' ? slSessR.value : null)
      if (wkR.status === 'fulfilled') {
        setWorkouts(wkR.value)
        setWorkoutErr(null)
      } else {
        setWorkouts([])
        setWorkoutErr((wkR as PromiseRejectedResult).reason?.message ?? 'Could not load workouts')
      }
      setSessions(sessR.status === 'fulfilled' ? sessR.value : [])
      setCardioAge(caR.status === 'fulfilled' ? caR.value : null)
      setSpo2(sp2R.status === 'fulfilled' ? sp2R.value : null)
      setStress(stR.status === 'fulfilled' ? stR.value : null)
      setResilience(reR.status === 'fulfilled' ? reR.value : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch workout routes for GPS workouts (distance > 0)
  useEffect(() => {
    const gps = workouts.filter(w => (w.distance ?? 0) > 0)
    if (gps.length === 0) return
    Promise.allSettled(
      gps.map(w => fetchOuraWorkoutRoute(w.id).then(r => ({ id: w.id, ok: r !== null }))),
    ).then(results => {
      const ids = new Set<string>()
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.ok) ids.add(r.value.id)
      }
      setRouteIds(ids)
    })
  }, [workouts])

  useEffect(() => {
    if (!user) {
      Promise.resolve().then(() => setLoading(false))
      return
    }
    // Without Supabase there can't be a stored token — show connect screen directly
    if (!supabase) {
      Promise.resolve().then(() => {
        setNoToken(true)
        setLoading(false)
      })
      return
    }
    // Skip the initial fetch if an OAuth exchange is in flight — the exchange
    // effect will call fetchAll once the tokens are safely stored.
    if (sessionStorage.getItem('oura_oauth_pending_code')) return
    fetchAll(date)
  }, [date, user])

  // ── Guest gate ────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="oura-guest">
        <div style={{ fontSize: 36 }}>🫀</div>
        <p className="text-md text-muted" style={{ margin: 0 }}>
          Sign in to view your Oura dashboard.
        </p>
      </div>
    )
  }

  // ── Connect screen ────────────────────────────────────────────────
  if (noToken) {
    return (
      <div className="oura-connect">
        <div className="oura-connect__icon">🫀</div>
        <div className="section-title oura-connect__title">Connect Oura Ring</div>
        <p className="oura-connect__body">
          Authorise this app to read your Oura data. You'll be redirected to Oura's sign-in page and
          sent back here automatically.
        </p>
        {connecting && <p className="text-base text-teal mb-16">Completing connection…</p>}
        {connError && <div className="oura-connect-error mb-16">{connError}</div>}
        <button
          onClick={() => {
            setConnError(null)
            try {
              startOuraOAuth()
            } catch (err) {
              setConnError(err instanceof Error ? err.message : 'Could not start OAuth')
            }
          }}
          disabled={connecting}
          className="tbtn"
          style={{ background: 'var(--teal)', color: '#fff', fontSize: 14, padding: '10px 28px' }}
        >
          Connect with Oura
        </button>
        <p className="oura-connect__legal">
          Tokens are stored AES-256 encrypted — your credentials never touch the browser.
        </p>
      </div>
    )
  }

  const isToday = date === todayStr()

  return (
    <div className="oura-dashboard">
      {/* ── Date navigation ── */}
      <div className="flex items-center flex-wrap gap-8 mb-20">
        <button className="date-nav-btn" onClick={() => setDate(d => addDays(d, -1))}>
          ←
        </button>
        <span className="oura-date-label">
          {fmtDate(date)}
          <span className="oura-date-sub">{date}</span>
        </span>
        <button
          className="date-nav-btn"
          onClick={() => !isToday && setDate(d => addDays(d, 1))}
          disabled={isToday}
        >
          →
        </button>
        {!isToday && (
          <button className="date-nav-btn text-sm" onClick={() => setDate(todayStr())}>
            Today
          </button>
        )}
        <button
          className="date-nav-btn"
          style={{ minWidth: 32 }}
          onClick={() => fetchAll(date)}
          disabled={loading}
          title="Refresh"
        >
          ↺
        </button>
        <button onClick={disconnect} className="disconnect-btn text-xs text-muted2">
          Disconnect
        </button>
      </div>

      {error && <div className="banner banner--error mb-16">{error}</div>}

      {/* ── Row 1: Activity · Readiness · Sleep ── */}
      <div className="flex flex-wrap gap-12 mb-12">
        <div className="metric-card" style={{ flex: '1 1 200px' }}>
          <CardHeader icon="🏃" title="Activity" />
          {loading ? (
            <Skeleton />
          ) : !activity ? (
            <Empty />
          ) : (
            <>
              {activity.score != null && (
                <BigStat value={activity.score} color={scoreColor(activity.score)} unit="/100" />
              )}
              <Row label="Steps" value={activity.steps.toLocaleString()} />
              <Row label="Active kcal" value={activity.active_calories} />
              <Row label="Total kcal" value={activity.total_calories} />
              <Row label="High activity" value={fmtDuration(activity.high_activity_time)} />
              {(activity.equivalent_walking_distance ?? 0) > 0 && (
                <Row
                  label="Equiv. walk"
                  value={`${(activity.equivalent_walking_distance / 1000).toFixed(1)} km`}
                />
              )}
            </>
          )}
        </div>

        <div className="metric-card" style={{ flex: '1 1 200px' }}>
          <CardHeader icon="💚" title="Readiness" />
          {loading ? (
            <Skeleton />
          ) : !readiness ? (
            <Empty />
          ) : (
            <>
              <BigStat
                value={readiness.score}
                color={readinessColor(readiness.score)}
                unit="/100"
              />
              <div
                className="text-sm font-600 mb-8"
                style={{ color: readinessColor(readiness.score) }}
              >
                {readinessLabel(readiness.score)}
              </div>
              {readiness.contributors.hrv_balance != null && (
                <Row label="HRV balance" value={readiness.contributors.hrv_balance} />
              )}
              {readiness.contributors.recovery_index != null && (
                <Row label="Recovery index" value={readiness.contributors.recovery_index} />
              )}
              {readiness.contributors.sleep_balance != null && (
                <Row label="Sleep balance" value={readiness.contributors.sleep_balance} />
              )}
              {readiness.contributors.resting_heart_rate != null && (
                <Row label="Resting HR" value={readiness.contributors.resting_heart_rate} />
              )}
              {readiness.temperature_deviation != null && (
                <Row
                  label="Temp deviation"
                  value={`${readiness.temperature_deviation >= 0 ? '+' : ''}${readiness.temperature_deviation.toFixed(2)}°C`}
                />
              )}
            </>
          )}
        </div>

        <div className="metric-card" style={{ flex: '1 1 200px' }}>
          <CardHeader icon="😴" title="Sleep" />
          {loading ? (
            <Skeleton />
          ) : !sleep && !sleepSession ? (
            <Empty />
          ) : (
            <>
              {sleep?.score != null && (
                <BigStat value={sleep.score} color={scoreColor(sleep.score)} unit="/100" />
              )}
              {sleepSession ? (
                <>
                  <Row label="Total" value={fmtDuration(sleepSession.total_sleep_duration)} />
                  <Row label="Deep" value={fmtDuration(sleepSession.deep_sleep_duration)} />
                  <Row label="REM" value={fmtDuration(sleepSession.rem_sleep_duration)} />
                  <Row label="Light" value={fmtDuration(sleepSession.light_sleep_duration)} />
                  <Row label="Efficiency" value={`${sleepSession.efficiency}%`} />
                  {sleepSession.average_hrv != null && (
                    <Row label="Avg HRV" value={`${sleepSession.average_hrv} ms`} />
                  )}
                  {sleepSession.lowest_heart_rate != null && (
                    <Row label="Lowest HR" value={`${sleepSession.lowest_heart_rate} bpm`} />
                  )}
                </>
              ) : sleep?.contributors ? (
                <>
                  {sleep.contributors.total_sleep != null && (
                    <Row label="Total quality" value={`${sleep.contributors.total_sleep}/100`} />
                  )}
                  {sleep.contributors.deep_sleep != null && (
                    <Row label="Deep quality" value={`${sleep.contributors.deep_sleep}/100`} />
                  )}
                  {sleep.contributors.rem_sleep != null && (
                    <Row label="REM quality" value={`${sleep.contributors.rem_sleep}/100`} />
                  )}
                  {sleep.contributors.efficiency != null && (
                    <Row label="Efficiency" value={`${sleep.contributors.efficiency}/100`} />
                  )}
                  {sleep.contributors.restfulness != null && (
                    <Row label="Restfulness" value={`${sleep.contributors.restfulness}/100`} />
                  )}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* ── Row 2: Cardio Age · SpO2 · Stress · Resilience ── */}
      <div className="flex flex-wrap gap-12 mb-12">
        <div className="metric-card" style={{ flex: '1 1 155px' }}>
          <CardHeader icon="💗" title="Cardio Age" />
          {loading ? (
            <Skeleton />
          ) : !cardioAge || cardioAge.vascular_age == null ? (
            <Empty />
          ) : (
            <BigStat value={cardioAge.vascular_age} color="var(--blue-light)" unit="yrs" />
          )}
        </div>

        <div className="metric-card" style={{ flex: '1 1 155px' }}>
          <CardHeader icon="🩸" title="SpO2" />
          {loading ? (
            <Skeleton />
          ) : !spo2 || spo2.spo2_percentage == null ? (
            <Empty />
          ) : (
            <>
              <BigStat
                value={spo2.spo2_percentage.average.toFixed(1)}
                color={spo2Color(spo2.spo2_percentage.average)}
                unit="%"
              />
              <div className="text-xs text-muted">
                {spo2.spo2_percentage.average >= 95
                  ? 'Normal'
                  : spo2.spo2_percentage.average >= 91
                    ? 'Mild low'
                    : 'Low'}
              </div>
            </>
          )}
        </div>

        <div className="metric-card" style={{ flex: '1 1 155px' }}>
          <CardHeader icon="🧘" title="Stress" />
          {loading ? (
            <Skeleton />
          ) : !stress ? (
            <Empty />
          ) : (
            <>
              {stress.day_summary && stress.day_summary !== 'no_data' && (
                <div
                  className="text-md font-600 uppercase mb-8"
                  style={{ color: stressColor(stress.day_summary) }}
                >
                  {stress.day_summary}
                </div>
              )}
              {stress.stress_high != null && (
                <Row label="Stress" value={fmtDuration(stress.stress_high)} />
              )}
              {stress.recovery_high != null && (
                <Row label="Recovery" value={fmtDuration(stress.recovery_high)} />
              )}
            </>
          )}
        </div>

        <div className="metric-card" style={{ flex: '1 1 155px' }}>
          <CardHeader icon="🛡" title="Resilience" />
          {loading ? (
            <Skeleton />
          ) : !resilience ? (
            <Empty />
          ) : (
            <>
              {resilience.level && (
                <div
                  className="text-md font-600 uppercase mb-8"
                  style={{ color: resilienceColor(resilience.level) }}
                >
                  {resilience.level}
                </div>
              )}
              {resilience.contributors.sleep_recovery != null && (
                <Row label="Sleep rec." value={resilience.contributors.sleep_recovery} />
              )}
              {resilience.contributors.daytime_recovery != null && (
                <Row label="Day rec." value={resilience.contributors.daytime_recovery} />
              )}
              {resilience.contributors.stress_impact != null && (
                <Row label="Stress imp." value={resilience.contributors.stress_impact} />
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Workouts & Mindfulness ── */}
      <div className="flex flex-wrap gap-12">
        <div className="metric-card" style={{ flex: '1 1 300px' }}>
          <CardHeader icon="🏋️" title={loading ? 'Workouts' : `Workouts (${workouts.length})`} />
          {loading ? (
            <Skeleton />
          ) : workoutErr ? (
            <div className="text-sm text-muted2" style={{ color: 'var(--coral)' }}>
              {workoutErr}
            </div>
          ) : workouts.length === 0 ? (
            <>
              <div className="text-base text-muted mb-6">No workouts found for this day</div>
              <div className="text-xs text-muted2">
                The Oura ring auto-detects most workouts, and manually started sessions sync here
                too — but live-logged sessions can take a few minutes to appear after you end them.
                Try tapping ↺ to refresh.
              </div>
            </>
          ) : (
            workouts.map(w => <WorkoutRow key={w.id} workout={w} hasRoute={routeIds.has(w.id)} />)
          )}
        </div>

        {(!loading || sessions.length > 0) &&
          (() => {
            const mindful = sessions.filter(s => s.type !== 'nap')
            return (
              <div className="metric-card" style={{ flex: '1 1 280px' }}>
                <CardHeader
                  icon="🧘"
                  title={loading ? 'Mindfulness' : `Mindfulness (${mindful.length})`}
                />
                {loading ? (
                  <Skeleton />
                ) : mindful.length === 0 ? (
                  <div className="text-base text-muted">No sessions recorded</div>
                ) : (
                  mindful.map(s => <SessionRow key={s.id} session={s} />)
                )}
              </div>
            )
          })()}
      </div>
    </div>
  )
}
