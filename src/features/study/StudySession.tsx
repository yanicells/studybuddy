import { ArrowLeft, Check, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '../../components/Button'
import { CardText } from '../../components/CardText'
import { Progress } from '../../components/ProgressBars'
import { buildQuestion } from '../../core/quiz'
import { Session } from '../../core/session'
import { applyAnswer } from '../../core/srs'
import type { Card, Question, QuestionStep, Segment } from '../../core/types'
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
  const [stepIndex, setStepIndex] = useState(0)
  const [missed, setMissed] = useState(false)
  const answering = useRef(false)
  const saves = useRef(new Map<number, Promise<void>>())
  const done = question === null
  const step = question?.steps[stepIndex]
  const lastStep = question != null && stepIndex === question.steps.length - 1

  const pick = useCallback(
    (index: number) => {
      const current = question?.steps[stepIndex]
      if (feedback || answering.current || !question || !current || index >= current.choices.length) return
      answering.current = true
      const correct = index === current.answerIndex
      const finished = stepIndex === question.steps.length - 1
      if (!correct) setMissed(true)
      setFeedback({ picked: index, correct })
      if (!finished) return
      const cardCorrect = !missed && correct
      const card = cards.get(question.cardId)
      session.answer(question.cardId, cardCorrect)
      if (card) cards.set(card.id, applyAnswer(card, cardCorrect))
      persistAnswer(saves.current, cards, question.cardId, cardCorrect, onNotice)
    },
    [cards, feedback, missed, onNotice, question, session, stepIndex],
  )

  const continueSession = useCallback(() => {
    if (!feedback || !question) return
    answering.current = false
    setFeedback(null)
    if (stepIndex + 1 < question.steps.length) {
      setStepIndex(stepIndex + 1)
      return
    }
    setStepIndex(0)
    setMissed(false)
    setQuestion(nextQuestion(session, cards))
  }, [cards, feedback, question, session, stepIndex])

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
        pick(index)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [continueSession, feedback, onLeave, pick])

  const roundLength = Math.max(session.roundLength, 1)
  const roundShown =
    feedback && lastStep
      ? session.roundAnswered
      : Math.min(session.roundAnswered + 1, roundLength)
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
                  currentStep={stepIndex}
                  answered={feedback !== null}
                />
                {step ? (
                  <ChoiceList
                    step={step}
                    feedback={feedback}
                    onPick={pick}
                  />
                ) : null}
              </section>
            </div>
            <footer className="study-footer">
              <div className="feedback-copy" aria-live="polite">
                {feedback && step ? (
                  <>
                    <strong className={feedback.correct ? 'is-correct' : 'is-wrong'}>
                      {feedback.correct ? <Check size={18} /> : <X size={18} />}
                      {feedback.correct ? 'Correct' : 'Not quite'}
                    </strong>
                    {lastStep ? (
                      !missed && feedback.correct ? (
                        <span>
                          {session.isWaiting(question.cardId)
                            ? 'It skips the next set and comes back later.'
                            : 'That’s enough for this session.'}
                        </span>
                      ) : !feedback.correct ? (
                        <span>Answer: {step.answer}. Back next round.</span>
                      ) : (
                        <span>Another blank was missed. Back next round.</span>
                      )
                    ) : !feedback.correct ? (
                      <span>Answer: {step.answer}.</span>
                    ) : (
                      <span>Next blank.</span>
                    )}
                  </>
                ) : (
                  <span>Press 1–4 to answer</span>
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
  currentStep,
  answered,
}: Readonly<{ question: Question; currentStep: number; answered: boolean }>) {
  const cloze = question.prompt.kind === 'cloze' ? question.prompt.segments : null
  const clozeFront = question.clozeSide === 'front'
  const clozeBack = question.clozeSide === 'back'
  const cardGraded = answered && currentStep === question.steps.length - 1
  const showAnswer = clozeBack || cardGraded || question.prompt.kind === 'front'

  return (
    <article className="study-card">
      <section>
        {clozeFront && cloze ? (
          <Cloze segments={cloze} currentStep={currentStep} answered={answered} asList={false} />
        ) : (
          <div className="study-card__question">
            <CardText text={question.front} phrases={[]} />
          </div>
        )}
      </section>
      {showAnswer ? (
        <section className="study-card__answer">
          {clozeBack && cloze ? (
            <Cloze segments={cloze} currentStep={currentStep} answered={answered} asList />
          ) : answered && question.back.trim() ? (
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
  currentStep,
  answered,
  asList,
}: Readonly<{ segments: Segment[]; currentStep: number; answered: boolean; asList: boolean }>) {
  const lines = splitSegmentsByLine(segments).map((line) => (asList ? withoutLineBullet(line) : line))
  const total = segments.filter((segment) => segment.kind === 'blank').length
  const items = lines.map((line, lineIndex) => {
    const content = (
      <ClozeLine segments={line} currentStep={currentStep} answered={answered} total={total} />
    )
    return asList ? <li key={lineIndex}>{content}</li> : <p key={lineIndex}>{content}</p>
  })
  return (
    <div className="cloze-passage">
      {asList ? <ul role="list">{items}</ul> : items}
    </div>
  )
}

function ClozeLine({
  segments,
  currentStep,
  answered,
  total,
}: Readonly<{ segments: Segment[]; currentStep: number; answered: boolean; total: number }>) {
  return segments.map((segment, segmentIndex) => {
    if (segment.kind === 'text') {
      return <span key={segmentIndex}>{segment.text}</span>
    }
    const current = segment.step === currentStep
    const filled = segment.step < currentStep || (current && answered)
    if (filled) {
      return (
        <strong key={segmentIndex} className={current ? 'is-target' : ''}>
          {segment.text}
        </strong>
      )
    }
    return (
      <span
        key={segmentIndex}
        className={`cloze-blank ${current ? 'is-target' : ''}`}
        style={{ '--blank-length': Math.min(24, Math.max(6, segment.text.length)) } as React.CSSProperties}
        aria-label={`blank ${segment.step + 1} of ${total}`}
        aria-current={current ? 'true' : undefined}
      />
    )
  })
}

function ChoiceList({
  step,
  feedback,
  onPick,
}: Readonly<{
  step: QuestionStep
  feedback: Feedback | null
  onPick: (index: number) => void
}>) {
  return (
    <div className="choice-list" aria-label="Answer choices">
      {step.choices.map((choice, index) => {
        const correct = feedback !== null && index === step.answerIndex
        const pickedWrong = feedback !== null && index === feedback.picked && !feedback.correct
        return (
          <button
            type="button"
            key={`${index}-${choice}`}
            className={`${correct ? 'is-correct' : ''} ${pickedWrong ? 'is-wrong' : ''}`.trim()}
            onClick={() => onPick(index)}
            disabled={feedback !== null}
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

function persistAnswer(
  queue: Map<number, Promise<void>>,
  cards: Map<number, Card>,
  cardId: number,
  correct: boolean,
  onNotice: (message: string) => void,
) {
  const previous = queue.get(cardId) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(() => recordAnswerFn({ data: { cardId, correct } }))
    .then((updated) => {
      cards.set(updated.id, updated)
    })
    .catch((error: unknown) => {
      onNotice(error instanceof Error ? error.message : 'The answer could not be saved.')
    })
  queue.set(cardId, next)
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

function withoutLineBullet(segments: Segment[]): Segment[] {
  const first = segments[0]
  if (!first || first.kind !== 'text') return segments
  const stripped = first.text.replace(/^[-*]\s+/, '')
  if (stripped === first.text) return segments
  if (!stripped) return segments.slice(1)
  return [{ kind: 'text', text: stripped }, ...segments.slice(1)]
}
