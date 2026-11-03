import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/endpoints'
import { queryKeys } from '../api/queryKeys'
import type { Program } from '../api/types'
import { errorMessage, formatKg } from '../lib/format'
import { t } from '../lib/i18n'
import { todayIso } from '../lib/nutrition'
import { goalProgress, parseTargetKg, validateBlock, type BlockField } from '../lib/program'
import { useConfirm, useToast } from './contexts'
import { CloseIcon } from './Icons'
import { Sheet } from './Sheet'

const MAX_GOALS = 6

/** The block's week under the date on the Workouts home; without a block, a quiet way to set one up. */
export function BlockLine({ program, onEdit }: { program: Program; onEdit: () => void }) {
  const { currentWeek, blockWeeks } = program
  const label =
    currentWeek == null || blockWeeks == null ? t.addBlock : currentWeek > blockWeeks ? t.blockOver(blockWeeks) : t.blockWeek(currentWeek, blockWeeks)
  return (
    <button className={currentWeek == null ? 'block-line empty' : 'block-line'} onClick={onEdit} data-testid="block-line">
      {label}
    </button>
  )
}

/** "Week 12 goals": a thin bar per goal, filled by how much of the way from its start is done. */
export function GoalsSection({ program, onEdit }: { program: Program; onEdit: () => void }) {
  const rows = [
    ...program.goals.map((goal) => ({
      key: `lift-${goal.exerciseId}`,
      name: goal.exerciseName,
      progress: goalProgress(goal.startKg, goal.currentKg, goal.targetKg),
      text: t.goalProgressText(formatKg(goal.currentKg), formatKg(goal.targetKg)),
    })),
    ...(program.weightGoal
      ? [
          {
            key: 'weight',
            name: t.bodyWeightGoalShort,
            progress: goalProgress(program.weightGoal.startKg, program.weightGoal.currentKg, program.weightGoal.targetKg),
            text: t.goalProgressText(program.weightGoal.currentKg == null ? '—' : formatKg(program.weightGoal.currentKg), formatKg(program.weightGoal.targetKg)),
          },
        ]
      : []),
  ]
  if (rows.length === 0) return null
  return (
    <section className="goals" aria-label={program.blockWeeks ? t.blockGoals(program.blockWeeks) : t.goalsTitleShort} data-testid="goals">
      <div className="home-section-head">
        <h2 className="home-section-title">{program.blockWeeks ? t.blockGoals(program.blockWeeks) : t.goalsTitleShort}</h2>
        <button className="btn btn-text" onClick={onEdit}>
          {t.editProgram}
        </button>
      </div>
      <ul className="goal-rows">
        {rows.map((row) => (
          <li key={row.key} className="goal-row">
            <span className="goal-name">{row.name}</span>
            <span className="goal-bar" aria-hidden>
              <span style={{ width: `${Math.round(row.progress * 100)}%` }} />
            </span>
            <span className="goal-text num">{row.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Block dates, the lift goals and the body-weight goal in one sheet; every change is saved as it is made. */
export function ProgramSheet({ program, onClose }: { program: Program; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const today = todayIso()
  const exercises = useQuery({ queryKey: queryKeys.exercises, queryFn: api.exercises, staleTime: 5 * 60_000 })
  const [blockStart, setBlockStart] = useState(program.blockStart ?? today)
  const [blockWeeks, setBlockWeeks] = useState(String(program.blockWeeks ?? 12))
  const [blockErrors, setBlockErrors] = useState<Set<BlockField>>(new Set())
  const [newExercise, setNewExercise] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [weightTarget, setWeightTarget] = useState(program.weightGoal ? String(program.weightGoal.targetKg) : '')
  const [busy, setBusy] = useState(false)

  const saved = (next: Program) => {
    queryClient.setQueryData(queryKeys.program(today), next)
  }
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      toast({ message: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const saveBlock = () => {
    const result = validateBlock(blockStart, blockWeeks)
    if (!result.value) {
      setBlockErrors(result.errors)
      return
    }
    const { startDate, weeks } = result.value
    void run(async () => saved(await api.setBlock(today, startDate, weeks)))
  }

  const removeBlock = async () => {
    if (!(await confirm({ item: t.blockWeek(program.currentWeek ?? 1, program.blockWeeks ?? 1) }))) return
    void run(async () => {
      await api.clearBlock()
      saved({ ...program, blockStart: null, blockWeeks: null, currentWeek: null })
    })
  }

  const addGoal = () => {
    const exerciseId = Number(newExercise)
    const target = parseTargetKg(newTarget, 0.5, 1000)
    if (!exerciseId || target == null) {
      toast({ message: t.goalTargetError })
      return
    }
    void run(async () => {
      saved(await api.setLiftGoal(today, exerciseId, target))
      setNewExercise('')
      setNewTarget('')
    })
  }

  const changeTarget = (exerciseId: number, text: string) => {
    const target = parseTargetKg(text, 0.5, 1000)
    if (target == null) return
    void run(async () => saved(await api.setLiftGoal(today, exerciseId, target)))
  }

  const removeGoal = async (exerciseId: number, name: string) => {
    if (!(await confirm({ item: name }))) return
    void run(async () => {
      await api.deleteLiftGoal(exerciseId)
      saved({ ...program, goals: program.goals.filter((goal) => goal.exerciseId !== exerciseId) })
    })
  }

  const saveWeightGoal = () => {
    if (weightTarget.trim() === '') {
      if (!program.weightGoal) return
      void (async () => {
        if (!(await confirm({ item: t.bodyWeightGoalShort }))) {
          setWeightTarget(String(program.weightGoal?.targetKg ?? ''))
          return
        }
        void run(async () => {
          await api.clearWeightGoal()
          saved({ ...program, weightGoal: null })
        })
      })()
      return
    }
    const target = parseTargetKg(weightTarget, 20, 400)
    if (target == null) {
      toast({ message: t.goalTargetError })
      return
    }
    if (target === program.weightGoal?.targetKg) return
    void run(async () => saved(await api.setWeightGoal(today, target)))
  }

  const used = new Set(program.goals.map((goal) => goal.exerciseId))
  const choices = (exercises.data ?? []).filter((exercise) => !used.has(exercise.id)).sort((a, b) => a.name.localeCompare(b.name))
  const picked = exercises.data?.find((exercise) => String(exercise.id) === newExercise)

  return (
    <Sheet title={t.programSheetTitle} onClose={onClose}>
      <div className="stack program-sheet">
        <div className="row">
          <div className={blockErrors.has('start') ? 'field invalid' : 'field'}>
            <label htmlFor="block-start">{t.blockStart}</label>
            <input id="block-start" type="date" value={blockStart} onChange={(e) => (setBlockStart(e.target.value), setBlockErrors(new Set()))} />
          </div>
          <div className={blockErrors.has('weeks') ? 'field invalid' : 'field'} style={{ maxWidth: 96 }}>
            <label htmlFor="block-weeks">{t.blockWeeksLabel}</label>
            <input id="block-weeks" inputMode="numeric" value={blockWeeks} onChange={(e) => (setBlockWeeks(e.target.value.replace(/\D/g, '').slice(0, 2)), setBlockErrors(new Set()))} />
          </div>
        </div>
        {blockErrors.size > 0 && <span className="field-error">{t.blockError}</span>}
        <div className="program-sheet-actions">
          <button className="btn btn-tonal" onClick={saveBlock} disabled={busy}>
            {t.save}
          </button>
          {program.blockStart && (
            <button className="btn btn-text" onClick={() => void removeBlock()} disabled={busy}>
              {t.removeBlock}
            </button>
          )}
        </div>

        <h3 className="program-sheet-title">{t.liftGoalsTitle}</h3>
        {program.goals.map((goal) => (
          <div key={goal.exerciseId} className="program-goal">
            <label htmlFor={`goal-${goal.exerciseId}`}>{goal.exerciseName}</label>
            <input
              id={`goal-${goal.exerciseId}`}
              inputMode="decimal"
              defaultValue={String(goal.targetKg)}
              aria-label={`${goal.exerciseName}: ${goal.bodyweight ? t.goalTargetAdded : t.goalTarget}`}
              onBlur={(e) => changeTarget(goal.exerciseId, e.target.value)}
            />
            <button className="icon-btn" onClick={() => void removeGoal(goal.exerciseId, goal.exerciseName)} aria-label={t.removeGoal(goal.exerciseName)} disabled={busy}>
              <CloseIcon size={16} />
            </button>
          </div>
        ))}
        {program.goals.length < MAX_GOALS ? (
          <div className="program-add-goal">
            <div className="field">
              <label htmlFor="goal-exercise">{t.goalExercise}</label>
              <select id="goal-exercise" value={newExercise} onChange={(e) => setNewExercise(e.target.value)}>
                <option value="" />
                {choices.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ maxWidth: 120 }}>
              <label htmlFor="goal-target">{picked?.bodyweight ? t.goalTargetAdded : t.goalTarget}</label>
              <input id="goal-target" inputMode="decimal" value={newTarget} onChange={(e) => setNewTarget(e.target.value.replace(/[^\d.,]/g, '').slice(0, 7))} />
            </div>
            <button className="btn btn-tonal" onClick={addGoal} disabled={busy || !newExercise}>
              {t.addGoal}
            </button>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {t.goalsFull}
          </p>
        )}

        <div className="field">
          <label htmlFor="weight-goal">{t.bodyWeightGoal}</label>
          <input id="weight-goal" inputMode="decimal" value={weightTarget} onChange={(e) => setWeightTarget(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))} onBlur={saveWeightGoal} />
        </div>
      </div>
    </Sheet>
  )
}
