import { describe, expect, it } from 'vitest'
import { createInitialState } from './defaults'
import { generateWorkoutPlan, getPlanFingerprint, inferWorkoutFocus } from './recommendations'
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
        notes: '',
        sets: [
          { id: '1a', kind: 'working', reps: 6, loadKg: 70, completed: true },
          { id: '1b', kind: 'working', reps: 6, loadKg: 70, completed: true },
          { id: '1c', kind: 'working', reps: 6, loadKg: 70, completed: true },
          { id: '1d', kind: 'working', reps: 6, loadKg: 70, completed: true },
        ],
      },
      {
        id: '2',
        name: 'Cable fly',
        notes: '',
        sets: [
          { id: '2a', kind: 'working', reps: 12, loadKg: 20, completed: true },
          { id: '2b', kind: 'working', reps: 12, loadKg: 20, completed: true },
          { id: '2c', kind: 'working', reps: 12, loadKg: 20, completed: true },
        ],
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

describe('getPlanFingerprint', () => {
  it('ignores profile height and goal progress-only updates', () => {
    const state = createInitialState()
    const fingerprint = getPlanFingerprint(
      state.profile,
      [
        {
          id: 'goal-1',
          title: 'Reach 80 kg',
          type: 'weight',
          targetValue: 80,
          currentValue: 84,
          unit: 'kg',
          deadline: '',
          notes: '',
          status: 'active',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    )

    const nextFingerprint = getPlanFingerprint(
      {
        ...state.profile,
        heightCm: 182,
      },
      [
        {
          id: 'goal-1',
          title: 'Reach 80 kg',
          type: 'weight',
          targetValue: 80,
          currentValue: 82.5,
          unit: 'kg',
          deadline: '',
          notes: '',
          status: 'active',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    )

    expect(nextFingerprint).toBe(fingerprint)
  })
})
