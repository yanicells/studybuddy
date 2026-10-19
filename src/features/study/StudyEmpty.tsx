import { ArrowLeft, Layers3 } from 'lucide-react'

import { Button } from '../../components/Button'

/** Shown when a study link resolves to no cards, e.g. nothing is due yet. */
export function StudyEmpty({
  name,
  backLabel,
  onBack,
  onStudyAll,
}: Readonly<{
  name: string
  backLabel: string
  onBack: () => void
  /** Offered when only due cards were requested. */
  onStudyAll?: () => void
}>) {
  return (
    <main className="study-shell">
      <div className="study-column">
        <section className="study-complete">
          <div className="complete-card">
            <h1>{onStudyAll ? 'Nothing due right now' : 'No cards to study'}</h1>
            <p>
              {onStudyAll
                ? `Every card in ${name} is scheduled for later. You can still review the full set.`
                : `${name} has no cards yet. Add or import some first.`}
            </p>
            <div className="complete-card__actions">
              <Button icon={<ArrowLeft size={17} />} onClick={onBack}>{backLabel}</Button>
              {onStudyAll ? (
                <Button variant="primary" icon={<Layers3 size={17} />} onClick={onStudyAll}>
                  Study all cards
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
