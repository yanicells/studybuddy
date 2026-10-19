import { createFileRoute, redirect } from '@tanstack/react-router'

import { deckSearchSchema } from '../../features/library/library.schemas'
import { WorkspaceContent } from '../../features/library/WorkspaceContext'

export const Route = createFileRoute('/_library/decks/$deckId')({
  validateSearch: deckSearchSchema,
  // A deleted or mistyped deck sends you back to the library instead of an empty screen.
  loader: async ({ params, parentMatchPromise }) => {
    const library = (await parentMatchPromise).loaderData
    if (!library?.decks.some((deck) => deck.id === params.deckId)) {
      throw redirect({ to: '/', replace: true })
    }
  },
  component: DeckRoute,
})

function DeckRoute() {
  const { deckId } = Route.useParams()
  const { status } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <WorkspaceContent
      selection={{ kind: 'deck', id: deckId }}
      filter={status ?? 'all'}
      onFilter={(filter) =>
        void navigate({
          search: { status: filter === 'all' ? undefined : filter },
          replace: true,
          resetScroll: false,
        })
      }
    />
  )
}
