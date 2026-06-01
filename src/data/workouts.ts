export interface Exercise {
  t: string
  d: string
  i: string
}

export interface WorkoutDay {
  slot: string
  type: string
  label: string
  time: string
  color: string
  solin: string
  exs: Exercise[]
  altLabel?: string
  alts?: Exercise[]
}

export interface WorkoutWeek {
  week: number
  label: string
  color: string
  note: string
  nutr: string
  days: WorkoutDay[]
}

export interface PlanNote {
  icon: string
  title: string
  color: string
  text: string
}

export const WORKOUT_PLAN: WorkoutWeek[] = [
  {
    week: 1, label: 'Week 1 - Menstrual Phase', color: 'var(--purple)',
    note: 'Energy and tolerance are lowest. Pilates, gentle glute activation, Zone 2 walking. Stay consistent without overreaching.',
    nutr: 'Stick to ~1,380 kcal. Extra magnesium-rich foods (dark chocolate, walnuts, spinach) help with cramping and mood.',
    days: [
      {
        slot: 'Day A', type: 'Pilates', label: 'Reformer / Mat Pilates', time: '60 min - weekend preferred', color: 'var(--purple)',
        solin: "Pilates aligns with Solin's activation-first philosophy - mind-muscle connection before load.",
        exs: [
          { t: 'Footwork series', d: '4 min', i: 'Reformer footwork or supine foot press against wall. Heels, arches, toes. Slow and controlled.' },
          { t: 'Hundred', d: '3 sets', i: 'Classic core pump. Keep lower back imprinted. Breathe 5 pumps in, 5 out. Bend knees if lower back lifts.' },
          { t: 'Single leg circle', d: '5 each direction x3', i: 'Pelvis stays absolutely still. Circle from the hip socket. Builds hip stability.' },
          { t: 'Rolling like a ball', d: '8 reps', i: 'Spinal massage, mobility, parasympathetic activation. Perfect for Day 1 of your period.' },
          { t: 'Side-lying series', d: '12 reps x3 each side', i: 'Leg lifts, clamshells, kick-backs. Isolate glute med and minimus.' },
          { t: 'Mermaid + spine twist', d: '5 each', i: 'Lateral spine mobility. Hold each, breathe into the stretch.' },
        ],
        altLabel: 'Home Alternative - Gentle Glute Activation',
        alts: [
          { t: 'Supine hip circles', d: '10 each direction', i: 'Lying on back, draw circles with knees. Hip mobilisation.' },
          { t: 'Glute bridge pulses', d: '3x20 - 5 lb DB', i: '5 lb dumbbell on hips. Pulse at top. Activates glutes without heavy loading.' },
          { t: 'Side-lying clamshells', d: '3x15 each', i: 'Keep hips stacked. Top knee opens like a clamshell. Slow and controlled.' },
          { t: 'Bird-dog', d: '3x10 each side', i: 'All fours. Extend opposite arm and leg. Hold 2 sec. Core and glute stability.' },
          { t: "Child's pose + cat-cow", d: '5 min', i: 'Flow between the two for full spinal mobility.' },
        ],
      },
      {
        slot: 'Day B', type: 'Home', label: 'Glute Activation + Zone 2 Walk', time: '45 min', color: 'var(--purple)',
        solin: "From Solin's Busy Girl Guide: short targeted glute sessions on low-energy days beat skipping entirely.",
        exs: [
          { t: 'Warm-up walk', d: '5 min', i: 'Easy pace. Get blood moving without spiking cortisol.' },
          { t: 'Donkey kick - 3 lb DB behind knee', d: '3x15 each', i: 'On all fours. 3 lb DB tucked behind knee. Drive heel to ceiling, squeeze at top. Solin signature: isolate glute max without lower back.' },
          { t: 'Fire hydrant', d: '3x15 each', i: 'Same position. Lift knee laterally to hip height. Pause 1 sec. Targets glute medius.' },
          { t: 'Frog pump', d: '3x20', i: 'Lying on back, soles together, knees wide. Pump hips up. Short range but intense glute burn.' },
          { t: 'Zone 2 walk', d: '20 min', i: 'Brisk walking at conversational pace, 60-70% max HR. Fat oxidation is highest here without cortisol spike.' },
          { t: 'Hip flexor + pigeon stretch', d: '5 min', i: '90 sec each side. Non-optional - desk work makes hip flexors chronically tight.' },
        ],
      },
      {
        slot: 'Day C', type: 'Rest', label: 'Rest or Gentle Yoga / Walk', time: 'Optional - 20-30 min', color: 'var(--muted2)',
        solin: 'Rest is programmed. Solin explicitly builds in deload days - overtraining during menstruation raises cortisol and stalls fat loss.',
        exs: [
          { t: 'Gentle yoga or stretching', d: '20-30 min', i: 'Any yin yoga sequence. Hips, lower back, hamstrings. Or a slow walk with your dog.' },
          { t: 'Box breathing', d: '5 min', i: '4 sec in / 4 hold / 4 out / 4 hold. Activates parasympathetic system. Do before bed too.' },
        ],
      },
      {
        slot: 'Day D', type: 'Pilates', label: 'Reformer / Mat Pilates - Session 2', time: '60 min', color: 'var(--purple)',
        solin: 'Second Pilates session. Focus on lower body endurance - long holds build slow-twitch glute fibres that contribute to shape.',
        exs: [
          { t: 'Spine articulation warm-up', d: '3 min', i: 'Roll down vertebra by vertebra. Roll up the same way. 6 reps.' },
          { t: 'Leg press or wall sit', d: '3x45 sec', i: 'Full leg press with even weight. Or wall sit with heels pressed down for glute activation.' },
          { t: 'Long box pulling straps', d: '3x10', i: 'Prone on reformer or floor. Arms extend overhead and pull back - back extension with lat activation.' },
          { t: 'Side split / lateral lunge', d: '3x12 each', i: 'Wide lateral movement. Challenges hip abductors and inner thighs.' },
          { t: 'Teaser prep', d: '5 reps', i: 'V-sit hold with arms parallel. Hold 3-5 sec each rep.' },
          { t: 'Spine stretch cool-down', d: '5 min', i: 'Full cool-down. Breath focus.' },
        ],
        altLabel: 'Home Alternative - Lower Body Endurance',
        alts: [
          { t: 'Bodyweight sumo squat', d: '3x20', i: 'Wide stance, toes out 45 deg. Slow 3-sec descent. 5 lb DB at chest if desired.' },
          { t: 'Reverse lunge with knee drive', d: '3x12 each', i: 'Step back, lower knee near floor, drive front knee up on return. Balance and control focus.' },
          { t: 'Romanian deadlift', d: '3x12 - 10 lb DBs', i: 'Hinge at hips, feel hamstring stretch, drive hips forward. 3 sec eccentric.' },
          { t: 'Standing hip abduction', d: '3x15 each', i: 'Stand on one leg, raise other laterally to hip height. Wall for balance. Glute med.' },
          { t: 'Calf raises + ankle circles', d: '2 min', i: 'Circulation and ankle mobility. Important for lower body biomechanics.' },
        ],
      },
    ],
  },
  {
    week: 2, label: 'Week 2 - Follicular Phase', color: 'var(--green)',
    note: 'Your strongest week. Rising estrogen improves neuromuscular recruitment, pain tolerance, and recovery. Push heavier, add reps, attempt PRs.',
    nutr: 'Metabolism is slightly lower - you may feel less hungry. Don\'t undereat. Hit ~1,380 kcal with protein emphasis. Muscle synthesis efficiency is highest right now.',
    days: [
      {
        slot: 'Day A', type: 'Home', label: 'Solin Glute Build - Heavy Lower Body', time: '55-60 min', color: 'var(--green)',
        solin: 'Directly from Glute Build and Shred: compound lift first, isolation superset, metabolic burnout. 3-1-1 tempo (3 sec down, 1 pause, 1 up).',
        exs: [
          { t: 'Warm-up: hip activation circuit', d: '8 min', i: 'Glute bridge 20 > clamshell 15 each > donkey kick 10 each. Two rounds. Prime before loading.' },
          { t: 'A1: Romanian Deadlift', d: '4x10 - 10 lb DBs', i: 'Hinge deep, feel full hamstring stretch, squeeze glutes hard at top. 3 sec eccentric. No rounding spine. Builds the hamstring-glute tie-in that creates the under-butt shape.' },
          { t: 'A2: Sumo squat hold', d: '4x30 sec - 5 lb DB', i: 'Superset with RDL. Wide stance, toes out, goblet grip. Hold at bottom - isometric glute and inner thigh. Rest 60 sec between supersets.' },
          { t: 'B1: Single-leg glute bridge', d: '3x12 each - 5 lb DB', i: '5 lb DB on working hip. Drive through heel, non-working leg extended. Full hip extension at top.' },
          { t: 'B2: Lateral step with pause', d: '3x15 each direction', i: 'Superset with bridge. Step wide, hold at wide position 1 sec, step back. Glute med.' },
          { t: 'C: Reverse lunge to curtsy lunge', d: '3x10 each', i: 'Metabolic finisher. Reverse lunge, return to stand, curtsy lunge same leg. Hits glute max, med, and hip abductors.' },
          { t: 'Cool-down', d: '8 min', i: 'Pigeon 90 sec each, lying hamstring stretch, low lunge hip flexor, figure-4 glute stretch.' },
        ],
      },
      {
        slot: 'Day B', type: 'Pilates', label: 'Reformer / Mat Pilates - Power and Control', time: '60 min', color: 'var(--green)',
        solin: 'Follicular Pilates: push into harder variations. Your nervous system is primed. Attempt progressions you normally avoid.',
        exs: [
          { t: 'Roll-down + cat-cow warm-up', d: '3 min', i: '8 roll-downs, 10 cat-cows.' },
          { t: 'Reformer footwork - heavier spring', d: '4 min', i: 'Progress resistance. Heels to arches to toes to single leg if possible.' },
          { t: 'Plank to pike', d: '3x8', i: 'From plank, pike hips up pressing through shoulders. Deep core and shoulder stability.' },
          { t: 'Kneeling side kick series', d: '3x12 each', i: 'Kneeling on one knee, other leg extended. Kick forward and back. Glute med and lateral core.' },
          { t: 'Swan / back extension', d: '3x8', i: 'Prone back extension. Builds posterior chain, counteracts desk-posture flexion.' },
          { t: 'Teaser', d: '3x5', i: 'Full V-sit roll-back and up. Bent-knee version if needed.' },
          { t: 'Spine stretch + mermaid cool-down', d: '5 min', i: 'Deep forward fold, lateral stretch, breathing.' },
        ],
        altLabel: 'Home Alternative - Upper Body + Core',
        alts: [
          { t: 'Push-up progression', d: '4x10', i: 'Full push-ups or incline on bed edge. Follicular peak - attempt full range. 3 sec eccentric.' },
          { t: 'Bent-over row', d: '3x12 - 10 lb DBs', i: 'Hinge 45 deg, row elbows back and up, squeeze shoulder blades.' },
          { t: 'Overhead press', d: '3x10 - 5 lb DBs', i: 'Seated. Press overhead, control the descent.' },
          { t: 'Tricep kickback', d: '3x12 - 3 lb DBs', i: 'Hinge, upper arm parallel to floor, extend forearm back. Squeeze at full extension.' },
          { t: 'Dead bug', d: '3x10 each', i: 'Lower opposite arm and leg to 2 inches from floor. Lower back stays imprinted.' },
          { t: 'Hollow body hold', d: '3x20 sec', i: 'Arms by ears, legs low. Press lower back into floor.' },
        ],
      },
      {
        slot: 'Day C', type: 'Home', label: 'Glute Shred Circuit - Solin Metabolic Style', time: '45 min', color: 'var(--green)',
        solin: 'Directly from the Busy Girl Glute Guide: high-rep, short-rest circuits that keep heart rate elevated while targeting the glutes.',
        exs: [
          { t: 'Warm-up: jumping jacks + hip swings', d: '5 min', i: '2 min jacks, 90 sec hip swings each side, 30 sec high knees.' },
          { t: 'Circuit x4 rounds (45 sec on / 15 sec rest)', d: '60 sec rest between rounds', i: 'All 5 exercises back-to-back. Rest 60 sec between full rounds. The Solin shred format.' },
          { t: 'Squat pulse', d: '45 sec', i: 'Bodyweight or 3 lb DBs. Sink to parallel, pulse 2 inches up-down.' },
          { t: 'Glute bridge march', d: '45 sec', i: 'Hips up in bridge, alternate lifting knees to chest.' },
          { t: 'Lateral lunge', d: '45 sec alternating', i: 'Step wide to each side, sit into the stepping leg. Inner thighs and glutes.' },
          { t: 'Donkey kick', d: '45 sec each side', i: 'All fours. Drive heel to ceiling. Squeeze at top.' },
          { t: 'Reverse lunge', d: '45 sec alternating', i: 'Step back, lower knee near floor. Drive through front heel. Add 3 lb DBs if manageable.' },
          { t: 'Cool-down', d: '7 min', i: 'Pigeon, hamstring stretch, low lunge, child\'s pose.' },
        ],
      },
      {
        slot: 'Day D', type: 'Rest', label: 'Active Recovery + Stretching', time: '30 min', color: 'var(--muted2)',
        solin: 'Active recovery is programmed - not optional. Follicular allows faster recovery but skipping accumulates fatigue that blunts Week 3.',
        exs: [
          { t: 'Dog walk or easy walk', d: '20 min', i: 'Zone 2 pace. NEAT - non-exercise activity thermogenesis - contributes meaningfully to weekly calorie burn.' },
          { t: 'Full body stretch', d: '10 min', i: 'Hip flexors, hamstrings, glutes, upper back, chest. Hold each 45-60 sec.' },
        ],
      },
    ],
  },
  {
    week: 3, label: 'Week 3 - Ovulatory to Luteal Phase', color: 'var(--amber)',
    note: 'Bridges ovulation (high energy) into early luteal (progesterone rising, recovery slower). First half: maintain intensity. Second half: moderate load, more isolation.',
    nutr: 'Metabolic rate rises ~100-200 kcal. Allow ~1,500 kcal on the 2 highest-intensity days. Don\'t restrict aggressively when progesterone peaks - it raises cortisol and impairs fat metabolism.',
    days: [
      {
        slot: 'Day A', type: 'Home', label: 'Solin Glute Build - Moderate Load High Reps', time: '55 min', color: 'var(--amber)',
        solin: 'Same Solin structure as Week 2 Day A - dial weights down one step, reps up. 10 lb to 5 lb, 12 reps to 15 reps.',
        exs: [
          { t: 'Warm-up: glute activation', d: '8 min', i: 'Frog pumps 20, clamshell 15 each, fire hydrant 12 each.' },
          { t: 'A1: Romanian Deadlift', d: '4x15 - 5 lb DBs', i: 'Lighter than Week 2, deeper stretch, more time under tension. 3 sec eccentric, 1 sec pause at bottom, 1 sec up.' },
          { t: 'A2: Hip thrust hold', d: '4x15 - 5 lb DB', i: 'Upper back on sofa edge, 5 lb DB on hips. Full extension, 2 sec hold at top. Solin signature - hip thrust is the highest-EMG glute max exercise.' },
          { t: 'B1: Sumo goblet squat', d: '3x15 - 5 lb DB', i: 'Wide stance, DB at chest. Slow descent, drive knees out, squeeze glutes at top.' },
          { t: 'B2: Seated abduction', d: '3x20', i: 'Seated, push knees out against hands or 3 lb DBs on knees.' },
          { t: 'C: Glute bridge to marching', d: '3x20 total', i: 'Hips up, hold, march knees alternately. Low impact, high glute endurance.' },
          { t: 'Cool-down', d: '8 min', i: 'Extended pigeon 2 min each, lying spinal twist, child\'s pose with breathing.' },
        ],
      },
      {
        slot: 'Day B', type: 'Pilates', label: 'Reformer / Mat Pilates - Restore and Strengthen', time: '60 min', color: 'var(--amber)',
        solin: 'Pilates perfectly placed in luteal phase - controlled, mindful movement that maintains training stimulus without high cortisol impact.',
        exs: [
          { t: 'Breathing + spine articulation warm-up', d: '5 min', i: 'Ribcage breathing, full roll-down, cat-cow. Luteal phase benefits hugely from parasympathetic activation before exercise.' },
          { t: 'Reformer footwork or wall series', d: '5 min', i: 'Standard footwork. Focus on even pressure through both feet.' },
          { t: 'Hundred (modified)', d: '3 sets', i: 'Bent-knee version if lower back is tender. Progesterone can increase lower back sensitivity.' },
          { t: 'Long stretch / plank variations', d: '3x10', i: 'Hold plank, add small pike. Focus on stability over speed.' },
          { t: 'Side-lying glute series', d: '3x15 each', i: 'Leg lifts, circles, kick-backs. Glute med and minimus.' },
          { t: 'Elephant / forward fold', d: '5 reps', i: 'Deep hamstring and calf stretch.' },
          { t: "Rolling like a ball + child's pose cool-down", d: '5 min', i: 'Spinal massage, breath, parasympathetic activation.' },
        ],
        altLabel: 'Home Alternative - Full Body Moderate + Core',
        alts: [
          { t: 'Bodyweight squat to lateral raise', d: '3x12 - 3 lb DBs', i: 'Squat, stand, raise arms laterally to shoulder height. Controlled tempo.' },
          { t: 'Single-leg Romanian deadlift', d: '3x10 each - 5 lb DB', i: 'Balance challenge. Hinge slowly, feel hamstring, return.' },
          { t: 'Chest fly', d: '3x12 - 3 lb DBs', i: 'Lying on floor. Arms wide, slight elbow bend, bring together overhead.' },
          { t: 'Bicycle crunch', d: '3x20', i: 'Slow controlled rotation. Elbow to opposite knee.' },
          { t: 'Glute bridge with 5 lb DB', d: '3x15', i: 'Maintain glute stimulus even during the lower-intensity week.' },
        ],
      },
      {
        slot: 'Day C', type: 'Home', label: 'Dumbbell Full Body + Glute Isolation Burnout', time: '50 min', color: 'var(--amber)',
        solin: "Solin's programme keeps glute isolation in every session - even 10 min of targeted work preserves hypertrophy stimulus.",
        exs: [
          { t: 'Warm-up', d: '5 min', i: 'March in place 1 min, arm circles, leg swings, bodyweight squats 10 reps.' },
          { t: 'Dumbbell deadlift', d: '3x12 - 10 lb DBs', i: 'Both DBs, conventional stance. Full hinge, neutral spine.' },
          { t: 'Bent-over row', d: '3x12 - 5 lb DBs', i: 'Hinge 45 deg, elbows drive back and up. Targets lats and rhomboids.' },
          { t: 'Overhead press', d: '3x10 - 5 lb DBs', i: 'Seated. Press overhead. Control the descent.' },
          { t: 'Bicep to hammer curl', d: '3x10 each - 3 lb DBs', i: 'Standard curl then hammer curl. Light weights, high quality reps.' },
          { t: 'GLUTE BURNOUT (Solin-style) - 3 rounds', d: '90 sec rest between rounds', i: 'These 4 exercises back-to-back, no rest within the round.' },
          { t: '>> Frog pump', d: '30 reps', i: 'Soles together, hips pump up. Glute max from a shortened position.' },
          { t: '>> Donkey kick', d: '15 each - 3 lb DB', i: 'Heel to ceiling, hard squeeze.' },
          { t: '>> Fire hydrant', d: '15 each', i: 'Knee out to hip height. Slow and controlled.' },
          { t: '>> Glute bridge march', d: '20 total', i: 'Hips up, alternate knees to chest. 10 each side.' },
          { t: 'Cool-down', d: '8 min', i: "Pigeon, child's pose, supine spinal twist, box breathing." },
        ],
      },
      {
        slot: 'Day D', type: 'Rest', label: 'Rest Day + Self-Care', time: 'Optional walk only', color: 'var(--muted2)',
        solin: "Solin's guides are explicit: rest in late luteal is not weakness - it's programming. Cortisol + progesterone make overtraining especially harmful here.",
        exs: [
          { t: 'Gentle dog walk', d: '20 min', i: 'Low intensity. NEAT contribution - don\'t skip, but don\'t push.' },
          { t: 'Yin yoga or stretching', d: 'Optional 20 min', i: "Hips, lower back, chest. Search 'yin yoga for PMS' on YouTube." },
          { t: 'Sleep priority', d: 'Tonight', i: 'Progesterone disrupts sleep in the luteal phase. Protect your 8 hours. No screens after 10 PM this week.' },
        ],
      },
    ],
  },
]

// ── Male default full-body 3×/week template ──────────────────────
// Shown to guest (unauthenticated) users. Only Week 1 has pre-filled exercises.
export const MALE_DEFAULT_PLAN: WorkoutWeek[] = [
  {
    week: 1, label: 'Week 1 – Full Body Foundation', color: 'var(--teal)',
    note: 'Establish movement patterns. Focus on form over load. Aim for 7–8 RPE on the main lifts. Rest 90–120 sec between sets.',
    nutr: 'Set calories to your goal (deficit for fat loss, slight surplus for muscle gain). Target 0.8–1 g protein per lb bodyweight.',
    days: [
      {
        slot: 'Day A', type: 'Home', label: 'Full Body A – Squat & Push', time: '50–60 min', color: 'var(--teal)',
        solin: 'Lead with a squat pattern and horizontal push — these two movements recruit the most muscle mass per set.',
        exs: [
          { t: 'Goblet Squat', d: '4×8', i: 'Hold one dumbbell at chest, feet shoulder-width, toes slightly out. Sit deep, drive knees out, stand tall. 3-sec descent, pause 1 sec at bottom.' },
          { t: 'Dumbbell Bench Press', d: '4×8-10', i: 'Lie on floor or bench. Lower until elbows graze the surface, press to full lockout. Full range of motion.' },
          { t: 'Bent-over Row', d: '4×10', i: 'Hinge 45°, grip DBs or barbell, pull elbows back and up. Squeeze shoulder blades together at top.' },
          { t: 'Romanian Deadlift', d: '3×10-12', i: 'Push hips back, maintain neutral spine, feel hamstring stretch, drive hips forward to stand. 3-sec eccentric.' },
          { t: 'Overhead Press', d: '3×8-10', i: 'Press DBs overhead from shoulder height. Control the descent. Keep ribs down, core braced throughout.' },
          { t: 'Plank', d: '3×30-45 sec', i: 'Forearms or straight-arm. Squeeze glutes and quads. Body forms a straight line — no hips sagging or rising.' },
        ],
      },
      {
        slot: 'Day B', type: 'Rest', label: 'Rest / Active Recovery', time: '20–30 min optional', color: 'var(--muted2)',
        solin: 'Active recovery accelerates adaptation. A 20-min walk raises blood flow to muscles without adding training stress.',
        exs: [
          { t: 'Light walk', d: '20 min', i: 'Easy Zone 2 pace — you could hold a full conversation.' },
          { t: 'Mobility work', d: '10 min', i: 'Hip flexors, thoracic spine, shoulder circles. Hold each position 30–60 sec.' },
        ],
      },
      {
        slot: 'Day C', type: 'Home', label: 'Full Body B – Hinge & Pull', time: '50–60 min', color: 'var(--teal)',
        solin: 'Lead with a hip hinge to train the posterior chain when CNS is fresh, then pair vertical pull with a press variation.',
        exs: [
          { t: 'Deadlift', d: '4×5-6', i: 'Conventional stance. Grip just outside legs, push the floor away, lock out hips fully at top. Neutral spine throughout.' },
          { t: 'Single-arm Dumbbell Row', d: '4×10 each', i: 'One hand on bench or chair. Pull elbow back and up, feel full lat engagement. Lower under control.' },
          { t: 'Push-up', d: '3×10-15', i: 'Full push-up if possible, hands on elevated surface to scale. 3-sec descent.' },
          { t: 'Goblet Squat', d: '3×12', i: 'Higher-rep second squat variation for muscle endurance and quad emphasis.' },
          { t: 'Lateral Raise', d: '3×12-15', i: 'Light DBs. Raise to shoulder height, thumb slightly down. 2-sec descent.' },
          { t: 'Dead Bug', d: '3×8 each side', i: 'On back, arms vertical. Lower opposite arm and leg to 2 inches from floor. Lower back stays imprinted the entire time.' },
        ],
      },
      {
        slot: 'Day D', type: 'Rest', label: 'Rest / Stretching', time: 'Optional', color: 'var(--muted2)',
        solin: 'Muscle is built during recovery, not during sets. Protect 7–9 hours of sleep — it is the highest-leverage recovery tool.',
        exs: [
          { t: 'Full-body stretching', d: '15-20 min', i: 'Hip flexors, hamstrings, chest, lats. Hold each 30–60 sec. Focus on areas that feel tight.' },
          { t: 'Box breathing', d: '5 min', i: '4 sec in / 4 hold / 4 out / 4 hold. Lowers cortisol and accelerates nervous system recovery.' },
        ],
      },
    ],
  },
  {
    week: 2, label: 'Week 2 – Progressive Overload', color: 'var(--blue)',
    note: 'Add weight or 1–2 reps to the main lifts from Week 1. Keep form strict — no grinding reps.',
    nutr: 'Maintain protein intake. Adjust calories if energy or recovery feels off.',
    days: [
      { slot: 'Day A', type: 'Home', label: 'Full Body A', time: '50–60 min', color: 'var(--blue)',   solin: 'Increase load by 2–5% from Week 1 Day A. Same movements, more weight.', exs: [] },
      { slot: 'Day B', type: 'Rest', label: 'Rest / Active Recovery', time: '20–30 min', color: 'var(--muted2)', solin: 'Same recovery protocol as Week 1.', exs: [] },
      { slot: 'Day C', type: 'Home', label: 'Full Body B', time: '50–60 min', color: 'var(--blue)',   solin: 'Increase load by 2–5% from Week 1 Day C.', exs: [] },
      { slot: 'Day D', type: 'Rest', label: 'Rest / Stretching', time: 'Optional', color: 'var(--muted2)', solin: 'Prioritise sleep and recovery.', exs: [] },
    ],
  },
  {
    week: 3, label: 'Week 3 – Volume & Intensity', color: 'var(--amber)',
    note: 'Peak week. Push intensity. After this, take a full deload week (50% of normal load) before starting a new block.',
    nutr: 'Higher intensity may increase appetite. Stay on calorie target. Prioritise carbs around workouts this week.',
    days: [
      { slot: 'Day A', type: 'Home', label: 'Full Body A', time: '50–60 min', color: 'var(--amber)', solin: 'Peak effort — aim for RPE 9 on the main lifts. Same movements as Week 2.', exs: [] },
      { slot: 'Day B', type: 'Rest', label: 'Rest / Active Recovery', time: '20–30 min', color: 'var(--muted2)', solin: 'Recovery is programmed — it is not optional.', exs: [] },
      { slot: 'Day C', type: 'Home', label: 'Full Body B', time: '50–60 min', color: 'var(--amber)', solin: 'Peak effort on main lifts. Finish strong.', exs: [] },
      { slot: 'Day D', type: 'Rest', label: 'Rest / Stretching', time: 'Optional', color: 'var(--muted2)', solin: 'Deload next week, or continue if recovering well.', exs: [] },
    ],
  },
]

export const PLAN_NOTES: PlanNote[] = [
  { icon: '📊', title: 'Calorie & Nutrition', color: 'var(--amber)', text: 'Recipes tab targets ~1,380 kcal/day. On luteal phase days with higher hunger, increase to ~1,500 kcal by adding one extra protein serving. Never go below 1,200 kcal - this suppresses thyroid and slows metabolism.' },
  { icon: '💊', title: 'Supplement Timing', color: 'var(--green)', text: 'Creatine (3-5g/day): take consistently, even on rest days - particularly effective for women, improving muscle retention in a caloric deficit. Whey protein: hit 105-115g protein/day from food first. Fish oil (2g/day): reduces DOMS and supports hormonal health.' },
  { icon: '😴', title: 'Sleep & Chronotype', color: 'var(--purple)', text: 'Training at 4:30 PM leverages your physical performance peak as a late chronotype. 7.5-8 hours sleep is non-negotiable: sleep deprivation raises ghrelin by 24% and reduces leptin by 18%, directly undermining your deficit.' },
  { icon: '📏', title: 'Measuring Progress', color: 'var(--teal)', text: 'Weight fluctuates 1-2 kg across your cycle. Track: waist + hip measurements every 2 weeks, progress photos monthly in same lighting, strength benchmarks, energy quality. Scale in Week 3 often reads heavier from water retention - not fat gain.' },
  { icon: '🎯', title: 'Realistic Timeline', color: 'var(--coral)', text: 'At 0.4-0.5 kg/week fat loss: from 35% body fat, reaching ~28-30% takes approximately 12-16 weeks of consistent execution. Lean mass will be more visible, glutes will have grown, and energy should improve significantly.' },
]
