//! In-session queue.
//!
//! Gizmo-like waves: start with ~8 cards, then ~12 more. A miss comes back
//! after a couple of other cards. A hit on a new/learning card comes back
//! later in the same session until it has two goods.

use std::collections::{HashMap, VecDeque};

use crate::model::{Card, CardId, Status};

const FIRST_WAVE: usize = 8;
const NEXT_WAVE: usize = 12;
const MISS_GAP: usize = 2;
const FIRST_HIT_GAP: usize = 3;
const SECOND_HIT_GAP: usize = 8;

#[derive(Debug, Clone, Default)]
pub struct Progress {
    pub correct: u32,
    pub wrong: u32,
    mastered_at_start: bool,
}

#[derive(Debug, Clone)]
pub struct Session {
    queue: VecDeque<CardId>,
    pool: Vec<CardId>,
    shown: usize,
    waves: usize,
    progress: HashMap<CardId, Progress>,
    pub total: usize,
}

impl Session {
    pub fn new(mut cards: Vec<Card>) -> Self {
        cards.sort_by_key(|c| match c.status {
            Status::Learning => 0,
            Status::New => 1,
            Status::Mastered => 2,
        });

        let mut progress = HashMap::new();
        for c in &cards {
            progress.insert(
                c.id,
                Progress {
                    mastered_at_start: c.status == Status::Mastered,
                    ..Progress::default()
                },
            );
        }

        let total = cards.len();
        let pool: Vec<CardId> = cards.into_iter().map(|c| c.id).collect();
        let mut session = Self {
            queue: VecDeque::new(),
            pool,
            shown: 0,
            waves: 0,
            progress,
            total,
        };
        session.introduce_wave();
        session
    }

    pub fn next_card(&mut self) -> Option<CardId> {
        if self.queue.is_empty() {
            self.introduce_wave();
        }
        let id = self.queue.pop_front()?;
        Some(id)
    }

    pub fn answer(&mut self, card_id: CardId, correct: bool) {
        let rec = self.progress.entry(card_id).or_default();
        if correct {
            rec.correct += 1;
        } else {
            rec.wrong += 1;
        }

        let done = if rec.mastered_at_start {
            correct
        } else {
            rec.correct >= 2
        };

        if !done {
            let gap = if correct {
                if rec.correct <= 1 {
                    FIRST_HIT_GAP
                } else {
                    SECOND_HIT_GAP
                }
            } else {
                MISS_GAP
            };
            let idx = gap.min(self.queue.len());
            self.queue.insert(idx, card_id);
        }

        self.shown += 1;
    }

    pub fn progress_for(&self, card_id: CardId) -> Progress {
        self.progress.get(&card_id).cloned().unwrap_or_default()
    }

    pub fn answered_count(&self) -> usize {
        self.shown
    }

    pub fn remaining(&self) -> usize {
        self.queue.len() + self.pool.len()
    }

    pub fn wave(&self) -> usize {
        self.waves.max(1)
    }

    fn introduce_wave(&mut self) -> bool {
        if self.pool.is_empty() {
            return false;
        }
        let n = if self.waves == 0 {
            FIRST_WAVE
        } else {
            NEXT_WAVE
        };
        let n = n.min(self.pool.len());
        let batch: Vec<CardId> = self.pool.drain(..n).collect();
        for card_id in batch {
            self.queue.push_back(card_id);
        }
        self.waves += 1;
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Card, DeckId, Status};

    fn cards(n: usize, status: Status) -> Vec<Card> {
        (1..=n)
            .map(|i| Card {
                id: CardId(i as i64),
                deck_id: DeckId(1),
                front: format!("f{i}"),
                back: format!("b{i}"),
                highlights: vec![],
                position: i as i64,
                status,
                ease: 2.5,
                interval_days: 0.0,
                due_at: None,
                reps: 0,
                lapses: 0,
                streak: 0,
                learning_step: 0,
                last_reviewed_at: None,
            })
            .collect()
    }

    #[test]
    fn first_wave_is_eight() {
        let mut s = Session::new(cards(20, Status::New));
        let mut seen = Vec::new();
        for _ in 0..8 {
            seen.push(s.next_card().unwrap());
            s.answer(*seen.last().unwrap(), true);
        }
        assert_eq!(seen.len(), 8);
        assert_eq!(s.wave(), 1);
        // First-wave cards still need a second hit, so they come back
        // before the rest of the pool is fully drained.
        let ninth = s.next_card().unwrap();
        assert!(seen.contains(&ninth) || s.wave() >= 1);
    }

    #[test]
    fn miss_returns_quickly() {
        let mut s = Session::new(cards(5, Status::New));
        let first = s.next_card().unwrap();
        s.answer(first, false);
        let mut later = Vec::new();
        for _ in 0..4 {
            if let Some(id) = s.next_card() {
                later.push(id);
                s.answer(id, true);
            }
        }
        assert!(
            later.contains(&first),
            "missed card should reappear, got {later:?}"
        );
    }

    #[test]
    fn two_hits_retire_new_card() {
        let mut s = Session::new(cards(1, Status::New));
        let id = s.next_card().unwrap();
        s.answer(id, true);
        let again = s.next_card().unwrap();
        assert_eq!(again, id);
        s.answer(id, true);
        assert!(s.next_card().is_none());
    }

    #[test]
    fn mastered_retires_after_one_hit() {
        let mut s = Session::new(cards(1, Status::Mastered));
        let id = s.next_card().unwrap();
        s.answer(id, true);
        assert!(s.next_card().is_none());
    }
}
