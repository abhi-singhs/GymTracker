import type { WeightEntry, WorkoutSession } from './types'
import { formatDisplayDate, getWeekStart, titleCase, workoutVolume } from './utils'

export interface HistoryPoint {
  label: string
  value: number
  helper?: string
}

export interface WeightHistoryPoint {
  id: string
  label: string
  date: string
  weightKg: number
  bmi: number | null
}

export function calculateBmi(weightKg: number, heightCm: number) {
  if (weightKg <= 0 || heightCm <= 0) {
    return null
  }

  const heightMeters = heightCm / 100
  return weightKg / (heightMeters * heightMeters)
}

export function getLatestWeightEntry(weightEntries: WeightEntry[]) {
  return [...weightEntries].sort((left, right) => right.recordedOn.localeCompare(left.recordedOn))[0] ?? null
}

export function buildWorkoutVolumeTrend(
  workouts: WorkoutSession[],
  bucketCount = 8,
  referenceDate = new Date(),
): HistoryPoint[] {
  const currentWeekStart = getWeekStart(referenceDate)

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(currentWeekStart)
    bucketStart.setDate(currentWeekStart.getDate() - (bucketCount - index - 1) * 7)
    const bucketKey = bucketStart.toISOString().slice(0, 10)
    const bucketEnd = new Date(bucketStart)
    bucketEnd.setDate(bucketStart.getDate() + 7)
    const bucketWorkouts = workouts.filter((workout) => {
      const completed = new Date(workout.completedOn)
      return completed >= bucketStart && completed < bucketEnd
    })

    return {
      label: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(bucketStart),
      helper: bucketKey,
      value: bucketWorkouts.reduce((total, workout) => total + workoutVolume(workout), 0),
    }
  })
}

export function buildWorkoutSessionTrend(
  workouts: WorkoutSession[],
  bucketCount = 8,
  referenceDate = new Date(),
): HistoryPoint[] {
  const currentWeekStart = getWeekStart(referenceDate)

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(currentWeekStart)
    bucketStart.setDate(currentWeekStart.getDate() - (bucketCount - index - 1) * 7)
    const bucketEnd = new Date(bucketStart)
    bucketEnd.setDate(bucketStart.getDate() + 7)
    const bucketWorkouts = workouts.filter((workout) => {
      const completed = new Date(workout.completedOn)
      return completed >= bucketStart && completed < bucketEnd
    })

    return {
      label: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(bucketStart),
      value: bucketWorkouts.length,
    }
  })
}

export function buildWorkoutFocusBreakdown(workouts: WorkoutSession[]) {
  const counts = new Map<string, number>()

  workouts.forEach((workout) => {
    counts.set(workout.focus, (counts.get(workout.focus) ?? 0) + 1)
  })

  return [...counts.entries()]
    .map(([focus, count]) => ({
      label: titleCase(focus),
      value: count,
    }))
    .sort((left, right) => right.value - left.value)
}

export function buildWeightHistory(weightEntries: WeightEntry[], heightCm: number): WeightHistoryPoint[] {
  return [...weightEntries]
    .sort((left, right) => left.recordedOn.localeCompare(right.recordedOn))
    .map((entry) => ({
      id: entry.id,
      label: formatDisplayDate(entry.recordedOn),
      date: entry.recordedOn,
      weightKg: entry.weightKg,
      bmi: calculateBmi(entry.weightKg, heightCm),
    }))
}

export function getAverageWorkoutEnergy(workouts: WorkoutSession[]) {
  if (workouts.length === 0) {
    return 0
  }

  return workouts.reduce((total, workout) => total + workout.energy, 0) / workouts.length
}
