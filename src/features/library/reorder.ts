import type { DragEvent } from 'react'

export type ReorderKind = 'folder' | 'deck'

export interface ReorderRequest {
  kind: ReorderKind
  parentId: string | null
  orderedIds: string[]
}

interface DragPayload {
  kind: ReorderKind
  id: string
}

const DRAG_MIME = 'application/x-studybuddy-reorder'

/** Move one sibling up (delta -1) or down (delta +1). Returns null at the edges. */
export function moveSibling(ids: string[], id: string, delta: -1 | 1): string[] | null {
  const from = ids.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= ids.length) return null
  const next = [...ids]
  next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}

/** Drop the dragged sibling before (after=false) or after (after=true) the target. */
export function dropSibling(
  ids: string[],
  draggedId: string,
  targetId: string,
  after: boolean,
): string[] | null {
  if (draggedId === targetId) return null
  if (!ids.includes(draggedId) || !ids.includes(targetId)) return null
  const rest = ids.filter((id) => id !== draggedId)
  const targetIndex = rest.indexOf(targetId)
  rest.splice(after ? targetIndex + 1 : targetIndex, 0, draggedId)
  return rest
}

export function startReorderDrag(event: DragEvent, payload: DragPayload): void {
  event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = 'move'
}

export function readReorderDrag(event: DragEvent, kind: ReorderKind): string | null {
  if (!event.dataTransfer.types.includes(DRAG_MIME)) return null
  try {
    const payload = JSON.parse(event.dataTransfer.getData(DRAG_MIME)) as DragPayload
    if (payload?.kind !== kind || typeof payload.id !== 'string') return null
    return payload.id
  } catch {
    return null
  }
}

/** True when the pointer is in the lower half: the drop goes after the target. */
export function isDropAfter(event: DragEvent, element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return event.clientY > rect.top + rect.height / 2
}
