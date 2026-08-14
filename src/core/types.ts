export type Status = 'new' | 'learning' | 'mastered'
export type Side = 'front' | 'back'

export interface Folder {
  id: string
  parentId: string | null
  name: string
  position: number
}

export interface Deck {
  id: string
  folderId: string | null
  name: string
  position: number
}

export interface Highlight {
  side: Side
  text: string
}

export interface NewCard {
  front: string
  back: string
  highlights: Highlight[]
}

export interface Card extends NewCard {
  id: string
  deckId: string
  position: number
  status: Status
  ease: number
  intervalDays: number
  dueAt: string | null
  reps: number
  lapses: number
  streak: number
  learningStep: number
  lastReviewedAt: string | null
}

export interface DeckStats {
  new: number
  learning: number
  mastered: number
  due: number
}

export interface StudyStats {
  due: number
  reviewedToday: number
  streak: number
}

export interface LibrarySnapshot {
  folders: Folder[]
  decks: Deck[]
  cardsByDeck: Record<string, Card[]>
  statsByDeck: Record<string, DeckStats>
  study: StudyStats
}

export interface TextSegment {
  kind: 'text'
  text: string
}

export interface BlankSegment {
  kind: 'blank'
  text: string
  step: number
}

export type Segment = TextSegment | BlankSegment

export type Prompt =
  | { kind: 'cloze'; segments: Segment[] }
  | { kind: 'front'; text: string }

export interface QuestionStep {
  answer: string
  choices: string[]
  answerIndex: number
}

export interface Question {
  cardId: string
  front: string
  back: string
  prompt: Prompt
  clozeSide: Side | null
  steps: QuestionStep[]
}

export const EMPTY_STATS: DeckStats = {
  new: 0,
  learning: 0,
  mastered: 0,
  due: 0,
}

export function isDue(card: Card, now = new Date()): boolean {
  if (card.status === 'new' || card.dueAt === null) return true
  return new Date(card.dueAt).getTime() <= now.getTime()
}
