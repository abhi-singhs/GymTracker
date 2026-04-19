import type { Dispatch, SetStateAction } from 'react'
import { GOAL_TYPE_OPTIONS } from '../../lib/defaults'
import type { Goal, GoalType } from '../../lib/types'
import { formatDisplayDate, titleCase } from '../../lib/utils'
import { goalProgress } from '../../lib/dashboard'
import { parseNumber, type GoalDraft } from '../../lib/app-drafts'
import { SectionHeader } from '../SectionHeader'

type UpdateGoal = (goalId: string, updater: (goal: Goal) => Goal) => void

interface GoalsPageProps {
  activeGoals: Goal[]
  completedGoals: number
  goalDraft: GoalDraft
  goalFormError: string | null
  setGoalDraft: Dispatch<SetStateAction<GoalDraft>>
  addGoal: () => void
  updateGoal: UpdateGoal
  deleteGoal: (goalId: string) => void
}

export function GoalsPage({
  activeGoals,
  completedGoals,
  goalDraft,
  goalFormError,
  setGoalDraft,
  addGoal,
  updateGoal,
  deleteGoal,
}: GoalsPageProps) {
  return (
    <section className="section-surface" id="goals">
      <SectionHeader
        eyebrow="Goals"
        title="Track the targets that make consistency visible"
        description="Use goals for strength numbers, body composition milestones, endurance targets, or habits you want to repeat."
        action={<span className="status-pill neutral">{completedGoals} completed</span>}
      />

      {activeGoals.length === 0 ? (
        <div className="empty-state">
          <strong>No active goals yet.</strong>
          <p>
            Start with one weekly habit or one lift target so the dashboard has something
            concrete to measure.
          </p>
        </div>
      ) : (
        <div className="goal-stack">
          {activeGoals.map((goal) => (
            <article key={goal.id} className="goal-item">
              <div className="goal-topline">
                <div>
                  <p className="eyebrow">{titleCase(goal.type)}</p>
                  <h3>{goal.title}</h3>
                </div>
                <button className="text-button" type="button" onClick={() => deleteGoal(goal.id)}>
                  Remove
                </button>
              </div>

              <div className="progress-bar" aria-hidden="true">
                <span style={{ width: `${goalProgress(goal)}%` }} />
              </div>

              <div className="goal-metrics">
                <label className="field compact">
                  <span>Current</span>
                  <input
                    type="number"
                    value={goal.currentValue}
                    onChange={(event) =>
                      updateGoal(goal.id, (current) => ({
                        ...current,
                        currentValue: parseNumber(event.target.value, current.currentValue),
                      }))
                    }
                  />
                </label>

                <div className="goal-target">
                  <span>Target</span>
                  <strong>
                    {goal.targetValue} {goal.unit}
                  </strong>
                </div>

                <div className="goal-target">
                  <span>Deadline</span>
                  <strong>{goal.deadline ? formatDisplayDate(goal.deadline) : 'Flexible'}</strong>
                </div>
              </div>

              {goal.notes ? <p className="goal-notes">{goal.notes}</p> : null}

              <div className="goal-actions">
                <button
                  className="button subtle"
                  type="button"
                  onClick={() =>
                    updateGoal(goal.id, (current) => ({
                      ...current,
                      status: 'completed',
                    }))
                  }
                >
                  Mark complete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="form-divider" />

      <div className="field-grid">
        <label className="field">
          <span>Goal title</span>
          <input
            type="text"
            value={goalDraft.title}
            onChange={(event) => setGoalDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder="Hit 4 sessions every week"
          />
        </label>

        <label className="field">
          <span>Goal type</span>
          <select
            value={goalDraft.type}
            onChange={(event) =>
              setGoalDraft((current) => ({
                ...current,
                type: event.target.value as GoalType,
              }))
            }
          >
            {GOAL_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Target</span>
          <input
            type="number"
            value={goalDraft.targetValue}
            onChange={(event) =>
              setGoalDraft((current) => ({
                ...current,
                targetValue: parseNumber(event.target.value, current.targetValue),
              }))
            }
          />
        </label>

        <label className="field">
          <span>Unit</span>
          <input
            type="text"
            value={goalDraft.unit}
            onChange={(event) => setGoalDraft((current) => ({ ...current, unit: event.target.value }))}
            placeholder="kg, sessions / week, km"
          />
        </label>

        <label className="field">
          <span>Current value</span>
          <input
            type="number"
            value={goalDraft.currentValue}
            onChange={(event) =>
              setGoalDraft((current) => ({
                ...current,
                currentValue: parseNumber(event.target.value, current.currentValue),
              }))
            }
          />
        </label>

        <label className="field">
          <span>Deadline</span>
          <input
            type="date"
            value={goalDraft.deadline}
            onChange={(event) => setGoalDraft((current) => ({ ...current, deadline: event.target.value }))}
          />
        </label>
      </div>

      <label className="field">
        <span>Notes</span>
        <textarea
          rows={3}
          value={goalDraft.notes}
          onChange={(event) => setGoalDraft((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Why it matters, what success feels like, or any practical limits."
        />
      </label>

      {goalFormError ? <p className="form-error">{goalFormError}</p> : null}

      <button className="button primary" type="button" onClick={addGoal}>
        Add goal
      </button>
    </section>
  )
}
