import { describe, expect, it } from 'vitest'
import {
  buildWeightHistory,
  buildWorkoutSessionTrend,
  buildWorkoutVolumeTrend,
  calculateBmi,
  getLatestWeightEntry,
} from './history'
import type { WeightEntry, WorkoutSession } from './types'

const workouts: WorkoutSession[] = [
  {
    id: 'workout-1',
    title: 'Push',
    focus: 'push',
    completedOn: '2026-04-07',
    durationMinutes: 60,
    energy: 4,
    notes: '',
    exercises: [
      {
        id: 'exercise-1',
        name: 'Bench press',
        notes: '',
        sets: [
          { id: 'set-1', kind: 'working', reps: 5, loadKg: 80, completed: true },
          { id: 'set-2', kind: 'working', reps: 5, loadKg: 80, completed: true },
        ],
      },
    ],
  },
  {
    id: 'workout-2',
    title: 'Lower',
    focus: 'lower',
    completedOn: '2026-04-14',
    durationMinutes: 70,
    energy: 3,
    notes: '',
    exercises: [
      {
        id: 'exercise-2',
        name: 'Front squat',
        notes: '',
        sets: [{ id: 'set-3', kind: 'working', reps: 5, loadKg: 100, completed: true }],
      },
    ],
  },
]

const weightEntries: WeightEntry[] = [
  { id: 'weight-1', recordedOn: '2026-04-01', weightKg: 84, notes: '' },
  { id: 'weight-2', recordedOn: '2026-04-15', weightKg: 82.5, notes: '' },
]

describe('history helpers', () => {
  it('calculates bmi from weight and height', () => {
    expect(calculateBmi(82.5, 180)).toBeCloseTo(25.46, 2)
    expect(calculateBmi(82.5, 0)).toBeNull()
  })

  it('returns the latest weight entry', () => {
    expect(getLatestWeightEntry(weightEntries)?.id).toBe('weight-2')
  })

  it('builds weekly workout trends', () => {
    const volumeTrend = buildWorkoutVolumeTrend(workouts, 2, new Date('2026-04-14'))
    const sessionTrend = buildWorkoutSessionTrend(workouts, 2, new Date('2026-04-14'))

    expect(volumeTrend.map((point) => point.value)).toEqual([800, 500])
    expect(sessionTrend.map((point) => point.value)).toEqual([1, 1])
  })

  it('builds weight history with bmi values', () => {
    const history = buildWeightHistory(weightEntries, 180)

    expect(history).toHaveLength(2)
    expect(history[0]).toEqual(
      expect.objectContaining({
        id: 'weight-1',
        weightKg: 84,
      }),
    )
    expect(history[1].bmi).toBeCloseTo(25.46, 2)
  })
})
