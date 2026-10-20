import { ArrowLeft, Check, ChevronLeft, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { Button } from '../../components/Button'
import { CardText } from '../../components/CardText'
import { Progress } from '../../components/ProgressBars'
import { buildQuestion } from '../../core/quiz'
import { Session, summarizeResults, type CardResult, type SessionSummary } from '../../core/session'
import { applyAnswer } from '../../core/srs'
import type { Card, Question, QuestionStep, Segment } from '../../core/types'
import { recordAnswerFn } from '../library/library.functions'

interface StudySessionProps {
  deckName: string
  backLabel?: string
  dueCards: Card[]
  deckCards: Card[]
  onLeave: () => void
  /**
   * Called after the session unmounts and its in-flight answers have saved, e.g. to refresh
   * library stats. Pass a stable callback.
   */
  onExit?: () => void
}

interface Feedback {
  picked: number
  correct: boolean
}

/** An answered step exactly as it was shown, so the learner can look back at it. */
interface AnsweredStep {
  question: Question
  stepIndex: number
  feedback: Feedback
  note: string
}

/**
 * A study session over the due cards. "Study misses again" swaps in a fresh round of just the
 * missed cards; the card map and save queue live here so they carry across rounds.
 */
export function StudySession({
  deckName,
  backLabel = 'Back to deck',
  dueCards,
  deckCards,
  onLeave,
  onExit,
}: StudySessionProps) {
  const [cards] = useState(() => new Map(deckCards.map((card) => [card.id, card])))
  const [round, setRound] = useState({ key: 0, dueCards })
  const saves = useRef(new Map<string, Promise<void>>())
  // Answers whose save failed, kept until a retry succeeds.
  const [unsaved, setUnsaved] = useState<CardResult[]>([])

  const saveAnswer = useCallback(
    (answer: CardResult) =>
      persistAnswer(saves.current, cards, answer, () => setUnsaved((failed) => [...failed, answer])),
    [cards],
  )

  const retrySaves = useCallback(() => {
    setUnsaved((failed) => failed.filter((answer) => !unsaved.includes(answer)))
    for (const answer of unsaved) saveAnswer(answer)
  }, [saveAnswer, unsaved])

  const studyAgain = useCallback(
    (cardIds: string[]) => {
      const again = cardIds.flatMap((id) => cards.get(id) ?? [])
      setRound((current) => ({ key: current.key + 1, dueCards: again }))
    },
    [cards],
  )

  useEffect(() => {
    const queue = saves.current
    return () => {
      void Promise.allSettled(queue.values()).then(() => onExit?.())
    }
  }, [onExit])

  return (
    <StudyRound
      key={round.key}
      deckName={deckName}
      backLabel={backLabel}
      dueCards={round.dueCards}
      cards={cards}
      onLeave={onLeave}
      onAnswer={saveAnswer}
      onStudyAgain={studyAgain}
      banner={
        unsaved.length > 0 ? <UnsavedBanner count={unsaved.length} onRetry={retrySaves} /> : null
      }
    />
  )
}

interface StudyRoundProps {
  deckName: string
  backLabel: string
  dueCards: Card[]
  /** Every deck card by id, updated in place as answers are graded and saved. */
  cards: Map<string, Card>
  onLeave: () => void
  onAnswer: (answer: CardResult) => void
  onStudyAgain: (cardIds: string[]) => void
  /** Shown under the progress bar on both the live card and the complete screen. */
  banner: ReactNode
}

function StudyRound({
  deckName,
  backLabel,
  dueCards,
  cards,
  onLeave,
  onAnswer,
  onStudyAgain,
  banner,
}: StudyRoundProps) {
  const [session] = useState(() => new Session(dueCards))
  const [question, setQuestion] = useState<Question | null>(() => nextQuestion(session, cards))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [missed, setMissed] = useState(false)
  const [history, setHistory] = useState<AnsweredStep[]>([])
  const [results, setResults] = useState<CardResult[]>([])
  // Index into history while looking back; null shows the live card.
  const [reviewIndex, setReviewIndex] = useState<number | null>(null)
  const answering = useRef(false)
  const done = question === null
  const step = question?.steps[stepIndex]
  const lastStep = question != null && stepIndex === question.steps.length - 1
  const reviewing = reviewIndex === null ? null : history[reviewIndex] ?? null

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
      const result = { cardId: question.cardId, correct: cardCorrect }
      setResults((graded) => [...graded, result])
      onAnswer(result)
    },
    [cards, feedback, missed, onAnswer, question, session, stepIndex],
  )

  const continueSession = useCallback(() => {
    const current = question?.steps[stepIndex]
    if (!feedback || !question || !current) return
    const note = feedbackNote(current, feedback, {
      lastStep: stepIndex === question.steps.length - 1,
      missed,
      waiting: session.isWaiting(question.cardId),
    })
    setHistory((answered) => [...answered, { question, stepIndex, feedback, note }])
    answering.current = false
    setFeedback(null)
    if (stepIndex + 1 < question.steps.length) {
      setStepIndex(stepIndex + 1)
      return
    }
    setStepIndex(0)
    setMissed(false)
    setQuestion(nextQuestion(session, cards))
  }, [cards, feedback, missed, question, session, stepIndex])

  const showPrevious = useCallback(() => {
    if (history.length === 0) return
    setReviewIndex((index) => (index === null ? history.length - 1 : Math.max(0, index - 1)))
  }, [history.length])

  // Moving past the newest answered step returns to the live card.
  const showNext = useCallback(() => {
    setReviewIndex((index) => (index === null || index + 1 >= history.length ? null : index + 1))
  }, [history.length])

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
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        showPrevious()
        return
      }
      if (reviewing) {
        if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          showNext()
        }
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
  }, [continueSession, feedback, onLeave, pick, reviewing, showNext, showPrevious])

  const roundLength = Math.max(session.roundLength, 1)
  const roundShown =
    feedback && lastStep
      ? session.roundAnswered
      : Math.min(session.roundAnswered + 1, roundLength)
  const progress = done ? 1 : roundShown / roundLength
  const view = reviewing ?? (question ? { question, stepIndex, feedback } : null)
  const viewStep = view?.question.steps[view.stepIndex]
  const previousButton = history.length > 0 ? (
    <Button
      variant="ghost"
      size="small"
      className="study-previous"
      icon={<ChevronLeft size={17} />}
      aria-label="Previous answer"
      disabled={reviewIndex === 0}
      onClick={showPrevious}
    >
      <span className="study-previous__label">Previous</span>
    </Button>
  ) : null

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
        {banner}

        {!view ? (
          <SessionComplete
            completed={session.completed}
            summary={summarizeResults(results)}
            cards={cards}
            backLabel={backLabel}
            onLeave={onLeave}
            onLookBack={history.length > 0 ? showPrevious : undefined}
            onStudyAgain={onStudyAgain}
          />
        ) : (
          <>
            <div className="study-scroll">
              <section className="study-stage">
                <StudyCard
                  question={view.question}
                  currentStep={view.stepIndex}
                  answered={view.feedback !== null}
                />
                {viewStep ? (
                  <ChoiceList
                    step={viewStep}
                    feedback={view.feedback}
                    onPick={pick}
                  />
                ) : null}
              </section>
            </div>
            <footer className="study-footer">
              <div className="study-footer__lead">
                {previousButton}
                <div className="feedback-copy" aria-live="polite">
                  {reviewing ? (
                    <FeedbackCopy feedback={reviewing.feedback} note={`Looking back. ${reviewing.note}`} />
                  ) : feedback && step && question ? (
                    <FeedbackCopy
                      feedback={feedback}
                      note={feedbackNote(step, feedback, {
                        lastStep,
                        missed,
                        waiting: session.isWaiting(question.cardId),
                      })}
                    />
                  ) : (
                    <span>Press 1–4 to answer</span>
                  )}
                </div>
              </div>
              {reviewing ? (
                <Button variant="primary" onClick={showNext}>Next</Button>
              ) : feedback ? (
                <Button variant="primary" onClick={continueSession}>Continue</Button>
              ) : null}
            </footer>
          </>
        )}
      </div>
    </main>
  )
}

/** End-of-round summary: first-try accuracy, the cards missed, and a way to drill them again. */
function SessionComplete({
  completed,
  summary,
  cards,
  backLabel,
  onLeave,
  onLookBack,
  onStudyAgain,
}: Readonly<{
  completed: number
  summary: SessionSummary
  cards: Map<string, Card>
  backLabel: string
  onLeave: () => void
  onLookBack?: () => void
  onStudyAgain: (cardIds: string[]) => void
}>) {
  const missedCards = summary.missedIds.flatMap((id) => cards.get(id) ?? [])
  return (
    <section className="study-complete">
      <div className="complete-card">
        <h1>Session complete</h1>
        {summary.studied > 0 ? (
          <p className="complete-card__score">
            {summary.firstTry} of {summary.studied} right on the first try
          </p>
        ) : null}
        <p>
          {completed} {completed === 1 ? 'card is' : 'cards are'} done for now.
          Misses will come back sooner; anything you confirmed can wait until its next due day.
        </p>
        {missedCards.length > 0 ? (
          <div className="complete-misses">
            <h2>Missed this session</h2>
            <ul role="list">
              {missedCards.map((card) => (
                <li key={card.id}>
                  <CardText text={card.front} phrases={[]} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="complete-card__actions">
          <Button variant="primary" onClick={onLeave}>{backLabel}</Button>
          {missedCards.length > 0 ? (
            <Button
              icon={<RotateCcw size={16} />}
              onClick={() => onStudyAgain(missedCards.map((card) => card.id))}
            >
              Study misses again
            </Button>
          ) : null}
          {onLookBack ? (
            <Button variant="ghost" icon={<ChevronLeft size={17} />} onClick={onLookBack}>
              Look back
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

/** Stays up while any answer is unsaved, unlike the auto-dismissing workspace notice. */
function UnsavedBanner({ count, onRetry }: Readonly<{ count: number; onRetry: () => void }>) {
  return (
    <div className="study-unsaved" role="alert">
      <span>{count} {count === 1 ? 'answer' : 'answers'} couldn’t be saved.</span>
      <Button size="small" icon={<RotateCcw size={15} />} onClick={onRetry}>Retry</Button>
    </div>
  )
}

function FeedbackCopy({ feedback, note }: Readonly<{ feedback: Feedback; note: string }>) {
  return (
    <>
      <strong className={feedback.correct ? 'is-correct' : 'is-wrong'}>
        {feedback.correct ? <Check size={18} /> : <X size={18} />}
        {feedback.correct ? 'Correct' : 'Not quite'}
      </strong>
      <span>{note}</span>
    </>
  )
}

/** What happens next after an answer: the correct answer on a miss, or when the card returns. */
function feedbackNote(
  step: QuestionStep,
  feedback: Feedback,
  { lastStep, missed, waiting }: { lastStep: boolean; missed: boolean; waiting: boolean },
): string {
  if (!lastStep) return feedback.correct ? 'Next blank.' : `Answer: ${step.answer}.`
  if (!feedback.correct) return `Answer: ${step.answer}. Back next round.`
  if (missed) return 'Another blank was missed. Back next round.'
  return waiting ? 'It skips the next set and comes back later.' : 'That’s enough for this session.'
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

/** Saves an answer behind any earlier save for the same card; failures go to onFailed. */
function persistAnswer(
  queue: Map<string, Promise<void>>,
  cards: Map<string, Card>,
  answer: CardResult,
  onFailed: () => void,
) {
  const previous = queue.get(answer.cardId) ?? Promise.resolve()
  const next = previous
    .then(() => recordAnswerFn({ data: { cardId: answer.cardId, correct: answer.correct } }))
    .then((updated) => {
      cards.set(updated.id, updated)
    })
    .catch(onFailed)
  queue.set(answer.cardId, next)
}

function nextQuestion(session: Session, cards: Map<string, Card>): Question | null {
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
