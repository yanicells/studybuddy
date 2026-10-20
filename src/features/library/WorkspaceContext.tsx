import { createContext, useContext } from 'react'

import type { LibrarySnapshot } from '../../core/types'
import { LibraryContent } from './LibraryContent'
import type { LibraryDialog, Selection, StatusFilter } from './library.types'
import type { ReorderRequest } from './reorder'

/** What the library layout shares with the screen rendered in its outlet. */
export interface Workspace {
  /** The loaded snapshot with any pending reorder already applied. */
  library: LibrarySnapshot
  reordering: boolean
  openDialog: (dialog: LibraryDialog) => void
  reorder: (request: ReorderRequest) => void
  notify: (message: string) => void
}

export const WorkspaceContext = createContext<Workspace | null>(null)

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) throw new Error('useWorkspace must be used inside the library layout.')
  return workspace
}

/** Renders the home, folder, or deck screen for a route inside the library layout. */
export function WorkspaceContent({
  selection,
  filter = 'all',
  onFilter = ignoreFilter,
}: Readonly<{
  selection: Selection
  filter?: StatusFilter
  onFilter?: (filter: StatusFilter) => void
}>) {
  const { library, reordering, openDialog, reorder } = useWorkspace()
  return (
    <LibraryContent
      library={library}
      selection={selection}
      filter={filter}
      reordering={reordering}
      onFilter={onFilter}
      onDialog={openDialog}
      onReorder={reorder}
    />
  )
}

function ignoreFilter() {}
