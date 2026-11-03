import { languageChoice, saveLanguage, t, type LanguageChoice } from '../lib/i18n'

// Each language is written in itself, so it can be found even when the page is in the other one
const CHOICES: { value: LanguageChoice; label: () => string; lang?: string }[] = [
  { value: 'device', label: () => t.languageDevice },
  { value: 'tr', label: () => 'Türkçe', lang: 'tr' },
  { value: 'en', label: () => 'English', lang: 'en' },
]

/** App language on the Profile page; picking one reloads the app in it. */
export function LanguageCard({ reload = () => window.location.reload() }: { reload?: () => void }) {
  return (
    <div className="info-card language-card">
      <div className="info-row">
        <span className="muted">{t.language}</span>
        <div className="language-options" role="group" aria-label={t.language}>
          {CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              lang={choice.lang}
              className={choice.value === languageChoice ? 'filter-chip selected' : 'filter-chip'}
              aria-pressed={choice.value === languageChoice}
              onClick={() => {
                if (choice.value === languageChoice) return
                saveLanguage(choice.value)
                reload()
              }}
            >
              {choice.label()}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
