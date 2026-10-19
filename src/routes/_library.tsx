import { createFileRoute } from '@tanstack/react-router'

import { LibraryPending } from '../components/PendingScreens'
import { getLibraryFn } from '../features/library/library.functions'
import { LibraryWorkspace } from '../features/library/LibraryWorkspace'

/**
 * Loads the library snapshot once for every library screen and the study session.
 * Child routes read it through `parentMatchPromise` to redirect away from missing items.
 */
export const Route = createFileRoute('/_library')({
  loader: () => getLibraryFn(),
  pendingComponent: LibraryPending,
  pendingMs: 0,
  pendingMinMs: 200,
  component: LibraryWorkspace,
})
