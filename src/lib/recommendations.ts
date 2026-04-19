import type {
  Goal,
  LoggedExercise,
  PlanDay,
  PlanExercise,
  PrimaryGoal,
  Profile,
  WorkoutFocus,
  WorkoutPlan,
} from './types'
import { createId, snapshotFingerprint } from './utils'

const FALLBACK_DAYS = ['Mon', 'Wed', 'Fri']

const GOAL_NAMES: Record<PrimaryGoal, string> = {
  strength: 'strength',
  'body-composition': 'body composition',
  endurance: 'endurance',
  consistency: 'consistency',
}

type FocusBlueprint = {
  focus: WorkoutFocus
  title: string
  intention: string
  recoveryNote: string
}

function sortTrainingDays(days: string[]) {
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return [...days].sort((left, right) => order.indexOf(left) - order.indexOf(right))
}

function getTrainingDays(profile: Profile) {
  const selected = profile.trainingDays.length > 0 ? profile.trainingDays : FALLBACK_DAYS
  return sortTrainingDays(selected)
}

export function getPlanFingerprint(profile: Profile, goals: Goal[]) {
  const activeGoals = goals
    .filter((goal) => goal.status === 'active')
    .map((goal) => ({
      title: goal.title,
      type: goal.type,
      unit: goal.unit,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
    }))

  return snapshotFingerprint({
    profile,
    activeGoals,
  })
}

function resolveSplit(profile: Profile): FocusBlueprint[] {
  const dayCount = Math.max(1, getTrainingDays(profile).length)

  if (dayCount <= 2) {
    return [
      {
        focus: 'full-body',
        title: 'Full body strength',
        intention: 'Keep the week compact but complete with one strong squat, one push, and one pull pattern.',
        recoveryNote: 'Walk for 10 minutes after the session and keep protein high.',
      },
      {
        focus: profile.primaryGoal === 'endurance' ? 'conditioning' : 'full-body',
        title: profile.primaryGoal === 'endurance' ? 'Engine builder' : 'Full body repeat',
        intention:
          profile.primaryGoal === 'endurance'
            ? 'Drive conditioning without wrecking recovery.'
            : 'Repeat the main patterns with slightly lighter intent and cleaner tempo.',
        recoveryNote: 'Keep the second session technically sharp and leave one rep in reserve.',
      },
    ]
  }

  if (dayCount === 3) {
    if (profile.fitnessLevel === 'beginner') {
      return [
        {
          focus: 'full-body',
          title: 'Foundation A',
          intention: 'Build confidence with stable compounds and repeatable movement quality.',
          recoveryNote: 'Finish with easy mobility before leaving the gym.',
        },
        {
          focus: 'full-body',
          title: 'Foundation B',
          intention: 'Reinforce the week with unilateral work and posture-building pulls.',
          recoveryNote: 'Aim for smooth form over maximal effort.',
        },
        {
          focus: profile.primaryGoal === 'endurance' ? 'conditioning' : 'full-body',
          title: profile.primaryGoal === 'endurance' ? 'Aerobic closer' : 'Foundation C',
          intention:
            profile.primaryGoal === 'endurance'
              ? 'Keep the heart rate honest while staying springy for next week.'
              : 'Close the week with a crisp, lower-fatigue session.',
          recoveryNote: 'A short walk and extra hydration will improve tomorrow’s readiness.',
        },
      ]
    }

    return [
      {
        focus: 'upper',
        title: 'Upper push-pull',
        intention: 'Drive pressing and pulling volume while shoulders stay stable.',
        recoveryNote: 'Pair this day with a little thoracic mobility at the end.',
      },
      {
        focus: 'lower',
        title: 'Lower strength',
        intention: 'Own the hinge and squat patterns with steady, repeatable intensity.',
        recoveryNote: 'Respect warm-up sets before the heavy work.',
      },
      {
        focus: profile.primaryGoal === 'endurance' ? 'conditioning' : 'full-body',
        title: profile.primaryGoal === 'endurance' ? 'Conditioning repeat' : 'Full-body reset',
        intention:
          profile.primaryGoal === 'endurance'
            ? 'Raise work capacity without stealing recovery from strength days.'
            : 'Tie the week together with total-body accessories and crisp tempo work.',
        recoveryNote: 'Keep this session moving and stop before technique drifts.',
      },
    ]
  }

  if (dayCount === 4) {
    if (profile.primaryGoal === 'strength') {
      return [
        {
          focus: 'upper',
          title: 'Upper strength',
          intention: 'Lead with crisp presses and rows, then finish with shoulder health work.',
          recoveryNote: 'Keep the heaviest sets technically clean.',
        },
        {
          focus: 'lower',
          title: 'Lower strength',
          intention: 'Anchor the week with stable squats and a strong hinge.',
          recoveryNote: 'Use full rest between big lifts.',
        },
        {
          focus: 'push',
          title: 'Push volume',
          intention: 'Accumulate chest, shoulder, and triceps work without grinding.',
          recoveryNote: 'Keep the bar speed snappy; volume should feel productive, not punishing.',
        },
        {
          focus: 'pull',
          title: 'Pull posture',
          intention: 'Give the back and posterior chain enough attention to balance the week.',
          recoveryNote: 'Finish with easy carries or breathing work.',
        },
      ]
    }

    return [
      {
        focus: 'upper',
        title: 'Upper balance',
        intention: 'Blend pressing and pulling volume for visible upper-body progress.',
        recoveryNote: 'A calm warm-up will sharpen this session fast.',
      },
      {
        focus: 'lower',
        title: 'Lower drive',
        intention: 'Focus on steady legs, glutes, and trunk control with controlled tempo.',
        recoveryNote: 'Stay smooth on the eccentric and keep rest consistent.',
      },
      {
        focus: 'full-body',
        title: 'Total-body density',
        intention: 'Build repeatable weekly momentum with moderate total-body work.',
        recoveryNote: 'Leave the gym feeling better than you arrived.',
      },
      {
        focus: 'conditioning',
        title: 'Engine and recovery',
        intention: 'Support conditioning and consistency without overwhelming the week.',
        recoveryNote: 'Easy cardio is good enough here; save hero efforts for another day.',
      },
    ]
  }

  return [
    {
      focus: 'push',
      title: 'Push power',
      intention: 'Hit pressing volume early while energy is high.',
      recoveryNote: 'Use full range and keep tempo honest.',
    },
    {
      focus: 'pull',
      title: 'Pull power',
      intention: 'Load the back and biceps with posture-first intent.',
      recoveryNote: 'Treat the first row variation as the technical anchor.',
    },
    {
      focus: 'legs',
      title: 'Leg drive',
      intention: 'Build the week around one committed lower-body day.',
      recoveryNote: 'Give the heaviest work real rest.',
    },
    {
      focus: 'upper',
      title: 'Upper rebuild',
      intention: 'Top up shoulders, chest, and upper back without chasing failure.',
      recoveryNote: 'This session should feel polished, not punishing.',
    },
    {
      focus: 'conditioning',
      title: 'Conditioning finish',
      intention: 'Keep work capacity rising so the whole program feels easier to repeat.',
      recoveryNote: 'A nasal-breathing cooldown helps finish the week calmly.',
    },
  ]
}

function compoundSets(profile: Profile) {
  if (profile.primaryGoal === 'strength') {
    return profile.fitnessLevel === 'advanced' ? '5 x 4' : '4 x 5'
  }

  if (profile.primaryGoal === 'endurance') {
    return '3 x 8'
  }

  return profile.fitnessLevel === 'beginner' ? '3 x 8' : '4 x 6'
}

function accessorySets(profile: Profile) {
  if (profile.primaryGoal === 'endurance') {
    return '3 x 15'
  }

  return profile.fitnessLevel === 'advanced' ? '4 x 10' : '3 x 10'
}

function conditioningDose(profile: Profile) {
  if (profile.primaryGoal === 'endurance') {
    return '24 minutes steady'
  }

  return profile.sessionMinutes >= 60 ? '8 rounds / 40s on, 20s off' : '6 rounds / 40s on, 20s off'
}

function createExercise(name: string, setsText: string, intensity: string, cue: string): PlanExercise {
  return {
    id: createId(),
    name,
    setsText,
    intensity,
    cue,
  }
}

function buildStrengthBlock(profile: Profile, names: string[]) {
  const [primary, secondary, tertiary, accessory] = names
  return [
    createExercise(primary, compoundSets(profile), 'RPE 7-8', 'Treat the first working set as the quality benchmark.'),
    createExercise(secondary, compoundSets(profile), 'RPE 7', 'Own the full range before adding load.'),
    createExercise(tertiary, accessorySets(profile), 'Controlled tempo', 'Let the eccentric stay honest.'),
    createExercise(accessory, accessorySets(profile), 'Smooth finish', 'Use this slot to clean up weak links.'),
  ]
}

function buildConditioningBlock(profile: Profile, names: string[]) {
  const [engine, assistance, trunk] = names
  return [
    createExercise(engine, conditioningDose(profile), 'Aerobic build', 'You should finish feeling capable of one more round.'),
    createExercise(assistance, '3 x 12', 'Low fatigue', 'Move continuously but keep positions clean.'),
    createExercise(trunk, '3 x 45s', 'Steady breath', 'Bracing quality matters more than duration.'),
  ]
}

function getExerciseLibrary(profile: Profile, focus: WorkoutFocus): PlanExercise[] {
  const access = profile.equipmentAccess

  if (focus === 'conditioning') {
    if (access === 'full-gym' || access === 'limited-gym') {
      return buildConditioningBlock(profile, ['Rower or bike', 'Sled push', 'Dead bug'])
    }

    if (access === 'dumbbells') {
      return buildConditioningBlock(profile, ['Dumbbell complex', 'Step-up series', 'Side plank'])
    }

    return buildConditioningBlock(profile, ['Brisk incline walk', 'Bodyweight circuit', 'Hollow hold'])
  }

  if (focus === 'recovery') {
    return [
      createExercise('Zone 2 cardio', '20-30 minutes', 'Easy pace', 'Stay conversational throughout.'),
      createExercise('Mobility flow', '12 minutes', 'Unhurried', 'Spend time where you feel stiffest.'),
      createExercise('Farmer carry or suitcase hold', '4 x 30m', 'Crisp posture', 'Walk tall and breathe calmly.'),
    ]
  }

  if (focus === 'full-body') {
    if (access === 'full-gym') {
      return buildStrengthBlock(profile, ['Front squat', 'Bench press', 'Cable row', 'Romanian deadlift'])
    }

    if (access === 'limited-gym') {
      return buildStrengthBlock(profile, ['Goblet squat', 'Machine chest press', 'Seated row', 'Romanian deadlift'])
    }

    if (access === 'dumbbells') {
      return buildStrengthBlock(profile, ['Goblet squat', 'Dumbbell bench press', 'One-arm row', 'Dumbbell Romanian deadlift'])
    }

    return buildStrengthBlock(profile, ['Split squat', 'Push-up', 'Bodyweight row', 'Hip hinge'])
  }

  if (focus === 'upper') {
    if (access === 'bodyweight') {
      return buildStrengthBlock(profile, ['Push-up', 'Bodyweight row', 'Pike press', 'Band pull-apart'])
    }

    if (access === 'dumbbells') {
      return buildStrengthBlock(profile, ['Dumbbell incline press', 'One-arm row', 'Seated shoulder press', 'Rear delt raise'])
    }

    return buildStrengthBlock(profile, ['Bench press', 'Chest-supported row', 'Overhead press', 'Lat pulldown'])
  }

  if (focus === 'lower' || focus === 'legs') {
    if (access === 'bodyweight') {
      return buildStrengthBlock(profile, ['Split squat', 'Hip thrust', 'Reverse lunge', 'Calf raise'])
    }

    if (access === 'dumbbells') {
      return buildStrengthBlock(profile, ['Goblet squat', 'Romanian deadlift', 'Reverse lunge', 'Calf raise'])
    }

    return buildStrengthBlock(profile, ['Back squat', 'Romanian deadlift', 'Walking lunge', 'Leg curl'])
  }

  if (focus === 'push') {
    if (access === 'bodyweight') {
      return buildStrengthBlock(profile, ['Decline push-up', 'Pike press', 'Dips', 'Triceps extension'])
    }

    if (access === 'dumbbells') {
      return buildStrengthBlock(profile, ['Dumbbell bench press', 'Arnold press', 'Incline dumbbell press', 'Overhead triceps extension'])
    }

    return buildStrengthBlock(profile, ['Bench press', 'Incline dumbbell press', 'Overhead press', 'Cable fly'])
  }

  if (access === 'bodyweight') {
    return buildStrengthBlock(profile, ['Bodyweight row', 'Towel row', 'Rear delt raise', 'Hammer curl'])
  }

  if (access === 'dumbbells') {
    return buildStrengthBlock(profile, ['Chest-supported row', 'One-arm row', 'Rear delt fly', 'Hammer curl'])
  }

  return buildStrengthBlock(profile, ['Barbell row', 'Lat pulldown', 'Face pull', 'Hammer curl'])
}

function getGoalCue(goal: PrimaryGoal) {
  if (goal === 'strength') {
    return 'Emphasize technical tension and full rest on the first movement of each day.'
  }

  if (goal === 'endurance') {
    return 'Keep transitions efficient and use breathing control to keep effort sustainable.'
  }

  if (goal === 'body-composition') {
    return 'Use moderate rest and crisp accessory work to drive repeatable weekly volume.'
  }

  return 'Keep every session simple enough that showing up feels automatic.'
}

export function generateWorkoutPlan(profile: Profile, goals: Goal[]): WorkoutPlan {
  const trainingDays = getTrainingDays(profile)
  const split = resolveSplit(profile).slice(0, trainingDays.length)
  const fingerprint = getPlanFingerprint(profile, goals)
  const focusSummary = GOAL_NAMES[profile.primaryGoal]
  const rationale = [
    `Built around ${trainingDays.length} training days and ${profile.sessionMinutes}-minute sessions.`,
    `Your ${profile.fitnessLevel} profile gets a ${focusSummary}-first split that still protects recovery.`,
    `Exercises favor ${profile.equipmentAccess.replace('-', ' ')} access so every day stays realistic.`,
    getGoalCue(profile.primaryGoal),
  ]

  const days: PlanDay[] = split.map((blueprint, index) => ({
    id: createId(),
    day: trainingDays[index] ?? FALLBACK_DAYS[index % FALLBACK_DAYS.length],
    focus: blueprint.title,
    intention: blueprint.intention,
    durationMinutes: profile.sessionMinutes,
    exercises: getExerciseLibrary(profile, blueprint.focus),
    recoveryNote: blueprint.recoveryNote,
  }))

  return {
    id: createId(),
    createdAt: new Date().toISOString(),
    summary: `${trainingDays.length}-day ${focusSummary} plan with ${profile.sessionMinutes}-minute sessions.`,
    rationale,
    generatedFromFingerprint: fingerprint,
    days,
  }
}

export function inferWorkoutFocus(exercises: LoggedExercise[]): WorkoutFocus {
  const combinedNames = exercises.map((exercise) => exercise.name.toLowerCase()).join(' ')

  if (/(squat|deadlift|lunge|leg|hamstring|calf)/.test(combinedNames)) {
    return 'lower'
  }

  if (/(row|pull|lat|curl|rear delt)/.test(combinedNames)) {
    return 'pull'
  }

  if (/(press|push|bench|dip|triceps)/.test(combinedNames)) {
    return 'push'
  }

  if (/(bike|rower|run|carry|circuit)/.test(combinedNames)) {
    return 'conditioning'
  }

  return 'full-body'
}
