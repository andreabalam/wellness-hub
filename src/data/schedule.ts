export interface ScheduleBlock {
  id?: string
  phase: string | null
  time: string       // display string, e.g. "8:00" or "11:00"
  title: string
  dur: string        // display string, e.g. "30 min", "1 hr 30 min"
  dot: string        // CSS class, e.g. "cg", "ct"
  why: string        // CSS class, e.g. "wg", "wt"
  whyTxt: string
  desc: string
  bridge: string | null
}

export interface ScheduleDay {
  day: string
  peak: string
}

// ── Editable block (stored in localStorage) ──────────────────────

export interface CustomBlock {
  id: string
  time: string       // "HH:MM" 24-hour, e.g. "08:00", "11:00"
  title: string
  dur: string        // free text, e.g. "30 min"
  color: string      // key from BLOCK_COLORS
  whyTxt: string     // badge label
  desc: string
  phase: string      // section header; empty string = none
}

export const BLOCK_COLORS = [
  { key: 'green',  label: 'Green',  dot: 'cg',  why: 'wg',  hex: '#4caf7d' },
  { key: 'teal',   label: 'Teal',   dot: 'ct',  why: 'wt',  hex: '#3a9090' },
  { key: 'amber',  label: 'Amber',  dot: 'ca',  why: 'wa',  hex: '#c9913a' },
  { key: 'gold',   label: 'Gold',   dot: 'cgo', why: 'wgo', hex: '#b8963a' },
  { key: 'purple', label: 'Purple', dot: 'cp',  why: 'wp',  hex: '#8a6ab8' },
  { key: 'gray',   label: 'Gray',   dot: 'cgr', why: 'wgr', hex: '#4a5a4d' },
] as const

export function colorDef(key: string) {
  return BLOCK_COLORS.find(c => c.key === key) ?? BLOCK_COLORS[0]
}

/** Convert a stored CustomBlock to a ScheduleBlock for rendering */
export function customToScheduleBlock(b: CustomBlock): ScheduleBlock {
  const c = colorDef(b.color)
  return {
    id:      b.id,
    phase:   b.phase || null,
    time:    b.time,
    title:   b.title,
    dur:     b.dur || '—',
    dot:     c.dot,
    why:     c.why,
    whyTxt:  b.whyTxt,
    desc:    b.desc,
    bridge:  null,
  }
}

/** Convert a default ScheduleBlock to CustomBlock (for seeding the editor) */
function dotToColorKey(dot: string): string {
  const map: Record<string, string> = {
    cg: 'green', ct: 'teal', ca: 'amber', cgo: 'gold', cp: 'purple', cgr: 'gray',
  }
  return map[dot] ?? 'green'
}

export function defaultToCustomBlock(b: ScheduleBlock, idx: number): CustomBlock {
  return {
    id:      b.id ?? `default-${idx}`,
    time:    b.time.includes(':') ? b.time.padStart(5, '0') : '09:00',
    title:   b.title,
    dur:     b.dur === '—' ? '' : b.dur,
    color:   dotToColorKey(b.dot),
    whyTxt:  b.whyTxt,
    desc:    b.desc,
    phase:   b.phase ?? '',
  }
}

export const SCHEDULE_BLOCKS: ScheduleBlock[] = [
  {
    phase: 'Wake-up', time: '8:00', title: 'Wake + no-phone rule', dur: '5 min',
    dot: 'cg', why: 'wg', whyTxt: 'Protects cortisol awakening response',
    desc: 'The cortisol awakening response (CAR) is a 20-40% cortisol spike in the first 30-45 min after waking that primes your brain for the day. Grabbing your phone immediately dysregulates it — the incoming information load activates the amygdala before the prefrontal cortex is fully online, setting a reactive rather than intentional tone. Lie still, breathe, let your body wake naturally.',
    bridge: null,
  },
  {
    phase: 'Dog walk', time: '8:05', title: 'Dog walk — light exposure', dur: '10 min',
    dot: 'ct', why: 'wt', whyTxt: 'Circadian anchor + melatonin suppression',
    desc: '2,500+ lux natural morning light enhances the CAR by 20-40% and suppresses residual melatonin — which clears later in late chronotypes. Your dog enforces a no-phone, present-moment walk. Even an overcast outdoor morning delivers ~10,000 lux vs ~500 lux indoors. This single habit advances your circadian clock by 30-60 min over time, shifting your natural peak window earlier.',
    bridge: 'Return home · drop dog off',
  },
  {
    phase: 'Fuel up', time: '8:20', title: 'Hydration + breakfast', dur: '20 min',
    dot: 'ca', why: 'wa', whyTxt: 'Ghrelin peak + dopamine precursors',
    desc: 'Start with 500 ml water — overnight dehydration of even 1-2% impairs cognitive performance. Eat: ghrelin peaks in the morning and eating early supports a longer eating-window closure in the evening, both linked to better body composition. Protein provides tyrosine for dopamine synthesis. High fibre + fat slows gastric emptying so you stay full through the commute. Tonight\'s breakfast prep (9:30 PM) means this is zero-decision, zero-friction.',
    bridge: null,
  },
  {
    phase: 'Intention', time: '8:40', title: 'Meditation · Gratitude · Affirmations', dur: '18-20 min',
    dot: 'cgo', why: 'wgo', whyTxt: 'PFC priming · gratitude imprint · identity activation',
    desc: 'One consolidated block with a fixed internal sequence — the order is not interchangeable.\n\n1 · MEDITATION (13 min). The CAR has peaked, the brain is alert but not yet task-loaded. A single 13-minute session measurably improves attention, working memory, and emotional regulation hours later. Breath focus or body scan. No guided narrative — silence or ambient sound only.\n\n2 · GRATITUDE (3-4 min, written by hand). Immediately after meditation while the nervous system is still in a calm, receptive state. Write 3 specific things — not categories ("family"), but concrete moments ("the 10 minutes of quiet before 8 AM"). Hand-writing engages the reticular activating system more deeply than typing, increasing encoding. This is your ONE daily gratitude practice — it lives here and only here. No evening repetition.\n\n3 · AFFIRMATIONS (2 min, spoken aloud). The post-meditation critical faculty is at its lowest — the window where identity-level statements are most likely to bypass the inner critic and be neurologically processed as true rather than aspirational. Keep them present-tense and specific.',
    bridge: null,
  },
  {
    phase: 'Activation', time: '9:00', title: 'Cold shower + skin care', dur: '15 min',
    dot: 'cp', why: 'wp', whyTxt: 'Norepinephrine spike → steady focus',
    desc: 'The cold shower now explicitly follows meditation rather than preceding it — this is a deliberate sequencing choice. Skin is warm, circulation is elevated from the parasympathetic state of meditation, and the system transitions from calm to activated rather than the reverse.\n\nEnd the shower with 30-90 seconds of cold water. This triggers norepinephrine release (up to 300%), dopamine, and serotonin. fMRI studies show increased neural connectivity in the prefrontal cortex and anterior cingulate — your decision-making and attention centres.\n\nSkin care and facial massage immediately after (5 min): skin is warm and receptive, circulation is elevated, and the mechanical stimulation of the facial massage converts the norepinephrine spike from acute alertness into productive, steady focus — smoothing the edge that can otherwise tip into jitteriness before caffeine.',
    bridge: null,
  },
  {
    phase: 'Commute', time: '9:15', title: 'Walk to office — planning walk', dur: '30 min',
    dot: 'ct', why: 'wt', whyTxt: 'BDNF + default mode network',
    desc: 'Three things simultaneously: BDNF-boosting movement (30 min of low-intensity walking meaningfully elevates BDNF, which supports neuroplasticity and learning), default mode network priming (no podcasts for the first 15 min — let your mind surface ideas, connections, and solutions it was processing overnight), and mental rehearsal of your top 1-2 tasks. Arrive pre-loaded.',
    bridge: null,
  },
  {
    phase: 'Ramp-up', time: '9:50', title: 'Caffeine — strategic timing', dur: '—',
    dot: 'ca', why: 'wa', whyTxt: 'Optimal adenosine clearance window',
    desc: '~110 minutes after waking. Adenosine has now cleared sufficiently — caffeine amplifies alertness without the afternoon crash caused by drinking coffee during the CAR window (which merely masks adenosine rather than clearing it, causing a rebound dip at 2-3 PM). 1-2 cups maximum. Cut off by 1:00 PM to protect sleep onset at 10:30.',
    bridge: null,
  },
  {
    phase: null, time: '10:00', title: 'Daily planning block', dur: '15 min',
    dot: 'cp', why: 'wp', whyTxt: 'Decision reduction + implementation intentions',
    desc: 'Two parts — both take under 15 minutes total.\n\n1 · TOP 3 TASKS. Write the 1-3 most important things for today. Specific and actionable, not vague categories. No email, no Slack. You already did mental rehearsal on the walk — this is just formalising it. Externalising priorities now means your peak window is pure execution with no meta-thinking.\n\n2 · DAILY INTENTION. One sentence on how you want to show up today — not what you\'ll do, but who you\'ll be doing it as. Example: "Today I work with focus and without self-interruption." Research on implementation intentions (Gollwitzer, 2006) shows that people who form specific intentions are 2-3× more likely to follow through on their goals. The mechanism: the intention pre-loads the prefrontal cortex with a decision already made, so when the moment arrives (distraction, fatigue, the urge to check the phone) the response is automatic rather than effortful.\n\nWriting rhythm check: gratitude is done (8:40). Intention is here. Brain dump is tonight (9:00 PM). That is the complete daily writing practice.',
    bridge: null,
  },
  {
    phase: null, time: '10:15', title: 'Warm-up work — low friction', dur: '45 min',
    dot: 'cgr', why: 'wgr', whyTxt: 'Synchrony effect — protect your peak',
    desc: 'Code reviews, reading docs, async replies, writing tests, light admin. The synchrony effect (Anderson et al.) shows late chronotypes perform worst on inhibition and complex executive tasks in the early morning — but perform well on tasks requiring broad associative thinking. Low-friction real work here is productive without burning the cognitive fuel you need for 11:00.',
    bridge: null,
  },
  {
    phase: 'PEAK', time: '11:00', title: 'Deep work block', dur: '90 min',
    dot: 'cg', why: 'wg', whyTxt: 'Peak alpha/beta brainwave power',
    desc: 'Architecture decisions, complex debugging, system design, hard writing — anything requiring working memory and executive function. Block calendar. Silence notifications. One 90-minute ultradian cycle, uninterrupted.\n\nResearch on late chronotypes confirms superior processing speed and executive control in this window. Use it deliberately every day.\n\nThe block runs until 12:30 by design — see Lunch for why cutting at noon is a false economy.',
    bridge: null,
  },
  {
    phase: null, time: '12:30', title: 'Lunch', dur: '30 min',
    dot: 'ca', why: 'wa', whyTxt: 'Ultradian cycle completion',
    desc: 'Moved from noon specifically to complete the full 90-minute ultradian deep work cycle. Cutting concentration at 60 minutes — which a noon lunch forces if deep work starts at 11:00 — is the hardest re-entry point in the cycle. The mid-cycle break leaves working memory in a partially loaded state that is effortful to reload. Finishing the cycle naturally at 12:30 means you close the loop cleanly and resume the afternoon with lower cognitive debt.\n\nHigh-protein lunch (30-40g) supports afternoon neurotransmitter synthesis. Keep it light enough that the post-meal dip is minimal — this is not the main meal of the day.',
    bridge: null,
  },
  {
    phase: 'Workout', time: '4:00 PM', title: 'Workout', dur: '60-90 min',
    dot: 'cg', why: 'wg', whyTxt: 'Core temp peak + reaction time peak',
    desc: 'Moved from 4:30 to 4:00 PM — this gives you a comfortable 90-minute buffer before a 6:00-6:30 PM dinner without rushing the session or the post-workout transition.\n\nCore body temperature peaks between 3:00-6:00 PM in late chronotypes, making this window physiologically optimal for strength output, reaction time, and power. Injury risk is lower; performance ceiling is higher.\n\nHIIT or strength days: target dinner at 6:30 PM; keep the post-workout meal moderate in size (the anabolic window is real but wide — up to 2 hours post-training). Prioritise protein (30-40g) and some carbohydrate for glycogen replenishment.\n\nPilates and recovery days: more flexible. You can extend the session to 5:30 or shift dinner to 6:00 without consequence — the recovery demand is lower and the parasympathetic shift from Pilates actually supports earlier eating.',
    bridge: null,
  },
  {
    phase: 'Evening', time: '9:00 PM', title: 'Brain dump + wind-down', dur: '30 min',
    dot: 'ct', why: 'wt', whyTxt: 'Rumination clearance + sleep-onset',
    desc: 'Two distinct practices in sequence.\n\n1 · BRAIN DUMP (5 min). Write down every unresolved thought, open loop, worry, or to-do that is still active in working memory. Not a journal — a capture. Research on expressive writing and the Zeigarnik effect shows that unfinished tasks occupy disproportionate mental bandwidth until they are externalised. This single practice reduces sleep-onset time and late-chronotype rumination more reliably than most relaxation techniques.\n\nNote: there is no gratitude here. Gratitude happened at 8:40 AM and only there. Repeating it at night dilutes the practice and adds a scorekeeping layer to the end of the day.\n\n2 · WIND-DOWN. Dim lights (blue light suppresses melatonin onset by up to 3 hours). Stop screens or use blue-light blocking. Keep the room cool — core body temperature must drop 1-2°F for sleep onset; ambient temperature is the fastest lever.\n\nSunday evenings only: add a 10-minute weekly goals review after the brain dump. Weekly, not daily. Daily goal-writing at night creates scorekeeping anxiety rather than clarity. The weekly frame gives you perspective and course-correction without the pressure of nightly accountability.',
    bridge: null,
  },
  {
    phase: null, time: '9:30 PM', title: 'Breakfast prep', dur: '10 min',
    dot: 'cgr', why: 'wgr', whyTxt: 'Eliminate morning decisions',
    desc: 'Lay out everything needed for tomorrow\'s breakfast tonight. This is not a small efficiency win — it eliminates 3-5 morning decisions during the cortisol awakening response, when executive function is already allocated to the no-phone rule, the walk, and mental space for the intention block.\n\nOats pre-soaked or overnight prep set. Supplements out on the counter. Water bottle filled and in the fridge. Anything that requires even a minor choice in the morning gets resolved now, in a calm, well-lit kitchen, with full cognitive capacity. The morning runs on autopilot. The brain is free.',
    bridge: null,
  },
  {
    phase: 'Sleep', time: '10:30 PM', title: 'Sleep', dur: '8 hr target',
    dot: 'cp', why: 'wp', whyTxt: 'Non-negotiable — foundational to everything',
    desc: 'This is not a suggestion. Every protocol in this schedule — the CAR optimisation, the cognitive peak, the workout timing, the cold exposure, the meditation — has roughly 30-50% of its effect size reduced by insufficient or inconsistent sleep. Sleep is not the recovery from training. Sleep is the training.\n\n7.5-9 hours at consistent timing. For your late chronotype, 10:30 PM is the earliest biologically natural sleep onset — working with your chronotype rather than against it.\n\nEnvironment: room temperature 65-68°F (18-20°C). Pitch dark — even small light sources through closed eyelids suppress melatonin. White noise or silence.\n\nThe first 2 hours of sleep contain the majority of slow-wave (deep) sleep: the stage responsible for motor learning consolidation, immune function, cellular repair, and HGH release. The final 2 hours contain the majority of REM sleep: the stage responsible for emotional processing, memory integration, and creative insight. Cutting either end has asymmetric costs.\n\nProtect 10:30. Everything else in this programme depends on it.',
    bridge: null,
  },
]