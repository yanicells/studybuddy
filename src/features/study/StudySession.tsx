import { ArrowLeft, Check, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '../../components/Button'
import { CardText } from '../../components/CardText'
import { Progress } from '../../components/ProgressBars'
import { buildQuestion } from '../../core/quiz'
import { Session } from '../../core/session'
import type { Card, Question, Segment } from '../../core/types'
import { recordAnswerFn } from '../library/library.functions'

interface StudySessionProps {
  deckName: string
  dueCards: Card[]
  deckCards: Card[]
  onLeave: () => void
  onNotice: (message: string) => void
}

interface Feedback {
  picked: number
  correct: boolean
}

export function StudySession({
  deckName,
  dueCards,
  deckCards,
  onLeave,
  onNotice,
}: StudySessionProps) {
  const [session] = useState(() => new Session(dueCards))
  const [cards] = useState(() => new Map(deckCards.map((card) => [card.id, card])))
  const [question, setQuestion] = useState<Question | null>(() => nextQuestion(session, cards))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [pending, setPending] = useState(false)
  const done = question === null

  const pick = useCallback(
    async (index: number) => {
      if (feedback || pending || !question || index >= question.choices.length) return
      const correct = index === question.answerIndex
      setPending(true)
      try {
        const updated = await recordAnswerFn({
          data: { cardId: question.cardId, correct },
        })
        cards.set(updated.id, updated)
        session.answer(question.cardId, correct)
        setFeedback({ picked: index, correct })
      } catch (error) {
        onNotice(error instanceof Error ? error.message : 'The answer could not be saved.')
      } finally {
        setPending(false)
      }
    },
    [cards, feedback, onNotice, pending, question, session],
  )

  const continueSession = useCallback(() => {
    if (!feedback) return
    setFeedback(null)
    setQuestion(nextQuestion(session, cards))
  }, [cards, feedback, session])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onLeave()
        return
      }
      if (feedback && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        continueSession()
        return
      }
      const index = Number(event.key) - 1
      if (!feedback && index >= 0 && index <= 3) {
        event.preventDefault()
        void pick(index)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [continueSession, feedback, onLeave, pick])

  const roundLength = Math.max(session.roundLength, 1)
  const roundShown = feedback ? session.roundAnswered : Math.min(session.roundAnswered + 1, roundLength)
  const progress = done ? 1 : roundShown / roundLength

  return (
    <main className="study-shell">
      <div className="study-column">
        <header className="study-header">
          <Button variant="ghost" size="small" icon={<ArrowLeft size={17} />} onClick={onLeave}>
            Leave
          </Button>
          <div className="study-header__copy">
            <strong>{deckName}</strong>
            {done ? (
              <span>{session.completed} {session.completed === 1 ? 'card' : 'cards'} · {session.round} {session.round === 1 ? 'round' : 'rounds'}</span>
            ) : (
              <span>Round {session.round} · {roundShown} of {roundLength}</span>
            )}
          </div>
        </header>
        <Progress
          value={progress}
          label={done ? 'Session complete' : `Round ${session.round}, ${roundShown} of ${roundLength}`}
        />

        {done ? (
          <section className="study-complete">
            <div className="complete-card">
              <h1>Session complete</h1>
              <p>
                {session.completed} {session.completed === 1 ? 'card is' : 'cards are'} done for now.
                Misses will come back sooner; anything you confirmed can wait until its next due day.
              </p>
              <Button variant="primary" onClick={onLeave}>Back to deck</Button>
            </div>
          </section>
        ) : (
          <>
            <div className="study-scroll">
              <section className="study-stage">
                <StudyCard
                  question={question}
                  revealed={feedback !== null}
                />
                <ChoiceList
                  question={question}
                  feedback={feedback}
                  pending={pending}
                  onPick={pick}
                />
              </section>
            </div>
            <footer className="study-footer">
              <div className="feedback-copy" aria-live="polite">
                {feedback ? (
                  <>
                    <strong className={feedback.correct ? 'is-correct' : 'is-wrong'}>
                      {feedback.correct ? <Check size={18} /> : <X size={18} />}
                      {feedback.correct ? 'Correct' : 'Not quite'}
                    </strong>
                    {!feedback.correct ? (
                      <span>Answer: {question.answer}. Back next round.</span>
                    ) : (
                      <span>
                        {session.isWaiting(question.cardId)
                          ? 'It skips the next set and comes back later.'
                          : 'That’s enough for this session.'}
                      </span>
                    )}
                  </>
                ) : (
                  <span>{pending ? 'Saving answer…' : 'Press 1–4 to answer'}</span>
                )}
              </div>
              {feedback ? (
                <Button variant="primary" onClick={continueSession}>Continue</Button>
              ) : null}
            </footer>
          </>
        )}
      </div>
    </main>
  )
}

function StudyCard({
  question,
  revealed,
}: Readonly<{ question: Question; revealed: boolean }>) {
  const cloze = question.prompt.kind === 'cloze' ? question.prompt.segments : null
  const clozeFront = question.clozeSide === 'front'
  const clozeBack = question.clozeSide === 'back'
  const showAnswer = clozeBack || revealed || question.prompt.kind === 'front'

  return (
    <article className="study-card">
      <section>
        {clozeFront && cloze ? (
          <Cloze segments={cloze} revealed={revealed} />
        ) : (
          <div className="study-card__question">
            <CardText text={question.front} phrases={[]} />
          </div>
        )}
      </section>
      {showAnswer ? (
        <section className="study-card__answer">
          {clozeBack && cloze ? (
            <Cloze segments={cloze} revealed={revealed} />
          ) : revealed && question.back.trim() ? (
            <CardText text={question.back} phrases={[]} asBack />
          ) : (
            <p className="answer-placeholder">Pick the matching answer.</p>
          )}
        </section>
      ) : null}
    </article>
  )
}

function Cloze({
  segments,
  revealed,
}: Readonly<{ segments: Segment[]; revealed: boolean }>) {
  const lines = splitSegmentsByLine(segments)
  return (
    <div className="cloze-passage">
      {lines.map((line, lineIndex) => (
        <p key={lineIndex}>
          {line.map((segment, segmentIndex) =>
            segment.kind === 'text' ? (
              <span key={segmentIndex}>{segment.text}</span>
            ) : revealed ? (
              <strong key={segmentIndex} className={segment.target ? 'is-target' : ''}>{segment.text}</strong>
            ) : (
              <span
                key={segmentIndex}
                className={`cloze-blank ${segment.target ? 'is-target' : ''}`}
                style={{ '--blank-length': Math.min(24, Math.max(6, segment.text.length)) } as React.CSSProperties}
                aria-label="blank"
              />
            ),
          )}
        </p>
      ))}
    </div>
  )
}

function ChoiceList({
  question,
  feedback,
  pending,
  onPick,
}: Readonly<{
  question: Question
  feedback: Feedback | null
  pending: boolean
  onPick: (index: number) => Promise<void>
}>) {
  return (
    <div className="choice-list" aria-label="Answer choices">
      {question.choices.map((choice, index) => {
        const correct = feedback !== null && index === question.answerIndex
        const pickedWrong = feedback !== null && index === feedback.picked && !feedback.correct
        return (
          <button
            type="button"
            key={`${index}-${choice}`}
            className={`${correct ? 'is-correct' : ''} ${pickedWrong ? 'is-wrong' : ''}`.trim()}
            onClick={() => void onPick(index)}
            disabled={feedback !== null || pending}
          >
            <span>{index + 1}</span>
            <p>{choice}</p>
            {correct ? <Check size={18} aria-label="Correct answer" /> : null}
            {pickedWrong ? <X size={18} aria-label="Your answer" /> : null}
          </button>
        )
      })}
    </div>
  )
}

function nextQuestion(session: Session, cards: Map<number, Card>): Question | null {
  const id = session.nextCard()
  if (id === null) return null
  const card = cards.get(id)
  return card ? buildQuestion(card, [...cards.values()]) : null
}

function splitSegmentsByLine(segments: Segment[]): Segment[][] {
  const lines: Segment[][] = [[]]
  for (const segment of segments) {
    if (segment.kind === 'blank') {
      lines.at(-1)!.push(segment)
      continue
    }
    const parts = segment.text.split('\n')
    parts.forEach((part, index) => {
      if (part) lines.at(-1)!.push({ kind: 'text', text: part })
      if (index < parts.length - 1) lines.push([])
    })
  }
  return lines.filter((line) => line.length > 0)
}
