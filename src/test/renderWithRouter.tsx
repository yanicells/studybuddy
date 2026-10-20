import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { act, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'

/**
 * Renders UI that contains router `<Link>`s inside a memory router at `path`.
 * Every path matches, so clicking a link navigates without a not-found screen.
 * Returns the router so tests can read `router.state.location`.
 */
export async function renderWithRouter(ui: ReactNode, path = '/') {
  // The router resets scroll on navigation; jsdom does not implement scrollTo.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const rootRoute = createRootRoute({ component: () => ui })
  const anyRoute = createRoute({ getParentRoute: () => rootRoute, path: '$' })
  const router = createRouter({
    routeTree: rootRoute.addChildren([anyRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await act(() => router.load())
  render(<RouterProvider router={router} />)
  return router
}
