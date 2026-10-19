import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceContent } from '../../features/library/WorkspaceContext'

export const Route = createFileRoute('/_library/')({
  component: LibraryHomeRoute,
})

function LibraryHomeRoute() {
  return <WorkspaceContent selection={null} />
}
