export interface ScheduleBlock {
  phase: string | null
  time: string
  title: string
  dur: string
  dot: string
  why: string
  whyTxt: string
  desc: string
  bridge: string | null
}

export interface ScheduleDay {
  day: string
  peak: string
}

export const SCHEDULE_BLOCKS: ScheduleBlock[] = [
  { phase: 'Wake-up', time: '8:00', title: 'Wake + no-phone rule', dur: '5 min', dot: 'cg', why: 'wg', whyTxt: 'Protects cortisol awakening response', desc: 'The cortisol awakening response (CAR) is a 20-40% cortisol spike in the first 30-45 min after waking that primes your brain for the day. Grabbing your phone immediately dysregulates it. Lie still, breathe, let your body wake naturally.', bridge: null },
  { phase: 'Dog walk', time: '8:05', title: 'Dog walk — light exposure', dur: '10 min', dot: 'ct', why: 'wt', whyTxt: 'Circadian anchor + melatonin suppression', desc: '2,500+ lux natural morning light enhances the CAR by 20-40% and suppresses residual melatonin — which clears later in late chronotypes. Your dog enforces a no-phone, present-moment walk. Even an overcast outdoor morning delivers ~10,000 lux vs ~500 lux indoors.', bridge: 'Return home · drop dog off' },
  { phase: 'Fuel up', time: '8:20', title: 'Hydration + breakfast', dur: '25 min', dot: 'ca', why: 'wa', whyTxt: 'Ghrelin peak + dopamine precursors', desc: 'Start with 500ml water. Eat — ghrelin peaks in the morning and eating early supports a longer eating-window closure in the evening, both linked to better body composition. Protein provides tyrosine for dopamine synthesis. High fiber + fat slows gastric emptying so you stay full through the commute walk.', bridge: null },
  { phase: 'Meditation', time: '8:45', title: 'Mindfulness meditation', dur: '10-15 min', dot: 'cgo', why: 'wgo', whyTxt: 'PFC priming + cortisol regulation', desc: 'Optimal window for your late chronotype: the CAR has peaked, the brain is alert but not yet task-loaded, and the nervous system is receptive to downregulation. Research shows a single 13-minute meditation session measurably improves attention, working memory, and emotional regulation hours later. Use breath focus or a body scan. No guided narrative — silence or ambient sound only.', bridge: null },
  { phase: 'Activation', time: '9:00', title: 'Cold water + shower', dur: '10 min', dot: 'cp', why: 'wp', whyTxt: 'Norepinephrine + PFC activation', desc: 'End your shower with 30-90 seconds of cold water. Research shows this triggers norepinephrine release (up to 300%), dopamine, and serotonin. fMRI studies show increased neural connectivity in the prefrontal cortex and anterior cingulate — your decision-making and attention centers.', bridge: null },
  { phase: 'Commute', time: '9:15', title: 'Walk to office — planning walk', dur: '30 min', dot: 'ct', why: 'wt', whyTxt: 'BDNF + default mode network', desc: 'Three things at once: BDNF-boosting movement, default mode network priming (no podcasts for the first 15 min — let your mind surface ideas), and mental rehearsal of your top 1-2 tasks. Arrive pre-loaded.', bridge: null },
  { phase: 'Ramp-up', time: '9:50', title: 'Caffeine — strategic timing', dur: '—', dot: 'ca', why: 'wa', whyTxt: 'Optimal adenosine clearance', desc: '~110 minutes after waking. Adenosine has now cleared sufficiently — caffeine amplifies alertness without the afternoon crash caused by drinking coffee during the CAR window. 1-2 cups maximum.', bridge: null },
  { phase: null, time: '10:00', title: 'Daily planning block', dur: '15 min', dot: 'cp', why: 'wp', whyTxt: 'Reduce decision fatigue', desc: 'Write your 1-3 most important tasks. No email, no Slack. You already did mental rehearsal on the walk — this is just formalizing it. Externalizing priorities now means your peak window is pure execution.', bridge: null },
  { phase: null, time: '10:15', title: 'Warm-up work — low friction', dur: '45 min', dot: 'cgr', why: 'wgr', whyTxt: 'Synchrony effect — protect your peak', desc: 'Code reviews, reading docs, async replies, writing tests. The synchrony effect shows late chronotypes perform worst on demanding tasks in the early morning. Low-friction real work here is productive without burning your peak.', bridge: null },
  { phase: 'PEAK', time: '11:00', title: 'Deep work block', dur: '90-120 min', dot: 'cg', why: 'wg', whyTxt: 'Peak alpha/beta brainwave power', desc: 'Architecture decisions, complex debugging, system design — anything requiring working memory and executive function. Block calendar. Silence notifications. Use a 90-min ultradian cycle. Research on late chronotypes confirms superior processing speed and executive control in this window. Use it deliberately every day.', bridge: null },
]

export const SCHEDULE_DAYS: ScheduleDay[] = [
  { day: 'Monday', peak: 'Monday peak: 11 AM - 1 PM. Cook a double batch of quinoa tonight — powers Wed, Thu, Fri lunches.' },
  { day: 'Tuesday', peak: 'Tuesday peak: 11 AM - 1 PM. Use the commute walk to mentally rehearse your top priority. Arrive pre-loaded.' },
  { day: 'Wednesday', peak: 'Midweek peak: 11 AM - 1 PM. Leave headphones out on the commute today — ambient sound enhances creative problem-solving.' },
  { day: 'Thursday', peak: 'Thursday peak: 11 AM - 1 PM. Statistically high-decision-load day for engineers — protect this window especially.' },
  { day: 'Friday', peak: 'End-of-week peak: 11 AM - 1 PM. Great for refactoring, documentation, retrospectives. Use commute to close open loops.' },
]
