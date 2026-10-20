import { useEffect, useEffectEvent } from 'react'

/**
 * Calls onOpen on ⌘K / Ctrl+K, or on "/" when the user isn't typing somewhere.
 * Does nothing while disabled, e.g. during study or when another dialog is open.
 */
export function useSearchShortcut(enabled: boolean, onOpen: () => void) {
  const open = useEffectEvent(() => onOpen())

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey) return
      const commandK = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.shiftKey
      const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !isTyping(event.target)
      if (!commandK && !slash) return
      event.preventDefault()
      open()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select') !== null)
  )
}
