import { createFileRoute, redirect } from '@tanstack/react-router'

import { WorkspaceContent } from '../../features/library/WorkspaceContext'

export const Route = createFileRoute('/_library/folders/$folderId')({
  // A deleted or mistyped folder sends you back to the library instead of an empty screen.
  loader: async ({ params, parentMatchPromise }) => {
    const library = (await parentMatchPromise).loaderData
    if (!library?.folders.some((folder) => folder.id === params.folderId)) {
      throw redirect({ to: '/', replace: true })
    }
  },
  component: FolderRoute,
})

function FolderRoute() {
  const { folderId } = Route.useParams()
  return <WorkspaceContent selection={{ kind: 'folder', id: folderId }} />
}
