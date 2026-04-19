import { describe, expect, it } from 'vitest'
import { createInitialState } from './defaults'
import { generateWorkoutPlan, inferWorkoutFocus } from './recommendations'
import { createRemoteSnapshot, remoteSnapshotFingerprint } from './storage'

describe('generateWorkoutPlan', () => {
  it('matches the number of selected training days', () => {
    const state = createInitialState()
    const plan = generateWorkoutPlan(
      {
        ...state.profile,
        trainingDays: ['Mon', 'Tue', 'Thu', 'Sat'],
        primaryGoal: 'strength',
      },
      [],
    )

    expect(plan.days).toHaveLength(4)
    expect(plan.days.map((day) => day.day)).toEqual(['Mon', 'Tue', 'Thu', 'Sat'])
  })

  it('keeps endurance plans anchored by a conditioning day', () => {
    const state = createInitialState()
    const plan = generateWorkoutPlan(
      {
        ...state.profile,
        trainingDays: ['Mon', 'Wed', 'Fri'],
        primaryGoal: 'endurance',
      },
      [],
    )

    expect(plan.days.some((day) => /condition/i.test(day.focus))).toBe(true)
  })
})

describe('inferWorkoutFocus', () => {
  it('recognizes pressing sessions', () => {
    const focus = inferWorkoutFocus([
      {
        id: '1',
        name: 'Bench press',
        sets: 4,
        reps: 6,
        loadKg: 70,
        notes: '',
      },
      {
        id: '2',
        name: 'Cable fly',
        sets: 3,
        reps: 12,
        loadKg: 20,
        notes: '',
      },
    ])

    expect(focus).toBe('push')
  })
})

describe('remoteSnapshotFingerprint', () => {
  it('ignores exportedAt so sync comparisons stay stable', () => {
    const state = createInitialState()
    const first = createRemoteSnapshot(state)
    const second = {
      ...first,
      exportedAt: '2030-01-01T00:00:00.000Z',
    }

    expect(remoteSnapshotFingerprint(first)).toBe(remoteSnapshotFingerprint(second))
  })
})
