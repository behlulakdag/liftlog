import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppError } from './api/client'
import { cacheAccountKey } from './api/session'
import { ConfirmProvider } from './components/Confirm'
import { Layout } from './components/Layout'
import { RestTimerProvider } from './components/RestTimer'
import { RouteError } from './components/RouteError'
import { ToastProvider } from './components/Toast'
import { prefetchRoutePages } from './routing/pageLoaders'
import { pageRoutes } from './routing/pageRoutes'
import { QUERY_CACHE_MAX_AGE_MS, queryPersister, shouldKeepQuery } from './lib/queryCache'
import { SessionGate } from './SessionGate'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 401 is handled by signing in again, and 404 will not fix itself; only retry transient failures
      retry: (failureCount, error) =>
        failureCount < 2 && error instanceof AppError && (error.kind === 'network' || error.kind === 'server'),
      staleTime: 30_000,
      // Kept in memory as long as on the phone, so a screen restored from the cache is not dropped before it is shown
      gcTime: QUERY_CACHE_MAX_AGE_MS,
    },
  },
})

// The inner error boundary keeps the bottom nav around a broken page; the outer one catches the layout itself
const router = createBrowserRouter([
  { element: <Layout />, errorElement: <RouteError />, children: [{ errorElement: <RouteError />, children: pageRoutes }] },
])

// Safari has no requestIdleCallback; a short delay still lets the first screen and its API calls go first
const whenIdle = (callback: () => void) =>
  window.requestIdleCallback ? window.requestIdleCallback(callback, { timeout: 4000 }) : window.setTimeout(callback, 1500)

export function App() {
  // After the first paint, so the other pages' chunks never delay the start page
  useEffect(() => {
    whenIdle(() => void prefetchRoutePages())
  }, [])

  return (
    // Opens on the last saved screens at once and refetches behind them; offline they stay visible
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: QUERY_CACHE_MAX_AGE_MS,
        buster: cacheAccountKey(),
        dehydrateOptions: { shouldDehydrateQuery: shouldKeepQuery },
      }}
    >
      <ToastProvider>
        <ConfirmProvider>
          <RestTimerProvider>
            <SessionGate>
              <RouterProvider router={router} />
            </SessionGate>
          </RestTimerProvider>
        </ConfirmProvider>
      </ToastProvider>
    </PersistQueryClientProvider>
  )
}
