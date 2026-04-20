import { useMemo, type Dispatch, type SetStateAction } from 'react'
import { formatVolume, getBestLift } from '../../lib/dashboard'
import type { WeightDraft } from '../../lib/app-drafts'
import { parseNumber } from '../../lib/app-drafts'
import {
  buildWeightHistory,
  buildWorkoutFocusBreakdown,
  buildWorkoutSessionTrend,
  buildWorkoutVolumeTrend,
  calculateBmi,
  getAverageWorkoutEnergy,
} from '../../lib/history'
import type { Profile, WeightEntry, WorkoutSession } from '../../lib/types'
import { formatDisplayDate, workoutVolume } from '../../lib/utils'
import { SectionHeader } from '../SectionHeader'

interface HistoryPageProps {
  profile: Profile
  sortedWorkouts: WorkoutSession[]
  sortedWeightEntries: WeightEntry[]
  weightDraft: WeightDraft
  weightFormError: string | null
  setWeightDraft: Dispatch<SetStateAction<WeightDraft>>
  logWeightEntry: () => void
  deleteWeightEntry: (weightEntryId: string) => void
}

interface LineChartProps {
  points: Array<{ label: string; value: number }>
  formatter: (value: number) => string
}

interface BarChartProps {
  points: Array<{ label: string; value: number }>
  formatter: (value: number) => string
}

function pluralize(value: number, singular: string, plural: string) {
  return `${formatMetric(value, 0)} ${value === 1 ? singular : plural}`
}

function formatMetric(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits,
  }).format(value)
}

function LineChart({ points, formatter }: LineChartProps) {
  if (points.length === 0 || points.every((point) => point.value === 0)) {
    return <div className="chart-empty">Not enough data yet.</div>
  }

  const maxValue = Math.max(...points.map((point) => point.value))
  const minValue = Math.min(...points.map((point) => point.value))
  const spread = maxValue === minValue ? Math.max(1, maxValue) : maxValue - minValue
  const path = points
    .map((point, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100
      const y = 60 - ((point.value - minValue) / spread) * 48 - 6
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  return (
    <div className="chart-shell">
      <svg className="chart-svg line-chart" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
        <path className="chart-grid" d="M 0 54 H 100" />
        <path className="chart-grid faint" d="M 0 30 H 100" />
        <path className="chart-line" d={path} />
        {points.map((point, index) => {
          const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100
          const y = 60 - ((point.value - minValue) / spread) * 48 - 6

          return <circle key={`${point.label}-${index}`} className="chart-dot" cx={x} cy={y} r="1.8" />
        })}
      </svg>

      <div className="chart-foot">
        <div>
          <span>Start</span>
          <strong>{formatter(points[0].value)}</strong>
        </div>
        <div>
          <span>Latest</span>
          <strong>{formatter(points.at(-1)?.value ?? 0)}</strong>
        </div>
      </div>
    </div>
  )
}

function BarChart({ points, formatter }: BarChartProps) {
  if (points.length === 0 || points.every((point) => point.value === 0)) {
    return <div className="chart-empty">Not enough data yet.</div>
  }

  const maxValue = Math.max(...points.map((point) => point.value), 1)

  return (
    <div className="bar-chart">
      {points.map((point) => (
        <div key={point.label} className="bar-chart-item">
          <div className="bar-chart-track">
            <div className="bar-chart-bar" style={{ height: `${(point.value / maxValue) * 100}%` }} />
          </div>
          <strong>{formatter(point.value)}</strong>
          <span>{point.label}</span>
        </div>
      ))}
    </div>
  )
}

export function HistoryPage({
  profile,
  sortedWorkouts,
  sortedWeightEntries,
  weightDraft,
  weightFormError,
  setWeightDraft,
  logWeightEntry,
  deleteWeightEntry,
}: HistoryPageProps) {
  const latestWeightEntry = sortedWeightEntries[0] ?? null
  const latestBmi = latestWeightEntry ? calculateBmi(latestWeightEntry.weightKg, profile.heightCm) : null

  const workoutVolumeTrend = useMemo(
    () => buildWorkoutVolumeTrend(sortedWorkouts, 8),
    [sortedWorkouts],
  )
  const workoutSessionTrend = useMemo(
    () => buildWorkoutSessionTrend(sortedWorkouts, 8),
    [sortedWorkouts],
  )
  const workoutFocusBreakdown = useMemo(
    () => buildWorkoutFocusBreakdown(sortedWorkouts),
    [sortedWorkouts],
  )
  const weightHistory = useMemo(
    () => buildWeightHistory(sortedWeightEntries, profile.heightCm),
    [profile.heightCm, sortedWeightEntries],
  )
  const bmiHistory = weightHistory
    .filter((entry) => entry.bmi !== null)
    .map((entry) => ({
      label: entry.label,
      value: entry.bmi ?? 0,
    }))

  return (
    <section className="section-surface history-surface" id="history">
      <SectionHeader
        eyebrow="History"
        title="See the training arc clearly"
        description="Track bodyweight separately from workouts, then read the longer story through trend charts, BMI, volume, and session patterns."
        action={<span className="status-pill neutral">{pluralize(sortedWorkouts.length, 'session logged', 'sessions logged')}</span>}
      />

      <div className="history-grid">
        <div className="history-column">
          <article className="history-panel">
            <div className="history-panel-header">
              <div>
                <p className="eyebrow">Bodyweight</p>
                <h3>Log weight without mixing it into training sessions</h3>
              </div>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Date</span>
                <input
                  type="date"
                  value={weightDraft.recordedOn}
                  onChange={(event) =>
                    setWeightDraft((current) => ({
                      ...current,
                      recordedOn: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Weight (kg)</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={weightDraft.weightKg || ''}
                  onChange={(event) =>
                    setWeightDraft((current) => ({
                      ...current,
                      weightKg: parseNumber(event.target.value, current.weightKg),
                    }))
                  }
                  placeholder="82.5"
                />
              </label>
            </div>

            <label className="field">
              <span>Note</span>
              <textarea
                rows={2}
                value={weightDraft.notes}
                onChange={(event) => setWeightDraft((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Morning weigh-in, travel week, or any context worth remembering."
              />
            </label>

            {weightFormError ? <p className="form-error">{weightFormError}</p> : null}

            <div className="history-panel-actions">
              <button className="button primary" type="button" onClick={logWeightEntry}>
                Save weight
              </button>
            </div>
          </article>

          <div className="history-metric-grid">
            <article className="history-metric-card accent">
              <span>Latest weight</span>
              <strong>{latestWeightEntry ? `${formatMetric(latestWeightEntry.weightKg)} kg` : 'No data'}</strong>
              <p>
                {latestWeightEntry
                  ? `Logged ${formatDisplayDate(latestWeightEntry.recordedOn)}.`
                  : 'Record a bodyweight entry to start the timeline.'}
              </p>
            </article>

            <article className="history-metric-card">
              <span>Latest BMI</span>
              <strong>
                {latestBmi !== null ? formatMetric(latestBmi, 2) : profile.heightCm > 0 ? 'No data' : 'Height needed'}
              </strong>
              <p>
                {profile.heightCm > 0
                  ? 'Calculated from your profile height and the latest weight.'
                  : 'Add height in Settings to unlock BMI history.'}
              </p>
            </article>

            <article className="history-metric-card">
              <span>Best lift</span>
              <strong>{getBestLift(sortedWorkouts)}</strong>
              <p>Highest single logged load so far.</p>
            </article>

            <article className="history-metric-card">
              <span>Average energy</span>
              <strong>
                {sortedWorkouts.length > 0 ? `${formatMetric(getAverageWorkoutEnergy(sortedWorkouts), 1)}/5` : 'No data'}
              </strong>
              <p>How sessions have felt across the logged history.</p>
            </article>
          </div>

          <article className="history-panel">
            <div className="history-panel-header">
              <div>
                <p className="eyebrow">Weight trend</p>
                <h3>Weight over time</h3>
              </div>
            </div>
            {weightHistory.length > 0 ? (
              <LineChart
                points={weightHistory.map((entry) => ({ label: entry.label, value: entry.weightKg }))}
                formatter={(value) => `${formatMetric(value)} kg`}
              />
            ) : (
              <div className="empty-state">
                <strong>No weight entries yet.</strong>
                <p>Record one bodyweight entry and this chart will start drawing the longer trend.</p>
              </div>
            )}
          </article>

          <article className="history-panel">
            <div className="history-panel-header">
              <div>
                <p className="eyebrow">BMI trend</p>
                <h3>Body mass index</h3>
              </div>
            </div>
            {profile.heightCm > 0 ? (
              <LineChart
                points={bmiHistory}
                formatter={(value) => formatMetric(value, 2)}
              />
            ) : (
              <div className="empty-state">
                <strong>Add height to unlock BMI.</strong>
                <p>Use the Settings page to enter height in centimeters, then BMI history will appear here automatically.</p>
              </div>
            )}
          </article>

          <article className="history-panel">
            <div className="history-panel-header">
              <div>
                <p className="eyebrow">Recent weight entries</p>
                <h3>Most recent bodyweight logs</h3>
              </div>
            </div>

            {sortedWeightEntries.length === 0 ? (
              <div className="empty-state">
                <strong>No weight entries yet.</strong>
                <p>Start with a single weigh-in to build a separate body-metric history.</p>
              </div>
            ) : (
              <div className="history-list">
                {sortedWeightEntries.slice(0, 8).map((entry) => (
                  <article key={entry.id} className="history-list-item">
                    <div>
                      <strong>{formatMetric(entry.weightKg)} kg</strong>
                      <span>{formatDisplayDate(entry.recordedOn)}</span>
                      {entry.notes ? <p>{entry.notes}</p> : null}
                    </div>
                    <button className="text-button" type="button" onClick={() => deleteWeightEntry(entry.id)}>
                      Remove
                    </button>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>

        <div className="history-column">
          <article className="history-panel">
            <div className="history-panel-header">
              <div>
                <p className="eyebrow">Workout volume</p>
                <h3>Weekly volume trend</h3>
              </div>
            </div>
            <BarChart
              points={workoutVolumeTrend}
              formatter={(value) => formatVolume(value)}
            />
          </article>

          <article className="history-panel">
            <div className="history-panel-header">
              <div>
                <p className="eyebrow">Session rhythm</p>
                <h3>Weekly session count</h3>
              </div>
            </div>
            <LineChart
              points={workoutSessionTrend}
              formatter={(value) => pluralize(value, 'session', 'sessions')}
            />
          </article>

          <article className="history-panel">
            <div className="history-panel-header">
              <div>
                <p className="eyebrow">Focus mix</p>
                <h3>Where training time has gone</h3>
              </div>
            </div>

            {workoutFocusBreakdown.length === 0 ? (
              <div className="empty-state">
                <strong>No workout history yet.</strong>
                <p>Log sessions first and the focus breakdown will populate automatically.</p>
              </div>
            ) : (
              <div className="focus-breakdown">
                {workoutFocusBreakdown.map((item) => {
                  const maxValue = workoutFocusBreakdown[0]?.value ?? 1

                  return (
                    <div key={item.label} className="focus-breakdown-item">
                      <div className="focus-breakdown-copy">
                        <strong>{item.label}</strong>
                        <span>{item.value} sessions</span>
                      </div>
                      <div className="focus-breakdown-track">
                        <span style={{ width: `${(item.value / maxValue) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </article>

          <article className="history-panel">
            <div className="history-panel-header">
              <div>
                <p className="eyebrow">Recent workouts</p>
                <h3>Latest sessions in context</h3>
              </div>
            </div>

            {sortedWorkouts.length === 0 ? (
              <div className="empty-state">
                <strong>No sessions logged yet.</strong>
                <p>Once workouts are saved, they will appear here alongside the charts.</p>
              </div>
            ) : (
              <div className="history-list">
                {sortedWorkouts.slice(0, 8).map((workout) => (
                  <article key={workout.id} className="history-list-item">
                    <div>
                      <strong>{workout.title}</strong>
                      <span>
                        {formatDisplayDate(workout.completedOn)} · {workout.durationMinutes} min · {workout.energy}/5 energy
                      </span>
                      <p>
                        {pluralize(workout.exercises.length, 'exercise', 'exercises')} · {formatVolume(workoutVolume(workout))} kg volume
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  )
}
