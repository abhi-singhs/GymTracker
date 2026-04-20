import type {
  GoalType,
  LoggedExercise,
  LoggedSet,
  LoggedSetKind,
  WeightEntry,
  WorkoutFocus,
} from './types'
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

export type WeightDraft = {
  recordedOn: string
  weightKg: number
  notes: string
}

export const WORKOUT_SET_KIND_ORDER: LoggedSetKind[] = ['working', 'warmup', 'drop', 'failure']

export function getDefaultGoalUnit(type: GoalType) {
  return type === 'weight' ? 'kg' : 'sessions / week'
}

export function createGoalDraft(): GoalDraft {
  return {
    title: '',
    type: 'strength',
    targetValue: 4,
    currentValue: 0,
    unit: getDefaultGoalUnit('strength'),
    deadline: '',
    notes: '',
  }
}

export function createExerciseSetDraft(overrides: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: createId(),
    kind: 'working',
    reps: 0,
    loadKg: 0,
    completed: false,
    ...overrides,
  }
}

export function createExerciseDraft(): LoggedExercise {
  return {
    id: createId(),
    name: '',
    notes: '',
    sets: [createExerciseSetDraft()],
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

export function createWeightDraft(): WeightDraft {
  return {
    recordedOn: isoDate(),
    weightKg: 0,
    notes: '',
  }
}

export function createWeightEntryDraft(weightDraft: WeightDraft): WeightEntry {
  return {
    id: createId(),
    recordedOn: weightDraft.recordedOn,
    weightKg: weightDraft.weightKg,
    notes: weightDraft.notes.trim(),
  }
}

export function parseNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function getNextWorkoutSetKind(kind: LoggedSetKind) {
  const index = WORKOUT_SET_KIND_ORDER.indexOf(kind)
  return WORKOUT_SET_KIND_ORDER[(index + 1) % WORKOUT_SET_KIND_ORDER.length]
}
