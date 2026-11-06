import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { Query } from '@tanstack/react-query'

/**
 * The last answers of the app's own screens, kept on the phone so it opens on them at once while the server
 * answers (or wakes up), and still shows them offline. League data stays out: match timelines and Data Dragon
 * files are large enough to fill the few megabytes the browser gives a site.
 */
export const QUERY_CACHE_KEY = 'liftlog.queryCache.v1'

/** Older than a week, a screen would show stale numbers for too long before the refetch lands */
export const QUERY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** First parts of the query keys worth keeping (see api/queryKeys.ts) */
const KEPT_ROOTS = new Set(['workouts', 'workout', 'routines', 'exercises', 'stats', 'profile', 'weight', 'nutrition', 'water'])

export function shouldKeepQuery(query: Pick<Query, 'queryKey' | 'state'>): boolean {
  const root = query.queryKey[0]
  return query.state.status === 'success' && typeof root === 'string' && KEPT_ROOTS.has(root) && !(query.state.data instanceof Blob)
}

/** Private mode or blocked storage: no cache, the app simply fetches as before */
function storage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export const queryPersister = createSyncStoragePersister({ storage: storage(), key: QUERY_CACHE_KEY, throttleTime: 1000 })
