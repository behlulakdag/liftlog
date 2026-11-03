import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { t } from '../lib/i18n'
import { AlertIcon } from './Icons'
import { MessageState } from './StateViews'

/**
 * Shown instead of React Router's developer page when a screen throws or the address matches no page. Plain
 * links and a full reload, so it still works when the router or a page chunk is what broke (an old chunk after a
 * new release is the usual cause, and a reload fetches the new one).
 */
export function RouteError({ notFound: unmatched = false }: { notFound?: boolean }) {
  const error = useRouteError()
  const notFound = unmatched || (isRouteErrorResponse(error) && error.status === 404)
  if (!notFound && error) console.error(error)
  return (
    <div className="page route-error">
      <MessageState
        icon={<AlertIcon size={32} />}
        title={notFound ? t.pageNotFoundTitle : t.appCrashedTitle}
        body={notFound ? t.pageNotFoundBody : t.appCrashedBody}
      >
        <div className="route-error-actions">
          {!notFound && (
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              {t.reload}
            </button>
          )}
          <Link className={notFound ? 'btn btn-primary' : 'btn btn-tonal'} to="/" reloadDocument={!notFound}>
            {t.goHome}
          </Link>
        </div>
      </MessageState>
    </div>
  )
}
