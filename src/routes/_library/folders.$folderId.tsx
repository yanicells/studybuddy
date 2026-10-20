import { createFileRoute, redirect } from '@tanstack/react-router'

import { WorkspaceContent } from '../../features/library/WorkspaceContext'

export const Route = createFileRoute('/_library/folders/$folderId')({
  // A deleted or mistyped folder sends you back to the library instead of an empty screen.
  loader: async ({ params, parentMatchPromise }) => {
    const library = (await parentMatchPromise).loaderData
    const folder = library?.folders.find((item) => item.id === params.folderId)
    if (!folder) throw redirect({ to: '/', replace: true })
    return { name: folder.name }
  },
  // Re-runs with the loader, so a rename updates the tab title too.
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.name} · StudyBuddy` }] : [],
  }),
  component: FolderRoute,
})

function FolderRoute() {
  const { folderId } = Route.useParams()
  return <WorkspaceContent selection={{ kind: 'folder', id: folderId }} />
}
