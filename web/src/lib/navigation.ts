import type { NavigateFunction } from 'react-router'

/**
 * Back to the previous screen, or home when this page was opened straight from a link and there is nothing to go
 * back to. React Router keeps its own position in history.state.idx; 0 means this is the first entry.
 */
export function goBackOrHome(navigate: NavigateFunction) {
  const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
  if (index > 0) void navigate(-1)
  else void navigate('/', { replace: true })
}
