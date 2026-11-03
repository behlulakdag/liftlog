import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { storedLanguage, t } from '../lib/i18n'
import { LanguageCard } from './LanguageCard'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('LanguageCard', () => {
  it('follows the phone until a language is picked', () => {
    render(<LanguageCard reload={vi.fn()} />)
    expect(screen.getByRole('button', { name: t.languageDevice })).toHaveAttribute('aria-pressed', 'true')
    expect(storedLanguage()).toBe('device')
  })

  it('keeps the picked language and reloads the app in it', async () => {
    const reload = vi.fn()
    render(<LanguageCard reload={reload} />)
    await userEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(storedLanguage()).toBe('en')
    expect(reload).toHaveBeenCalledOnce()
  })

  it('does nothing when the current choice is tapped again', async () => {
    const reload = vi.fn()
    render(<LanguageCard reload={reload} />)
    await userEvent.click(screen.getByRole('button', { name: t.languageDevice }))
    expect(reload).not.toHaveBeenCalled()
  })

  it('ignores an unknown stored value', () => {
    localStorage.setItem('liftlog.language', 'de')
    expect(storedLanguage()).toBe('device')
  })
})
