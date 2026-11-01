import type { MuscleSets } from '../api/types'
import { BodyMap } from '../components/BodyMap'
import { t } from '../lib/i18n'
import { MAP_MUSCLES, muscleName, type MapMuscle } from '../lib/muscles'

// Nothing is coloured by training here: every muscle is drawn plain and only the picked one lights up
const NO_SETS = new Map<MapMuscle, MuscleSets>()

/**
 * Body-map mode of the exercise picker: front and back side by side, so any muscle is one tap away without
 * flipping the figure, plus a strip of muscle names for fingers that find the small regions fiddly.
 */
export function PickerMuscleMap({ selected, onSelect }: { selected: MapMuscle | null; onSelect: (muscle: MapMuscle) => void }) {
  return (
    <section className="picker-map" aria-label={t.pickerMuscleMap} data-testid="picker-muscle-map">
      <div className="picker-map-plate">
        <div className="picker-map-figures">
          {(['front', 'back'] as const).map((side) => (
            <figure key={side}>
              <BodyMap side={side} muscles={NO_SETS} scope={7} selected={selected} onSelect={onSelect} labelFor={muscleName} />
              <figcaption>{side === 'front' ? t.muscleMapFront : t.muscleMapBack}</figcaption>
            </figure>
          ))}
        </div>
        <div className="chip-row picker-map-chips" role="group" aria-label={t.pickerMuscleChips}>
          {MAP_MUSCLES.map((muscle) => (
            <button
              key={muscle}
              type="button"
              className={muscle === selected ? 'filter-chip selected' : 'filter-chip'}
              aria-pressed={muscle === selected}
              onClick={() => onSelect(muscle)}
            >
              {muscleName(muscle)}
            </button>
          ))}
        </div>
        {!selected && <p className="picker-map-hint">{t.pickerMapHint}</p>}
      </div>
    </section>
  )
}
