import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react'

const MENU_OPEN_EVENT = 'studybuddy:menu-open'

interface SummaryDrag {
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
}

interface OverflowMenuProps {
  label: string
  icon: ReactNode
  className?: string
  children: ReactNode
  summaryDrag?: SummaryDrag
}

/**
 * Controlled `<details>` menu that keeps existing `.actions-menu` styles
 * while dismissing on outside pointer-down, Escape, or item selection.
 */
export function OverflowMenu({ label, icon, className = '', children, summaryDrag }: OverflowMenuProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const menuRef = useRef<HTMLDetailsElement>(null)
  const lastDragEnd = useRef(0)

  useEffect(() => {
    function closeOthers(event: Event) {
      if ((event as CustomEvent<string>).detail !== menuId) setOpen(false)
    }
    window.addEventListener(MENU_OPEN_EVENT, closeOthers)
    return () => window.removeEventListener(MENU_OPEN_EVENT, closeOthers)
  }, [menuId])

  useEffect(() => {
    if (!open) return
    window.dispatchEvent(new CustomEvent(MENU_OPEN_EVENT, { detail: menuId }))
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuId, open])

  return (
    <details
      ref={menuRef}
      className={className}
      open={open}
      onToggle={(event) => {
        // Keep React state as the source of truth when the browser
        // toggles the element (e.g. keyboard activation edge cases).
        event.preventDefault()
      }}
    >
      <summary
        aria-label={label}
        aria-expanded={open}
        draggable={Boolean(summaryDrag)}
        onDragStart={summaryDrag?.onDragStart}
        onDragEnd={(event) => {
          event.stopPropagation()
          lastDragEnd.current = Date.now()
          summaryDrag?.onDragEnd()
        }}
        onClick={(event) => {
          event.preventDefault()
          // A drag ending on the handle also fires click; ignore it.
          if (Date.now() - lastDragEnd.current < 300) return
          setOpen((current) => !current)
        }}
      >
        {icon}
      </summary>
      <div
        onClick={() => {
          setOpen(false)
        }}
      >
        {children}
      </div>
    </details>
  )
}
