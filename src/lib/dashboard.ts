import type { Goal, WorkoutSession } from './types'
import { clampPercentage, getWeekStart } from './utils'

export function formatVolume(value: number) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 0,
  }).format(value)
}

export function resolveGoalCurrentValue(goal: Goal, latestWeightKg: number | null = null) {
  if (goal.type === 'weight' && latestWeightKg !== null) {
    return latestWeightKg
  }

  return goal.currentValue
}

export function goalProgress(goal: Goal, latestWeightKg: number | null = null) {
  const currentValue = resolveGoalCurrentValue(goal, latestWeightKg)

  if (goal.targetValue <= 0) {
    return 0
  }

  if (goal.type === 'weight') {
    if (currentValue <= 0) {
      return 0
    }

    const smaller = Math.min(currentValue, goal.targetValue)
    const larger = Math.max(currentValue, goal.targetValue)
    return clampPercentage((smaller / larger) * 100)
  }

  return clampPercentage((currentValue / goal.targetValue) * 100)
}

export function getBestLift(workouts: WorkoutSession[]) {
  const champion = workouts
    .flatMap((workout) =>
      workout.exercises.flatMap((exercise) =>
        exercise.sets.map((set) => ({
          exerciseName: exercise.name,
          loadKg: set.loadKg,
        })),
      ),
    )
    .reduce<{ exerciseName: string; loadKg: number } | null>(
      (current, exercise) => {
        if (!current || exercise.loadKg > current.loadKg) {
          return exercise
        }

        return current
      },
      null,
    )

  if (!champion || champion.loadKg <= 0) {
    return 'No weighted lift logged yet'
  }

  return `${champion.exerciseName} · ${champion.loadKg} kg`
}

export function getConsistencyStreak(workouts: WorkoutSession[], trainingDays: string[]) {
  if (workouts.length === 0) {
    return 0
  }

  const threshold = Math.max(1, Math.ceil(Math.max(trainingDays.length, 1) * 0.5))
  const sessionsByWeek = new Map<string, number>()

  workouts.forEach((workout) => {
    const weekKey = getWeekStart(new Date(workout.completedOn)).toISOString().slice(0, 10)
    sessionsByWeek.set(weekKey, (sessionsByWeek.get(weekKey) ?? 0) + 1)
  })

  let streak = 0
  const cursor = getWeekStart(new Date())

  while (true) {
    const key = cursor.toISOString().slice(0, 10)
    const sessions = sessionsByWeek.get(key) ?? 0

    if (sessions < threshold) {
      break
    }

    streak += 1
    cursor.setDate(cursor.getDate() - 7)
  }

  return streak
}

export function getNextTrainingDay(trainingDays: string[]) {
  const ordered = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const selected = trainingDays.length > 0 ? trainingDays : ['Mon', 'Wed', 'Fri']
  const todayIndex = new Date().getDay()

  for (let offset = 0; offset < 7; offset += 1) {
    const weekday = ordered[(todayIndex + offset) % 7]
    const short = weekday.slice(0, 3)

    if (selected.includes(short)) {
      return offset === 0 ? 'Today' : short
    }
  }

  return selected[0]
}

export function workoutHeadline(
  weeklySessions: number,
  trainingDays: string[],
  workouts: WorkoutSession[],
  planNeedsRefresh: boolean,
) {
  if (workouts.length === 0) {
    return 'Start clean with a plan that already fits your week.'
  }

  if (planNeedsRefresh) {
    return 'Your profile changed - refresh the plan before the next session.'
  }

  if (weeklySessions >= Math.max(trainingDays.length, 3)) {
    return 'The week is on pace. Protect the next session with calm execution.'
  }

  return 'Momentum is building. Keep the next session deliberate and easy to repeat.'
}
