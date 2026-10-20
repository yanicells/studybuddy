import { FileText, Folder, Layers3 } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'

import { Dialog } from '../../components/Dialog'
import { HighlightedText } from '../../components/HighlightedText'
import { searchLibrary, type SearchResult } from '../../core/search'
import type { LibrarySnapshot } from '../../core/types'
import type { Selection } from '../library/library.types'

interface QuickSearchProps {
  library: LibrarySnapshot
  onClose: () => void
  onSelect: (selection: Selection) => void
}

/**
 * Search dialog over the loaded library. Typing filters instantly; ↑/↓ move the
 * active result, Enter or a click opens it. Cards open their deck.
 */
export function QuickSearch({ library, onClose, onSelect }: Readonly<QuickSearchProps>) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const results = useMemo(() => searchLibrary(library, query), [library, query])
  const listId = useId()
  const optionId = (index: number) => `${listId}-${index}`
  const activeIndex = Math.min(active, results.length - 1)

  useEffect(() => {
    if (activeIndex < 0) return
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex, listId])

  function open(result: SearchResult) {
    onClose()
    onSelect(selectionFor(result))
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + step + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      open(results[activeIndex]!)
    }
  }

  const phrase = query.trim()
  return (
    <Dialog title="Search" onClose={onClose} wide>
      <div className="quick-search">
        <input
          data-autofocus
          type="search"
          role="combobox"
          aria-label="Search folders, decks, and cards"
          aria-autocomplete="list"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          placeholder="Folders, decks, and cards"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
        <ul id={listId} role="listbox" aria-label="Results" className="quick-search__results">
          {results.map((result, index) => (
            <li
              key={`${result.kind}-${result.id}`}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              onMouseMove={() => {
                if (index !== activeIndex) setActive(index)
              }}
              onClick={() => open(result)}
            >
              <ResultIcon kind={result.kind} />
              <span>
                <span className="quick-search__label">
                  <HighlightedText text={result.kind === 'card' ? result.snippet : result.name} phrases={[phrase]} />
                </span>
                <small>{resultContext(result)}</small>
              </span>
            </li>
          ))}
        </ul>
        {phrase && results.length === 0 ? <p className="quick-search__empty">No matches for “{phrase}”.</p> : null}
      </div>
    </Dialog>
  )
}

function selectionFor(result: SearchResult): Selection {
  if (result.kind === 'folder') return { kind: 'folder', id: result.id }
  return { kind: 'deck', id: result.kind === 'card' ? result.deckId : result.id }
}

function resultContext(result: SearchResult): string {
  if (result.kind === 'card') return `Card · ${result.deckName}`
  return `${result.kind === 'folder' ? 'Folder' : 'Deck'} · ${result.path}`
}

function ResultIcon({ kind }: Readonly<{ kind: SearchResult['kind'] }>) {
  if (kind === 'folder') return <Folder size={16} aria-hidden="true" />
  if (kind === 'deck') return <Layers3 size={16} aria-hidden="true" />
  return <FileText size={16} aria-hidden="true" />
}
