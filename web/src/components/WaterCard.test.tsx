import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WaterDay } from '../api/types'
import { t } from '../lib/i18n'
import { formatLitres } from '../lib/water'
import { fakeServer, jsonResponse } from '../test/fakeServer'
import { ToastProvider } from './Toast'
import { WaterCard } from './WaterCard'

const date = '2026-11-02'
const base = `/api/v1/water/days/${date}`

/** Keeps one day's water like the server does: deltas add up and the total never drops below zero. */
function waterServer(initial: Partial<WaterDay> = {}) {
  let day: WaterDay = { date, waterMl: 0, goalMl: null, glassMl: 250, ...initial }
  return fakeServer({
    [`GET ${base}`]: () => jsonResponse(200, day),
    [`POST ${base}/add`]: (body) => {
      day = { ...day, waterMl: Math.max(0, day.waterMl + (body as { deltaMl: number }).deltaMl) }
      return jsonResponse(200, day)
    },
    [`PUT ${base}/settings`]: (body) => {
      day = { ...day, ...(body as Pick<WaterDay, 'goalMl' | 'glassMl'>) }
      return jsonResponse(200, day)
    },
  })
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <WaterCard date={date} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('WaterCard', () => {
  it('adds one glass per tap and shows the litres left to the goal', async () => {
    const calls = waterServer({ goalMl: 2000 })
    renderCard()
    const add = await screen.findByTestId('water-add')
    await userEvent.click(add)
    await userEvent.click(add)

    await waitFor(() => expect(screen.getByTestId('water-total')).toHaveTextContent(formatLitres(500)))
    expect(screen.getByText(t.waterLeft(formatLitres(1500)))).toBeInTheDocument()
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([{ deltaMl: 250 }, { deltaMl: 250 }])
  })

  it('says so once the goal is reached', async () => {
    waterServer({ goalMl: 500, waterMl: 250 })
    renderCard()
    await userEvent.click(await screen.findByTestId('water-add'))
    expect(await screen.findByText(t.waterGoalReached)).toBeInTheDocument()
  })

  it('takes a glass back with an undo, and cannot go below zero', async () => {
    const calls = waterServer({ waterMl: 250 })
    renderCard()
    const takeBack = await screen.findByRole('button', { name: t.waterTakeBack })
    await userEvent.click(takeBack)
    await waitFor(() => expect(screen.getByTestId('water-total')).toHaveTextContent(formatLitres(0)))
    expect(takeBack).toBeDisabled()

    await userEvent.click(await screen.findByRole('button', { name: t.undo }))
    await waitFor(() => expect(screen.getByTestId('water-total')).toHaveTextContent(formatLitres(250)))
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([{ deltaMl: -250 }, { deltaMl: 250 }])
  })

  it('saves a goal typed in litres and a picked glass size', async () => {
    const calls = waterServer()
    renderCard()
    await userEvent.click(await screen.findByRole('button', { name: t.waterSettings }))
    const sheet = screen.getByRole('dialog', { name: t.waterSettings })
    await userEvent.type(within(sheet).getByLabelText(t.waterGoalLabel), '2,5')
    await userEvent.click(within(sheet).getByRole('button', { name: '330 ml' }))
    await userEvent.click(within(sheet).getByRole('button', { name: t.save }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ goalMl: 2500, glassMl: 330 })
    expect(screen.getByTestId('water-add')).toHaveTextContent('330 ml')
  })

  it('keeps the goal sheet open with an error for an impossible goal', async () => {
    const calls = waterServer()
    renderCard()
    await userEvent.click(await screen.findByRole('button', { name: t.waterSettings }))
    await userEvent.type(screen.getByLabelText(t.waterGoalLabel), '50')
    await userEvent.click(screen.getByRole('button', { name: t.save }))

    expect(screen.getByText(t.waterGoalError)).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'PUT')).toBe(false)
  })
})
