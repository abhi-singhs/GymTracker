import type { WorkoutSession } from './types'

export function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `gymtracker-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return 'Not yet'
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  const objectValue = value as Record<string, unknown>
  const keys = Object.keys(objectValue).sort()
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)

  return `{${entries.join(',')}}`
}

export function hashString(value: string) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `fnv-${(hash >>> 0).toString(16)}`
}

export function snapshotFingerprint(value: unknown) {
  return hashString(stableStringify(value))
}

export function getWeekStart(date = new Date()) {
  const result = new Date(date)
  const weekday = result.getDay()
  const delta = weekday === 0 ? -6 : 1 - weekday
  result.setDate(result.getDate() + delta)
  result.setHours(0, 0, 0, 0)
  return result
}

export function isInCurrentWeek(value: string, reference = new Date()) {
  const start = getWeekStart(reference)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  const date = new Date(value)
  return date >= start && date < end
}

export function workoutVolume(workout: WorkoutSession) {
  return workout.exercises.reduce(
    (total, exercise) => total + exercise.sets * exercise.reps * exercise.loadKg,
    0,
  )
}

export function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value))
}

export function titleCase(value: string) {
  return value
    .split('-')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}
