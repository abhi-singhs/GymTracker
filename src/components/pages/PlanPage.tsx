import { formatDateTime } from '../../lib/utils'
import { parseNumber } from '../../lib/app-drafts'
import type { PlanDay, PlanExercise, WorkoutPlan } from '../../lib/types'
import { SectionHeader } from '../SectionHeader'

type UpdatePlanDay = (dayId: string, updater: (day: PlanDay) => PlanDay) => void
type UpdatePlanExercise = <Field extends keyof PlanExercise>(
  dayId: string,
  exerciseId: string,
  field: Field,
  value: PlanExercise[Field],
) => void

interface PlanPageProps {
  activePlan: WorkoutPlan
  planNeedsRefresh: boolean
  regeneratePlan: () => void
  updatePlanDay: UpdatePlanDay
  addPlanExercise: (dayId: string) => void
  updatePlanExercise: UpdatePlanExercise
  removePlanExercise: (dayId: string, exerciseId: string) => void
}

export function PlanPage({
  activePlan,
  planNeedsRefresh,
  regeneratePlan,
  updatePlanDay,
  addPlanExercise,
  updatePlanExercise,
  removePlanExercise,
}: PlanPageProps) {
  return (
    <section className="section-surface" id="plan">
      <SectionHeader
        eyebrow="Plan"
        title="Generate a weekly split, then tune it without losing structure"
        description="The planner is rule-based and fully offline. It reacts to your fitness level, preferred days, equipment access, and the goals you keep active."
        action={
          <button className="button subtle" type="button" onClick={regeneratePlan}>
            Regenerate
          </button>
        }
      />

      <div className="plan-summary">
        <div className="plan-summary-copy">
          <h3>{activePlan.summary}</h3>
          <p>
            Generated {formatDateTime(activePlan.createdAt)} -{' '}
            {planNeedsRefresh ? 'refresh recommended' : 'aligned to your current profile'}
          </p>
        </div>

        <div className="rationale-stack">
          {activePlan.rationale.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      </div>

      <div className="plan-grid">
        {activePlan.days.map((day) => (
          <article key={day.id} className="plan-day">
            <div className="plan-topline">
              <div>
                <p className="eyebrow">{day.day}</p>
                <h3>{day.focus}</h3>
              </div>
              <span className="status-pill neutral">{day.durationMinutes} min</span>
            </div>

            <p className="plan-intention">{day.intention}</p>

            <ul className="plan-exercises">
              {day.exercises.map((exercise) => (
                <li key={exercise.id}>
                  <div>
                    <strong>{exercise.name}</strong>
                    <span>{exercise.cue}</span>
                  </div>
                  <em>
                    {exercise.setsText} - {exercise.intensity}
                  </em>
                </li>
              ))}
            </ul>

            <p className="plan-recovery">{day.recoveryNote}</p>

            <details className="plan-editor">
              <summary>Customize this day</summary>

              <div className="field-grid">
                <label className="field">
                  <span>Focus title</span>
                  <input
                    type="text"
                    value={day.focus}
                    onChange={(event) =>
                      updatePlanDay(day.id, (current) => ({
                        ...current,
                        focus: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>Duration</span>
                  <input
                    type="number"
                    value={day.durationMinutes}
                    onChange={(event) =>
                      updatePlanDay(day.id, (current) => ({
                        ...current,
                        durationMinutes: parseNumber(event.target.value, current.durationMinutes),
                      }))
                    }
                  />
                </label>
              </div>

              <label className="field">
                <span>Intention</span>
                <textarea
                  rows={3}
                  value={day.intention}
                  onChange={(event) =>
                    updatePlanDay(day.id, (current) => ({
                      ...current,
                      intention: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="editor-stack">
                {day.exercises.map((exercise) => (
                  <div key={exercise.id} className="editable-exercise">
                    <label className="field">
                      <span>Name</span>
                      <input
                        type="text"
                        value={exercise.name}
                        onChange={(event) =>
                          updatePlanExercise(day.id, exercise.id, 'name', event.target.value)
                        }
                      />
                    </label>

                    <label className="field compact">
                      <span>Prescription</span>
                      <input
                        type="text"
                        value={exercise.setsText}
                        onChange={(event) =>
                          updatePlanExercise(day.id, exercise.id, 'setsText', event.target.value)
                        }
                      />
                    </label>

                    <label className="field compact">
                      <span>Intensity</span>
                      <input
                        type="text"
                        value={exercise.intensity}
                        onChange={(event) =>
                          updatePlanExercise(day.id, exercise.id, 'intensity', event.target.value)
                        }
                      />
                    </label>

                    <button
                      className="text-button"
                      type="button"
                      onClick={() => removePlanExercise(day.id, exercise.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <label className="field">
                <span>Recovery note</span>
                <textarea
                  rows={3}
                  value={day.recoveryNote}
                  onChange={(event) =>
                    updatePlanDay(day.id, (current) => ({
                      ...current,
                      recoveryNote: event.target.value,
                    }))
                  }
                />
              </label>

              <button className="button subtle" type="button" onClick={() => addPlanExercise(day.id)}>
                Add custom exercise
              </button>
            </details>
          </article>
        ))}
      </div>
    </section>
  )
}
