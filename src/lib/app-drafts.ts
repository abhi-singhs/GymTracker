import type { GoalType, LoggedExercise, WorkoutFocus } from './types'
import { createId, isoDate } from './utils'

export type GoalDraft = {
  title: string
  type: GoalType
  targetValue: number
  currentValue: number
  unit: string
  deadline: string
  notes: string
}

export type WorkoutDraft = {
  title: string
  focus: WorkoutFocus
  completedOn: string
  durationMinutes: number
  energy: 1 | 2 | 3 | 4 | 5
  notes: string
  exercises: LoggedExercise[]
}

export function createGoalDraft(): GoalDraft {
  return {
    title: '',
    type: 'strength',
    targetValue: 4,
    currentValue: 0,
    unit: 'sessions / week',
    deadline: '',
    notes: '',
  }
}

export function createExerciseDraft(): LoggedExercise {
  return {
    id: createId(),
    name: '',
    sets: 3,
    reps: 8,
    loadKg: 0,
    notes: '',
  }
}

export function createWorkoutDraft(): WorkoutDraft {
  return {
    title: '',
    focus: 'full-body',
    completedOn: isoDate(),
    durationMinutes: 60,
    energy: 3,
    notes: '',
    exercises: [createExerciseDraft()],
  }
}

export function parseNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
