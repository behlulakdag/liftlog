import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../api/client'
import { t } from '../lib/i18n'
import { RouteError } from './RouteError'
import { ErrorState } from './StateViews'

function Boom(): never {
  throw new Error('render failed')
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ errorElement: <RouteError />, children: [{ path: '/broken', element: <Boom /> }, { path: '*', element: <RouteError notFound /> }] }],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('RouteError', () => {
  it('shows our own not-found page for an unknown address', () => {
    renderAt('/no-such-page')
    expect(screen.getByRole('heading', { name: t.pageNotFoundTitle })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.goHome })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('button', { name: t.reload })).not.toBeInTheDocument()
  })

  it('replaces the router developer page when a screen throws, offering a reload', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderAt('/broken')
    expect(screen.getByRole('heading', { name: t.appCrashedTitle })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.reload })).toBeInTheDocument()
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument()
  })
})

describe('ErrorState', () => {
  it('offers going back instead of a retry for a record that no longer exists', () => {
    const onRetry = vi.fn()
    const onBack = vi.fn()
    render(<ErrorState error={new AppError('notFound')} onRetry={onRetry} onBack={onBack} />)
    screen.getByRole('button', { name: t.goBack }).click()
    expect(onBack).toHaveBeenCalled()
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('keeps the retry for other errors', () => {
    render(<ErrorState error={new AppError('network')} onRetry={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByRole('button', { name: t.retry })).toBeInTheDocument()
  })
})
