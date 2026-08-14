import { createFileRoute } from '@tanstack/react-router'

import { LibraryPending } from '../components/PendingScreens'
import { getLibraryFn } from '../features/library/library.functions'
import { LibraryWorkspace } from '../features/library/LibraryWorkspace'

export const Route = createFileRoute('/')({
  loader: () => getLibraryFn(),
  pendingComponent: LibraryPending,
  pendingMs: 0,
  pendingMinMs: 200,
  component: StudyBuddyPage,
})

function StudyBuddyPage() {
  const library = Route.useLoaderData()
  return <LibraryWorkspace library={library} />
}
