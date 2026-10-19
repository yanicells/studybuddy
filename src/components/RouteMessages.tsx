import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'

import { Button } from './Button'

/** Full-page fallback when a route fails to load. "Try again" reruns the failed loaders. */
export function RouteError({ error }: Readonly<ErrorComponentProps>) {
  const router = useRouter()
  return (
    <main className="route-message" role="alert">
      <h1>StudyBuddy could not open this page.</h1>
      <p>{errorMessage(error)}</p>
      <div className="route-message__actions">
        <Button variant="primary" onClick={() => void router.invalidate()}>
          Try again
        </Button>
        <Link className="button button--secondary button--medium" to="/">
          Back to library
        </Link>
      </div>
    </main>
  )
}

export function RouteNotFound() {
  return (
    <main className="route-message">
      <h1>Page not found</h1>
      <p>This page does not exist or has moved.</p>
      <div className="route-message__actions">
        <Link className="button button--primary button--medium" to="/">
          Back to library
        </Link>
      </div>
    </main>
  )
}

// fetch() rejects with a TypeError when the network is down.
function errorMessage(error: Error): string {
  if (error instanceof TypeError) return 'Check your connection and try again.'
  return error.message || 'Something went wrong while loading.'
}
