import { AppIcon } from './AppIcon'

const TREE_WIDTHS = ['70%', '84%', '58%', '76%', '63%', '80%', '52%']
const TILE_COUNT = 3
const CHOICE_COUNT = 4

export function LibraryPending() {
  return (
    <main className="app-shell" aria-busy="true">
      <span className="sr-only" role="status">Loading library</span>
      <aside className="library-rail" aria-hidden="true">
        <div className="rail-brand">
          <span className="rail-home">
            <AppIcon />
            <strong>StudyBuddy</strong>
          </span>
        </div>
        <nav className="library-tree">
          {TREE_WIDTHS.map((width) => (
            <div className="tree-row tree-row--pending" key={width}>
              <span className="skeleton skeleton--icon" />
              <span className="skeleton skeleton--tree-label" style={{ width }} />
            </div>
          ))}
        </nav>
      </aside>
      <section className="workspace" aria-hidden="true">
        <div className="workspace-column">
          <header className="workspace-header">
            <div className="workspace-title">
              <span className="skeleton skeleton--title" />
            </div>
            <div className="header-actions">
              <span className="skeleton skeleton--button" />
              <span className="skeleton skeleton--button" />
            </div>
          </header>
          <div className="workspace-scroll">
            <section className="home">
              <div className="home-today">
                <span className="skeleton skeleton--due" />
                <span className="skeleton skeleton--meta" />
              </div>
              <div className="folder-grid">
                {Array.from({ length: TILE_COUNT }, (_, index) => (
                  <span className="skeleton skeleton--tile" key={index} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}

export function StudyPending({ name }: Readonly<{ name: string }>) {
  return (
    <main className="study-shell" aria-busy="true">
      <span className="sr-only" role="status">Starting study for {name}</span>
      <div className="study-column" aria-hidden="true">
        <header className="study-header">
          <span className="skeleton skeleton--button" />
          <div className="study-header__copy">
            <strong>{name}</strong>
            <span className="skeleton skeleton--caption" />
          </div>
        </header>
        <span className="skeleton skeleton--progress" />
        <div className="study-scroll">
          <section className="study-stage" aria-hidden="true">
            <span className="skeleton skeleton--study-card" />
            <div className="choice-list">
              {Array.from({ length: CHOICE_COUNT }, (_, index) => (
                <span className="skeleton skeleton--choice" key={index} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
