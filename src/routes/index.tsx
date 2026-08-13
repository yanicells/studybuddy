import { createFileRoute } from '@tanstack/react-router'

import { getLibraryFn } from '../features/library/library.functions'

export const Route = createFileRoute('/')({
  loader: () => getLibraryFn(),
  component: StudybuddyPage,
})

function StudybuddyPage() {
  const library = Route.useLoaderData()
  return (
    <main className="scaffold">
      <div className="brand-mark" aria-hidden="true">S</div>
      <h1>Studybuddy</h1>
      <p>
        {library.decks.length} decks · {library.folders.length} folders
      </p>
    </main>
  )
}
