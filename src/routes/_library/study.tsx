import { createFileRoute, getRouteApi, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'

import { StudyPending } from '../../components/PendingScreens'
import { resolveStudyDeckIds, studySourceExists, studySourceName } from '../../core/studyScope'
import { startStudyFn } from '../../features/library/library.functions'
import {
  selectionLocation,
  studySourceFromSearch,
  studySourceSelection,
} from '../../features/library/library.navigation'
import { studySearchSchema } from '../../features/library/library.schemas'
import { useWorkspace } from '../../features/library/WorkspaceContext'
import { StudyEmpty } from '../../features/study/StudyEmpty'
import { StudySession } from '../../features/study/StudySession'

const libraryRoute = getRouteApi('/_library')

export const Route = createFileRoute('/_library/study')({
  validateSearch: studySearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, parentMatchPromise }) => {
    const library = (await parentMatchPromise).loaderData
    const source = studySourceFromSearch(deps)
    if (!library || !studySourceExists(library, source)) {
      throw redirect({ to: '/', replace: true })
    }
    const deckIds = resolveStudyDeckIds(library, source, deps.decks)
    if (deckIds.length === 0) {
      throw redirect({ ...selectionLocation(studySourceSelection(source)), replace: true })
    }
    const session = await startStudyFn({ data: { deckIds, mode: deps.mode } })
    return { ...session, source, name: studySourceName(library, source) }
  },
  // Each visit builds a fresh queue; a cached one would replay stale due cards.
  gcTime: 0,
  // Fast starts swap straight in; slower ones show the study skeleton.
  pendingMs: 250,
  pendingMinMs: 300,
  pendingComponent: StudyRoutePending,
  component: StudyRoute,
})

function StudyRoute() {
  const { dueCards, deckCards, source, name } = Route.useLoaderData()
  const search = Route.useSearch()
  const sessionId = Route.useMatch({ select: (match) => match.id })
  const navigate = useNavigate()
  const router = useRouter()
  const { notify } = useWorkspace()
  const back = selectionLocation(studySourceSelection(source))
  const backLabel =
    source.kind === 'deck' ? 'Back to deck' : source.kind === 'folder' ? 'Back to folder' : 'Back to library'
  // Due counts change as answers save, so refresh the library once the session ends.
  const refreshLibrary = useCallback(() => void router.invalidate(), [router])

  if (dueCards.length === 0) {
    return (
      <StudyEmpty
        name={name}
        backLabel={backLabel}
        onBack={() => void navigate(back)}
        onStudyAll={
          search.mode === 'due'
            ? () => void navigate({ to: '/study', search: { ...search, mode: 'all' }, replace: true })
            : undefined
        }
      />
    )
  }

  return (
    <StudySession
      key={sessionId}
      deckName={name}
      backLabel={backLabel}
      dueCards={dueCards}
      deckCards={deckCards}
      onNotice={notify}
      onLeave={() => void navigate(back)}
      onExit={refreshLibrary}
    />
  )
}

function StudyRoutePending() {
  const library = libraryRoute.useLoaderData()
  const search = Route.useSearch()
  return <StudyPending name={studySourceName(library, studySourceFromSearch(search))} />
}
