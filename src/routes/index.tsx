import { createFileRoute } from '@tanstack/react-router'

import { getLibraryFn } from '../features/library/library.functions'
import { LibraryWorkspace } from '../features/library/LibraryWorkspace'

export const Route = createFileRoute('/')({
  loader: () => getLibraryFn(),
  component: StudybuddyPage,
})

function StudybuddyPage() {
  const library = Route.useLoaderData()
  return <LibraryWorkspace library={library} />
}
