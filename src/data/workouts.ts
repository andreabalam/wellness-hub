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
  /** Option B: an alternative session for the same slot (logged as this day) */
  altLabel?: string
  alts?: Exercise[]
  /** Session type when Option B is logged (e.g. 'Pilates'); defaults to `type` */
  altType?: string
}

export interface WorkoutWeek {
  week: number
  label: string
  color: string
  note: string
  nutr: string
  days: WorkoutDay[]
  /** plan version (WORKOUT_PLAN_VERSION); absent on plans saved before v2 */
  v?: number
}

export interface PlanNote {
  icon: string
  title: string
  color: string
  text: string
}

/**
 * Bump when WORKOUT_PLAN changes shape or content. A stored (synced) plan whose
 * weeks don't carry this version is treated as outdated and the built-in plan
 * is shown instead — so a new release actually reaches signed-in users.
 */
export const WORKOUT_PLAN_VERSION = 3

// ── Cycle-synced plan builders ───────────────────────────────────
// A 6-workout rotation, followed in order from where you left off (not by
// weekday): 2 lower, 2 upper, 1 full body, 1 conditioning; Days 5 and 6 have
// Pilates as Option B. Same structure every week; each cycle phase only adjusts sets,
// conditioning intensity and the swap options. Research (Colenso-Semple 2023,
// McNulty 2020) finds no reliable phase effect on strength or hypertrophy, so
// the plan trains all month and adjusts by symptoms rather than switching
// programmes.

const ex = (t: string, d: string, i: string): Exercise => ({ t, d, i })

interface PhaseDose {
  /** sets on the first (main) lift of each strength day (Days 1-4) */
  main: number
  /** added to every other set count (-1 in the maintain week) */
  acc: number
  /** cue appended to the main lifts */
  cue: string
  /** extra warm-up minutes before the strength days */
  warmup: string
}

const sets = (base: number, p: PhaseDose) => Math.max(2, base + p.acc)

const PILATES_B: Exercise[] = [
  ex(
    'Supine breathing',
    '2 min',
    'Knees bent, feet flat. Breathe into the sides and back of the ribs; let the belly soften.',
  ),
  ex(
    'Pelvic curl',
    '8 reps',
    'Peel the spine up one vertebra at a time into a bridge, then roll down the same way.',
  ),
  ex(
    'Supine knee drops',
    '10 per side',
    'Knees together, let them fall slowly to one side and back. Shoulders stay down.',
  ),
  ex(
    'Single-leg circles',
    '5 each direction per leg',
    'Small and slow. Pelvis stays completely still; circle from the hip socket.',
  ),
  ex(
    'Clamshells',
    '2×15 per side',
    'Loop band above knees optional. Hips stacked, top knee opens without rolling back.',
  ),
  ex(
    'Bird-dog',
    '2×8 per side, 2s hold',
    'All fours. Reach opposite arm and leg long, hold, return without shifting the hips.',
  ),
  ex(
    'Rolling like a ball',
    '8 reps',
    'Hug the shins and rock back to the shoulder blades and up. Or just rock gently hugging the knees.',
  ),
  ex(
    'Mermaid side stretch',
    '4 per side',
    'Seated with legs to one side, reach the opposite arm overhead and breathe into the side of the ribs.',
  ),
  ex("Child's pose to cat-cow flow", '3 min', 'Flow slowly between the two to finish.'),
]

function day1(p: PhaseDose, color: string): WorkoutDay {
  return {
    slot: 'Day 1',
    type: 'Home',
    label: 'Lower A - Glutes & Hamstrings',
    time: '45-50 min',
    color,
    solin: `Main lift ${p.main} sets. ${p.cue}`,
    exs: [
      ex(
        'Warm-up',
        p.warmup,
        'Banded glute bridges 2×20, then 10 bodyweight good mornings and 10 leg swings per side.',
      ),
      ex(
        'Single-leg hip thrust',
        `${p.main}×10-12 per side`,
        'Upper back on the couch, 15 lb DB on the working hip. Drive through the heel, pause 2s at the top. Start with the right leg and match those reps on the left.',
      ),
      ex(
        'Single-leg RDL (15 lb)',
        `${sets(3, p)}×10 per side, 3s down`,
        'Soft knee, hinge from the hip, DB in the opposite hand. Stop when you feel the hamstring stretch; squeeze the glute to stand.',
      ),
      ex(
        'B-stance hip thrust',
        `${sets(3, p)}×15 per side`,
        'Loop band above knees. Working foot flat, the other heel lifted slightly forward as a kickstand. Push the knees out against the band.',
      ),
      ex(
        'Sliding hamstring curls',
        `${sets(3, p)}×10-12, 3s slide-out`,
        'Heels on a towel or in socks on a hard floor. Bridge up, slide heels out until legs are nearly straight, pull back in with hips up. On carpet or a mat: single-leg glute bridge walkouts 3×8-10.',
      ),
      ex(
        'OR loop-band lying hamstring curl',
        `${sets(3, p)}×15-20 per side, 2s pause at top`,
        'Face down, loop band around both ankles. Pin one leg to the mat and curl the other heel toward your butt.',
      ),
      ex(
        'Frog pumps',
        '2×max',
        'On your back, soles together, knees wide. Pump the hips up, squeeze hard at the top.',
      ),
    ],
  }
}

function lowerQuads(p: PhaseDose, color: string): WorkoutDay {
  return {
    slot: 'Day 3',
    type: 'Home',
    label: 'Lower B - Glutes & Quads',
    time: '45-50 min',
    color,
    solin: `Main lift ${p.main} sets. ${p.cue}`,
    exs: [
      ex(
        'Warm-up',
        p.warmup,
        'Bodyweight squats 15, banded lateral walks 10 each way, 5 reverse lunges per side.',
      ),
      ex(
        'Bulgarian split squat (2×15 lb)',
        `${p.main}×8-12 per side, 3s down`,
        'Back foot on the couch. Lean the torso slightly forward for more glute. Right leg first, match on the left.',
      ),
      ex(
        'Goblet squat, 2s pause at bottom',
        `${sets(3, p)}×12-15`,
        'Hold one DB at the chest. Sit between the heels, pause, drive up.',
      ),
      ex(
        'Deficit reverse lunge',
        `${sets(3, p)}×10 per side`,
        'Front foot on a book or low step. Step back into a deep lunge, keep weight in the front heel.',
      ),
      ex(
        'Lateral lunge',
        `${sets(3, p)}×10 per side`,
        'Step wide, sit back into the stepping hip, the other leg stays straight.',
      ),
      ex(
        'Banded lateral walks',
        `${sets(3, p)}×15 steps each way`,
        "Loop band above knees or at ankles. Stay low, toes forward, don't let the feet touch.",
      ),
    ],
  }
}

function upperPush(p: PhaseDose, color: string): WorkoutDay {
  return {
    slot: 'Day 2',
    type: 'Home',
    label: 'Upper A - Push (chest, shoulders, triceps)',
    time: '40-45 min',
    color,
    solin: `Push-ups ${p.main} sets. ${p.cue} Progress push-ups by lowering the incline, then a 3s descent.`,
    exs: [
      ex(
        'Warm-up',
        p.warmup,
        'Arm circles 30s each way, band pull-aparts 2×15, 10 scap push-ups (arms straight, squeeze and spread the shoulder blades).',
      ),
      ex(
        'Push-ups',
        `${p.main}×AMRAP`,
        'Stop 1-2 reps before failure. Hands on the couch or counter if needed; lower the incline as you get stronger, then slow the way down to 3s.',
      ),
      ex(
        'DB floor press (2×15 lb)',
        `${sets(3, p)}×12-15, 3s down`,
        'On your back, knees bent, elbows at about 45°. Lower until the upper arms touch the floor, pause, press.',
      ),
      ex(
        'Seated DB shoulder press',
        `${sets(3, p)}×10-12`,
        'Ribs down, press overhead, control the way down.',
      ),
      ex(
        'One-arm DB row',
        `${sets(3, p)}×10-12 per side`,
        'Balances the pushing. Hand and knee on the couch; pull the elbow toward the hip, pause, lower slowly.',
      ),
      ex(
        'Lateral raises',
        `${sets(3, p)}×12-15`,
        'Lead with the elbows, stop at shoulder height, 2s down.',
      ),
      ex(
        'Overhead DB triceps extension',
        `${sets(3, p)}×12-15`,
        'One DB held with both hands behind the head. Elbows point forward and stay close; extend fully.',
      ),
      ex(
        'OR couch triceps dips',
        `${sets(3, p)}×10-15`,
        'Hands on the couch edge, knees bent. Lower until the elbows reach 90°, shoulders away from the ears.',
      ),
      ex(
        'Plank shoulder taps',
        `${sets(3, p)}×20 taps`,
        'High plank, feet wide. Tap the opposite shoulder without letting the hips rock.',
      ),
    ],
  }
}

function upperPull(p: PhaseDose, color: string): WorkoutDay {
  return {
    slot: 'Day 4',
    type: 'Home',
    label: 'Upper B - Pull (back, rear shoulders, biceps) + Core',
    time: '40-45 min',
    color,
    solin: `Main row ${p.main} sets. ${p.cue} A strong back is what makes the upper body look and feel toned.`,
    exs: [
      ex(
        'Warm-up',
        p.warmup,
        'Cat-cow 1 min, band pull-aparts 2×15, 10 slow DB rows per side with the lightest weight.',
      ),
      ex(
        'One-arm DB row, 2s pause',
        `${p.main}×10-12 per side`,
        'Hand and knee on the couch. Pull the elbow toward the hip, hold 2s at the top, 3s down.',
      ),
      ex(
        'Bent-over two-DB row',
        `${sets(3, p)}×12-15`,
        'Hinge to about 45°, back flat. Row both DBs to the lower ribs, squeeze the shoulder blades together.',
      ),
      ex(
        'DB pullover',
        `${sets(3, p)}×12`,
        'Lying on the floor or across the couch, one DB held over the chest with both hands. Lower it behind the head with slightly bent arms, pull back over the chest with the lats.',
      ),
      ex(
        'Band face pulls',
        `${sets(3, p)}×15-20`,
        'Long band anchored at face height (door hinge or a post). Pull toward the eyes, elbows high, ending in a "double biceps" pose.',
      ),
      ex(
        'OR bent-over DB reverse flys',
        `${sets(3, p)}×12-15, 1s squeeze`,
        'Light DBs, arms slightly bent. Lift out to the sides by squeezing the shoulder blades.',
      ),
      ex(
        'DB curls, 3s down',
        `${sets(3, p)}×10-12`,
        'Elbows pinned to the sides. Curl up, lower slowly. Alternate with a hammer grip each week.',
      ),
      ex(
        'Dead bug + side plank',
        `${sets(3, p)}×10 per side + ${sets(2, p)}×30s per side`,
        'Dead bug: lower back stays pressed to the floor. Side plank: hips high, knees down to make it easier.',
      ),
    ],
  }
}

const PILATES_A: Exercise[] = [
  ex('Pelvic curl', '8 reps', 'Slow bridge, peeling the spine up and down one vertebra at a time.'),
  ex(
    'The Hundred',
    '100 pumps',
    'Head and shoulders up, arms pumping. Breathe in 5 pumps, out 5. Bend knees to tabletop if the lower back lifts.',
  ),
  ex(
    'Single-leg stretch',
    '10 per side',
    'Head up, pull one knee in while the other leg extends long. Switch with control.',
  ),
  ex(
    'Criss-cross',
    '10 per side, slow',
    'Rotate the ribs toward the bent knee, hold 1s each side. Elbows stay wide.',
  ),
  ex(
    'Side-lying series (loop band above knees)',
    '10-15 each move per side',
    'Leg lifts, front/back kicks, clamshells, small circles. Hips stacked, waist lifted off the mat.',
  ),
  ex(
    'Single-leg kicks (prone)',
    '8 per side',
    'On your forearms, chest lifted. Kick one heel to your butt twice, switch.',
  ),
  ex(
    'Swan prep',
    '8 reps',
    'Face down, hands under shoulders. Small back extension using the back muscles, not the arms.',
  ),
  ex(
    'Kneeling side kicks',
    '10 per side',
    'One hand and knee down, top leg at hip height. Kick forward and back without the torso moving.',
  ),
  ex(
    'Teaser prep',
    '5 reps, 3s hold',
    'Bent knees, roll up to a V and hold. Roll down with control.',
  ),
  ex(
    'Spine stretch forward + saw',
    '5 each',
    'Seated, legs wide. Round forward over the legs, then twist and reach toward the opposite foot.',
  ),
]

function fullBody(p: PhaseDose, color: string): WorkoutDay {
  return {
    slot: 'Day 5',
    type: 'Home',
    label: 'Full Body - Strength Supersets',
    time: '40-45 min',
    color,
    solin:
      'Pairs of upper + lower moves back to back, 60-90s rest after each pair. More muscle worked in less time - the most efficient session for recomposition.',
    exs: [
      ex(
        'Warm-up',
        p.warmup,
        '5 inchworms (walk the hands out to a plank and back), 15 bodyweight squats, band pull-aparts 15.',
      ),
      ex(
        'A1 Goblet squat',
        `${sets(3, p)}×12`,
        'One DB at the chest. Sit between the heels, drive up. Go straight into A2.',
      ),
      ex('A2 Push-ups', `${sets(3, p)}×8-12`, 'Same incline as on Day 2, or one step easier.'),
      ex(
        'B1 DB Romanian deadlift (2×15 lb)',
        `${sets(3, p)}×12, 3s down`,
        'Soft knees, push the hips back until you feel the hamstrings, squeeze the glutes to stand.',
      ),
      ex(
        'B2 Bent-over two-DB row',
        `${sets(3, p)}×12`,
        'Stay hinged from B1 if your back is happy; otherwise stand up between the moves.',
      ),
      ex(
        'C1 Reverse lunge',
        `${sets(3, p)}×10 per side`,
        'DBs at your sides. Step back, front shin vertical, push through the front heel.',
      ),
      ex(
        'C2 Arnold press',
        `${sets(3, p)}×10`,
        'Start with palms facing you at chin height, rotate them forward as you press overhead.',
      ),
      ex(
        'Finisher: renegade rows',
        `${sets(2, p)}×6 per side`,
        'High plank on the DBs, feet wide. Row one DB without twisting the hips.',
      ),
    ],
    altLabel: 'Option B: Pilates A - Glutes & Core (~40 min)',
    altType: 'Pilates',
    alts: PILATES_A,
  }
}

function conditioning(rounds: string, work: string, color: string): WorkoutDay {
  return {
    slot: 'Day 6',
    type: 'Home',
    label: 'Conditioning + Core',
    time: '30-35 min',
    color,
    solin: `${rounds} rounds, ${work}. Keeps the heart rate up for fat loss while the upper body keeps working.`,
    exs: [
      ex(
        'Conditioning circuit',
        `${rounds} rounds, ${work}`,
        'DB thruster, renegade row, push-up, DB swing, mountain climbers back-to-back. Rest 60s between rounds.',
      ),
      ex(
        'Banded hip thrust, 1.5 reps',
        '2×15',
        'Go halfway back down and up again before finishing each rep. Band above knees.',
      ),
      ex(
        'Core trio',
        '2 rounds',
        'Hollow hold 20-30s (knees bent to make it easier), bird-dog 8 per side, side plank 20s per side.',
      ),
    ],
    altLabel: 'Option B: Pilates B - Restorative (~30 min)',
    altType: 'Pilates',
    alts: PILATES_B,
  }
}

function buildWeek(
  week: number,
  label: string,
  color: string,
  note: string,
  nutr: string,
  p: PhaseDose,
  d6: { rounds: string; work: string },
): WorkoutWeek {
  return {
    week,
    label,
    color,
    note,
    nutr,
    v: WORKOUT_PLAN_VERSION,
    days: [
      day1(p, color),
      upperPush(p, color),
      lowerQuads(p, color),
      upperPull(p, color),
      fullBody(p, color),
      conditioning(d6.rounds, d6.work, color),
    ],
  }
}

export const WORKOUT_PLAN: WorkoutWeek[] = [
  buildWeek(
    1,
    'Week 1 - Menstrual (about cycle days 1-5)',
    'var(--purple)',
    'Train as normal if you feel fine - movement tends to ease cramps. On rough days drop 1 set from each exercise and keep the weights the same, or pick Option B (Pilates) on Days 5 and 6. A walk and a heat pack help too.',
    'Stick to ~1,380 kcal. Magnesium-rich foods (dark chocolate, walnuts, spinach) help this week. For iron, have heme iron (red meat, poultry, fish) with a vitamin C source, and keep tea and coffee away from meals.',
    { main: 4, acc: 0, cue: 'Normal sets; drop one per exercise on rough days.', warmup: '5 min' },
    { rounds: '4', work: '40s on / 20s off' },
  ),
  buildWeek(
    2,
    'Week 2 - Follicular (about cycle days 6-13)',
    'var(--green)',
    'The push week. Add 1 set to the first lift of each strength day (Days 1-4), aim for the top of every rep range, and try your hardest progressions: slower tempo, 1.5 reps, a lower push-up incline. Conditioning at full intensity.',
    "Hit ~1,380 kcal with protein at every meal. Don't undereat on the harder training days.",
    { main: 5, acc: 0, cue: 'Push: top of the rep range, hardest progression.', warmup: '5 min' },
    { rounds: '5', work: '40s on / 20s off' },
  ),
  buildWeek(
    3,
    'Week 3 - Ovulation to early luteal (about cycle days 14-21)',
    'var(--amber)',
    "Keep Week 2's weights, sets and reps - no new jumps in difficulty. Spend 2-3 extra minutes warming up and keep knees tracking over toes on lunges and squats.",
    'Energy needs rise slightly. Allow ~1,500 kcal on the lower-body days (Days 1 and 3) by adding a protein serving.',
    { main: 5, acc: 0, cue: 'Hold Week 2 loads; extra warm-up.', warmup: '8 min' },
    { rounds: '4', work: '40s on / 20s off' },
  ),
  buildWeek(
    4,
    'Week 4 - Late luteal (about cycle days 22-28)',
    'var(--coral)',
    'The maintain week. Same weights, 1 set fewer on everything - a built-in light week. Conditioning drops to 3 rounds of 30s on / 30s off, and Option B (Pilates) is a good pick on low-energy days. Hard cardio feels harder now because body temperature runs a bit higher.',
    'Hunger often rises: go up to ~1,500 kcal with an extra protein serving rather than fighting it. Drink more water. Scale weight often reads higher this week from water - not fat.',
    { main: 3, acc: -1, cue: 'Same weights, one set fewer.', warmup: '5 min' },
    { rounds: '3', work: '30s on / 30s off' },
  ),
]

// ── Male default full-body 3×/week template ──────────────────────
// Shown to guest (unauthenticated) users. Only Week 1 has pre-filled exercises.
export const MALE_DEFAULT_PLAN: WorkoutWeek[] = [
  {
    week: 1,
    label: 'Week 1 – Full Body Foundation',
    color: 'var(--teal)',
    note: 'Establish movement patterns. Focus on form over load. Aim for 7–8 RPE on the main lifts. Rest 90–120 sec between sets.',
    nutr: 'Set calories to your goal (deficit for fat loss, slight surplus for muscle gain). Target 0.8–1 g protein per lb bodyweight.',
    days: [
      {
        slot: 'Day A',
        type: 'Home',
        label: 'Full Body A – Squat & Push',
        time: '50–60 min',
        color: 'var(--teal)',
        solin:
          'Lead with a squat pattern and horizontal push — these two movements recruit the most muscle mass per set.',
        exs: [
          {
            t: 'Goblet Squat',
            d: '4×8',
            i: 'Hold one dumbbell at chest, feet shoulder-width, toes slightly out. Sit deep, drive knees out, stand tall. 3-sec descent, pause 1 sec at bottom.',
          },
          {
            t: 'Dumbbell Bench Press',
            d: '4×8-10',
            i: 'Lie on floor or bench. Lower until elbows graze the surface, press to full lockout. Full range of motion.',
          },
          {
            t: 'Bent-over Row',
            d: '4×10',
            i: 'Hinge 45°, grip DBs or barbell, pull elbows back and up. Squeeze shoulder blades together at top.',
          },
          {
            t: 'Romanian Deadlift',
            d: '3×10-12',
            i: 'Push hips back, maintain neutral spine, feel hamstring stretch, drive hips forward to stand. 3-sec eccentric.',
          },
          {
            t: 'Overhead Press',
            d: '3×8-10',
            i: 'Press DBs overhead from shoulder height. Control the descent. Keep ribs down, core braced throughout.',
          },
          {
            t: 'Plank',
            d: '3×30-45 sec',
            i: 'Forearms or straight-arm. Squeeze glutes and quads. Body forms a straight line — no hips sagging or rising.',
          },
        ],
      },
      {
        slot: 'Day B',
        type: 'Rest',
        label: 'Rest / Active Recovery',
        time: '20–30 min optional',
        color: 'var(--muted2)',
        solin:
          'Active recovery accelerates adaptation. A 20-min walk raises blood flow to muscles without adding training stress.',
        exs: [
          {
            t: 'Light walk',
            d: '20 min',
            i: 'Easy Zone 2 pace — you could hold a full conversation.',
          },
          {
            t: 'Mobility work',
            d: '10 min',
            i: 'Hip flexors, thoracic spine, shoulder circles. Hold each position 30–60 sec.',
          },
        ],
      },
      {
        slot: 'Day C',
        type: 'Home',
        label: 'Full Body B – Hinge & Pull',
        time: '50–60 min',
        color: 'var(--teal)',
        solin:
          'Lead with a hip hinge to train the posterior chain when CNS is fresh, then pair vertical pull with a press variation.',
        exs: [
          {
            t: 'Deadlift',
            d: '4×5-6',
            i: 'Conventional stance. Grip just outside legs, push the floor away, lock out hips fully at top. Neutral spine throughout.',
          },
          {
            t: 'Single-arm Dumbbell Row',
            d: '4×10 each',
            i: 'One hand on bench or chair. Pull elbow back and up, feel full lat engagement. Lower under control.',
          },
          {
            t: 'Push-up',
            d: '3×10-15',
            i: 'Full push-up if possible, hands on elevated surface to scale. 3-sec descent.',
          },
          {
            t: 'Goblet Squat',
            d: '3×12',
            i: 'Higher-rep second squat variation for muscle endurance and quad emphasis.',
          },
          {
            t: 'Lateral Raise',
            d: '3×12-15',
            i: 'Light DBs. Raise to shoulder height, thumb slightly down. 2-sec descent.',
          },
          {
            t: 'Dead Bug',
            d: '3×8 each side',
            i: 'On back, arms vertical. Lower opposite arm and leg to 2 inches from floor. Lower back stays imprinted the entire time.',
          },
        ],
      },
      {
        slot: 'Day D',
        type: 'Rest',
        label: 'Rest / Stretching',
        time: 'Optional',
        color: 'var(--muted2)',
        solin:
          'Muscle is built during recovery, not during sets. Protect 7–9 hours of sleep — it is the highest-leverage recovery tool.',
        exs: [
          {
            t: 'Full-body stretching',
            d: '15-20 min',
            i: 'Hip flexors, hamstrings, chest, lats. Hold each 30–60 sec. Focus on areas that feel tight.',
          },
          {
            t: 'Box breathing',
            d: '5 min',
            i: '4 sec in / 4 hold / 4 out / 4 hold. Lowers cortisol and accelerates nervous system recovery.',
          },
        ],
      },
    ],
  },
  {
    week: 2,
    label: 'Week 2 – Progressive Overload',
    color: 'var(--blue)',
    note: 'Add weight or 1–2 reps to the main lifts from Week 1. Keep form strict — no grinding reps.',
    nutr: 'Maintain protein intake. Adjust calories if energy or recovery feels off.',
    days: [
      {
        slot: 'Day A',
        type: 'Home',
        label: 'Full Body A',
        time: '50–60 min',
        color: 'var(--blue)',
        solin: 'Increase load by 2–5% from Week 1 Day A. Same movements, more weight.',
        exs: [],
      },
      {
        slot: 'Day B',
        type: 'Rest',
        label: 'Rest / Active Recovery',
        time: '20–30 min',
        color: 'var(--muted2)',
        solin: 'Same recovery protocol as Week 1.',
        exs: [],
      },
      {
        slot: 'Day C',
        type: 'Home',
        label: 'Full Body B',
        time: '50–60 min',
        color: 'var(--blue)',
        solin: 'Increase load by 2–5% from Week 1 Day C.',
        exs: [],
      },
      {
        slot: 'Day D',
        type: 'Rest',
        label: 'Rest / Stretching',
        time: 'Optional',
        color: 'var(--muted2)',
        solin: 'Prioritise sleep and recovery.',
        exs: [],
      },
    ],
  },
  {
    week: 3,
    label: 'Week 3 – Volume & Intensity',
    color: 'var(--amber)',
    note: 'Peak week. Push intensity. After this, take a full deload week (50% of normal load) before starting a new block.',
    nutr: 'Higher intensity may increase appetite. Stay on calorie target. Prioritise carbs around workouts this week.',
    days: [
      {
        slot: 'Day A',
        type: 'Home',
        label: 'Full Body A',
        time: '50–60 min',
        color: 'var(--amber)',
        solin: 'Peak effort — aim for RPE 9 on the main lifts. Same movements as Week 2.',
        exs: [],
      },
      {
        slot: 'Day B',
        type: 'Rest',
        label: 'Rest / Active Recovery',
        time: '20–30 min',
        color: 'var(--muted2)',
        solin: 'Recovery is programmed — it is not optional.',
        exs: [],
      },
      {
        slot: 'Day C',
        type: 'Home',
        label: 'Full Body B',
        time: '50–60 min',
        color: 'var(--amber)',
        solin: 'Peak effort on main lifts. Finish strong.',
        exs: [],
      },
      {
        slot: 'Day D',
        type: 'Rest',
        label: 'Rest / Stretching',
        time: 'Optional',
        color: 'var(--muted2)',
        solin: 'Deload next week, or continue if recovering well.',
        exs: [],
      },
    ],
  },
]

export const PLAN_NOTES: PlanNote[] = [
  {
    icon: '📊',
    title: 'Calorie & Nutrition',
    color: 'var(--amber)',
    text: 'Recipes tab targets ~1,380 kcal/day. On luteal phase days with higher hunger, increase to ~1,500 kcal by adding one extra protein serving. Never go below 1,200 kcal - this suppresses thyroid and slows metabolism.',
  },
  {
    icon: '💊',
    title: 'Supplement Timing',
    color: 'var(--green)',
    text: 'Creatine (3-5g/day): take consistently, even on rest days - particularly effective for women, improving muscle retention in a caloric deficit. Whey protein: hit 105-115g protein/day from food first. Fish oil (2g/day): reduces DOMS and supports hormonal health.',
  },
  {
    icon: '😴',
    title: 'Sleep & Chronotype',
    color: 'var(--purple)',
    text: 'Training at 4:30 PM leverages your physical performance peak as a late chronotype. 7.5-8 hours sleep is non-negotiable: sleep deprivation raises ghrelin by 24% and reduces leptin by 18%, directly undermining your deficit.',
  },
  {
    icon: '📏',
    title: 'Measuring Progress',
    color: 'var(--teal)',
    text: 'Weight fluctuates 1-2 kg across your cycle. Track: waist + hip measurements every 2 weeks, progress photos monthly in same lighting, strength benchmarks, energy quality. Scale in Week 4 (late luteal) often reads heavier from water retention - not fat gain.',
  },
  {
    icon: '🎯',
    title: 'Realistic Timeline',
    color: 'var(--coral)',
    text: 'At 0.4-0.5 kg/week fat loss: from 35% body fat, reaching ~28-30% takes approximately 12-16 weeks of consistent execution. Lean mass will be more visible, glutes will have grown, and energy should improve significantly.',
  },
  {
    icon: '🔬',
    title: 'Why the plan barely changes by phase',
    color: 'var(--purple)',
    text: 'Current reviews (Colenso-Semple 2023, McNulty 2020) find no reliable effect of cycle phase on strength or muscle growth - consistent training all month wins. What is supported: exercise eases period pain, body temperature runs higher in the luteal phase so hard cardio feels tougher, and hunger often rises before your period. So the structure stays the same and only sets, conditioning and swaps change. On hormonal birth control, follow Week 2 settings and adjust by how you feel.',
  },
]
