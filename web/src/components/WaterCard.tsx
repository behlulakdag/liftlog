import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { api } from '../api/endpoints'
import { queryKeys } from '../api/queryKeys'
import type { WaterDay } from '../api/types'
import { vibrate } from '../lib/feedback'
import { errorMessage } from '../lib/format'
import { t } from '../lib/i18n'
import { formatLitres, GLASS_PRESETS_ML, glassFills, MAX_GLASS_ICONS, validateWaterSettings, type WaterField } from '../lib/water'
import { useToast } from './contexts'
import { SettingsIcon } from './Icons'
import { Sheet } from './Sheet'

/** The day's water on the Nutrition page: a row of glasses that fill up, one tap per glass drunk. */
export function WaterCard({ date }: { date: string }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const key = queryKeys.waterDay(date)
  const day = useQuery({ queryKey: key, queryFn: () => api.waterDay(date) })
  // Taps still waiting for the server: an answer to an earlier tap would show a total without the later ones
  const inFlight = useRef(0)

  const change = async (deltaMl: number) => {
    const before = queryClient.getQueryData<WaterDay>(key)
    if (!before) return
    // Shown at once so quick taps feel instant; the server clamps the same way
    queryClient.setQueryData<WaterDay>(key, (old) => old && { ...old, waterMl: Math.max(0, old.waterMl + deltaMl) })
    inFlight.current++
    try {
      const saved = await api.addWater(date, deltaMl)
      if (inFlight.current === 1) queryClient.setQueryData(key, saved)
      return saved
    } catch (error) {
      queryClient.setQueryData<WaterDay>(key, (old) => old && { ...old, waterMl: Math.max(0, old.waterMl - deltaMl) })
      toast({ message: errorMessage(error) })
    } finally {
      inFlight.current--
      if (inFlight.current === 0) void queryClient.invalidateQueries({ queryKey: key })
    }
  }

  const addGlass = (glassMl: number, goalMl: number | null, waterMl: number) => {
    const reachesGoal = goalMl != null && waterMl < goalMl && waterMl + glassMl >= goalMl
    vibrate(reachesGoal ? [20, 60, 20] : 15)
    void change(glassMl)
  }

  /** Taking a glass back is a tap too, so it comes with an undo instead of a confirmation. */
  const takeBack = (waterMl: number, glassMl: number) => {
    const amount = Math.min(glassMl, waterMl)
    if (amount === 0) return
    void change(-amount).then((saved) => {
      if (saved) toast({ message: t.waterTookBack(amount), actionLabel: t.undo, durationMs: 4000, onAction: () => void change(amount) })
    })
  }

  if (day.isPending || day.isError) {
    // The food log is the page's main content: water failing to load must not take it over
    return day.isError ? null : <section className="water-card water-card-loading" aria-busy="true" />
  }

  const { waterMl, goalMl, glassMl } = day.data
  const fills = glassFills(waterMl, goalMl, glassMl)
  const shown = fills.slice(0, MAX_GLASS_ICONS)
  const hidden = fills.length - shown.length
  const reached = goalMl != null && waterMl >= goalMl
  const progress = goalMl == null ? 0 : Math.min(1, waterMl / goalMl)

  return (
    <section className={reached ? 'water-card reached' : 'water-card'} data-testid="water-card">
      <div className="water-head">
        <h2 className="section-title">{t.waterTitle}</h2>
        <button className="icon-btn" onClick={() => setEditing(true)} aria-label={t.waterSettings}>
          <SettingsIcon size={18} />
        </button>
      </div>

      <div className="water-total">
        <strong className="num" data-testid="water-total">{formatLitres(waterMl)}</strong>
        {goalMl != null ? <span className="num"> / {formatLitres(goalMl)} L</span> : <span> L</span>}
        <small className="water-status">
          {reached ? t.waterGoalReached : goalMl != null ? t.waterLeft(formatLitres(goalMl - waterMl)) : t.waterGlasses(Math.round(waterMl / glassMl))}
        </small>
      </div>

      {shown.length > 0 && (
        <div className="water-glasses" role="img" aria-label={goalMl != null ? t.waterGlassesOfGoal(formatLitres(waterMl), formatLitres(goalMl)) : t.waterGlasses(fills.length)}>
          {shown.map((fill, index) => (
            <Glass key={index} fill={fill} />
          ))}
          {hidden > 0 && <span className="water-more num">+{hidden}</span>}
        </div>
      )}
      {goalMl != null && (
        <div className="water-bar" aria-hidden>
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <div className="water-actions">
        <button className="water-take-back" onClick={() => takeBack(waterMl, glassMl)} disabled={waterMl === 0} aria-label={t.waterTakeBack}>
          −
        </button>
        <button className="water-add" onClick={() => addGlass(glassMl, goalMl, waterMl)} data-testid="water-add">
          <span className="water-add-plus">+</span>
          <strong>{t.waterAddGlass}</strong>
          <span className="water-add-size num">{glassMl} ml</span>
        </button>
      </div>
      {goalMl == null && (
        <button className="btn btn-text water-set-goal" onClick={() => setEditing(true)}>
          {t.waterSetGoal} ›
        </button>
      )}

      {editing && (
        <WaterSettingsSheet
          day={day.data}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            queryClient.setQueryData(key, saved)
            setEditing(false)
          }}
        />
      )}
    </section>
  )
}

/** A tapered glass with its water level, a wavy surface and a rim highlight. */
function Glass({ fill }: { fill: number }) {
  const clipId = useId()
  // The water's top edge inside the 24 × 32 glass; 4 is just under the rim, 29 the bottom
  const level = 29 - 25 * fill
  return (
    <svg className={fill > 0 ? 'water-glass filled' : 'water-glass'} width="24" height="32" viewBox="0 0 24 32" aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <path d="M3 3h18l-2.2 26.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect className="water-glass-body" x="0" y="0" width="24" height="32" />
        {fill > 0 && (
          <path className="water-glass-water" d={`M0 ${level}q3 -1.6 6 0t6 0t6 0t6 0V32H0z`} />
        )}
      </g>
      <path className="water-glass-outline" d="M3 3h18l-2.2 26.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" />
      <path className="water-glass-shine" d="M6.5 7l1.2 17" />
    </svg>
  )
}

function WaterSettingsSheet({ day, onSaved, onClose }: { day: WaterDay; onSaved: (saved: WaterDay) => void; onClose: () => void }) {
  const toast = useToast()
  const [goal, setGoal] = useState(day.goalMl == null ? '' : formatLitres(day.goalMl))
  const [glass, setGlass] = useState(String(day.glassMl))
  const [errors, setErrors] = useState<Set<WaterField>>(new Set())
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const result = validateWaterSettings(goal, glass)
    if (!result.value) {
      setErrors(result.errors)
      return
    }
    setSaving(true)
    try {
      onSaved(await api.updateWaterSettings(day.date, result.value))
    } catch (error) {
      toast({ message: errorMessage(error) })
      setSaving(false)
    }
  }

  return (
    <Sheet title={t.waterSettings} onClose={onClose}>
      <div className="stack">
        <div className={errors.has('goal') ? 'field invalid' : 'field'}>
          <label htmlFor="water-goal">{t.waterGoalLabel}</label>
          <input id="water-goal" inputMode="decimal" placeholder="2" value={goal} onChange={(e) => (setGoal(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5)), setErrors(new Set()))} />
          {errors.has('goal') && <span className="field-error">{t.waterGoalError}</span>}
        </div>
        <div className={errors.has('glass') ? 'field invalid' : 'field'}>
          <label htmlFor="water-glass">{t.waterGlassLabel}</label>
          <div className="chip-row">
            {GLASS_PRESETS_ML.map((ml) => (
              <button key={ml} type="button" className={String(ml) === glass ? 'filter-chip selected' : 'filter-chip'} aria-pressed={String(ml) === glass} onClick={() => (setGlass(String(ml)), setErrors(new Set()))}>
                <span className="num">{ml} ml</span>
              </button>
            ))}
          </div>
          <input id="water-glass" inputMode="numeric" value={glass} onChange={(e) => (setGlass(e.target.value.replace(/\D/g, '').slice(0, 4)), setErrors(new Set()))} />
          {errors.has('glass') && <span className="field-error">{t.waterGlassError}</span>}
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {t.waterSettingsHint}
        </p>
        <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>
          {saving ? <span className="spinner small" /> : t.save}
        </button>
      </div>
    </Sheet>
  )
}
