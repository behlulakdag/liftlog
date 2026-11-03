import type { Exercise, RoutineExercise, RoutineInput } from '../api/types'
import { t } from './i18n'
import { clampRoutineSets, clampTargetReps, ROUTINE_MAX_EXERCISES, ROUTINE_NAME_MAX } from './routineLogic'

// Ready-made routines. Exercises are listed by their exact built-in (English) names, not ids: ids differ
// between databases, so a template is resolved against the user's own GET /exercises when it is used.

export type TemplateId = 'upperA' | 'lowerA' | 'upperB' | 'lowerB'
export type TemplateFocus = 'chestShoulders' | 'squat' | 'backPress' | 'deadlift'

export interface TemplateExercise {
  /** Exact built-in name, as seeded by the Flyway migrations */
  name: string
  /** Gym shorthand for the one-line summary ("OHP"); the full name is used when missing */
  short?: string
  sets: number
  targetReps: number
}

export interface RoutineTemplate {
  id: TemplateId
  focus: TemplateFocus
  beginner: boolean
  exercises: TemplateExercise[]
}

const ex = (name: string, sets: number, targetReps: number, short?: string): TemplateExercise => ({ name, short, sets, targetReps })

// Behlül's 12-week block (October 2026), done in this order: Upper A → Lower A → Upper B → Lower B. A rep range
// like 6–10 is stored as its top: with double progression that is the number to reach before adding weight.
export const ROUTINE_TEMPLATES: readonly RoutineTemplate[] = [
  {
    id: 'upperA',
    focus: 'chestShoulders',
    beginner: false,
    exercises: [
      ex('Incline Dumbbell Press', 3, 10, 'Incline DB'),
      ex('Bench Press', 3, 5, 'Bench'),
      ex('Dumbbell Row', 3, 12, 'DB Row'),
      ex('Lateral Raise', 3, 15, 'Lateral'),
      ex('Face Pull', 3, 15),
      ex('Triceps Pushdown', 3, 12, 'Pushdown'),
    ],
  },
  {
    id: 'lowerA',
    focus: 'squat',
    beginner: false,
    exercises: [
      ex('Smith Machine Squat', 3, 8, 'Smith Squat'),
      ex('Romanian Deadlift', 3, 10, 'RDL'),
      ex('Leg Press', 3, 12),
      ex('Lying Leg Curl', 3, 12, 'Leg Curl'),
      ex('Standing Calf Raise Machine', 4, 15, 'Calf Raise'),
      ex('Cable Crunch', 3, 15),
    ],
  },
  {
    id: 'upperB',
    focus: 'backPress',
    beginner: false,
    exercises: [
      ex('Pull-up', 4, 8),
      ex('Dumbbell Shoulder Press', 3, 10, 'DB Press'),
      ex('Close-Grip Lat Pulldown', 3, 10, 'Pulldown'),
      ex('Low-to-High Cable Fly', 3, 15, 'Cable Fly'),
      ex('Lateral Raise', 3, 15, 'Lateral'),
      ex('Cable Rear Delt Fly', 3, 15, 'Reverse Fly'),
      ex('Incline Dumbbell Curl', 3, 12, 'Incline Curl'),
    ],
  },
  {
    id: 'lowerB',
    focus: 'deadlift',
    beginner: false,
    exercises: [
      ex('Deadlift', 3, 5),
      ex('Dumbbell Bulgarian Split Squat', 3, 10, 'Bulgarian'),
      ex('Seated Leg Curl', 3, 15, 'Leg Curl'),
      ex('Leg Extension', 2, 15, 'Leg Ext'),
      ex('Seated Calf Raise', 4, 15, 'Calf Raise'),
      ex('Hammer Curl', 2, 12),
      ex('Overhead Dumbbell Triceps Extension', 2, 12, 'Overhead Ext'),
    ],
  },
]

/** The template's name in the UI language; also the name the new routine gets. */
export const templateName = (template: RoutineTemplate) => (t.templateNames[template.id] ?? template.id).slice(0, ROUTINE_NAME_MAX)

/** "Bench 4×8 · OHP 3×8 · …" for the cards. */
export function templateSummary(template: RoutineTemplate): string {
  return template.exercises.map((e) => `${e.short ?? e.name} ${e.sets}×${e.targetReps}`).join(' · ')
}

export interface ResolvedTemplate {
  /** Exercises found in the catalog, in template order, with the user's ids */
  exercises: RoutineExercise[]
  /** Template names that are not in the catalog (an older server, or a renamed exercise); they are skipped */
  missing: string[]
}

const normalize = (name: string) => name.trim().toLowerCase()

/**
 * Maps a template's names to the user's exercise ids. A built-in exercise wins over a custom one with the
 * same name; an exact match wins over one that differs only in case or spaces. Names that are not found
 * are skipped and reported instead of failing the whole template, and an id is never used twice because
 * the server rejects a routine that lists an exercise twice.
 */
export function resolveTemplate(template: RoutineTemplate, catalog: Exercise[]): ResolvedTemplate {
  const exact = new Map<string, Exercise>()
  const loose = new Map<string, Exercise>()
  // Built-ins go in last so they overwrite a custom exercise of the same name
  for (const exercise of [...catalog].sort((a, b) => Number(b.custom) - Number(a.custom))) {
    exact.set(exercise.name, exercise)
    loose.set(normalize(exercise.name), exercise)
  }

  const exercises: RoutineExercise[] = []
  const missing: string[] = []
  const used = new Set<number>()
  for (const item of template.exercises) {
    const match = exact.get(item.name) ?? loose.get(normalize(item.name))
    if (!match) {
      missing.push(item.name)
      continue
    }
    if (used.has(match.id) || exercises.length >= ROUTINE_MAX_EXERCISES) continue
    used.add(match.id)
    exercises.push({
      exerciseId: match.id,
      name: match.name,
      bodyweight: match.bodyweight,
      sets: clampRoutineSets(item.sets),
      targetReps: clampTargetReps(item.targetReps),
    })
  }
  return { exercises, missing }
}

/** The POST /routines body for a template, or null when none of its exercises could be resolved. */
export function templateRoutineInput(template: RoutineTemplate, resolved: ResolvedTemplate): RoutineInput | null {
  if (resolved.exercises.length === 0) return null
  return {
    name: templateName(template),
    exercises: resolved.exercises.map(({ exerciseId, sets, targetReps }) => ({ exerciseId, sets, targetReps })),
  }
}
