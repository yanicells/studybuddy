//! Between-session scheduling.
//!
//! Inspired by Anki's SM-2, tuned for short course crams:
//! new cards graduate after two good answers, first interval is 1 day,
//! then 3 days, then `interval * ease`.

use chrono::{DateTime, Duration, Utc};

use crate::model::{Card, Status};

pub fn apply_answer(card: &mut Card, correct: bool, now: DateTime<Utc>) {
    card.last_reviewed_at = Some(now);
    card.reps += 1;

    if !correct {
        card.lapses += 1;
        card.streak = 0;
        card.learning_step = 0;
        card.status = Status::Learning;
        card.interval_days = 0.0;
        card.due_at = Some(now);
        card.ease = (card.ease - 0.2).max(1.3);
        return;
    }

    card.streak += 1;

    match card.status {
        Status::New | Status::Learning => {
            card.status = Status::Learning;
            card.learning_step += 1;
            if card.streak >= 2 {
                graduate(card, now);
            } else {
                card.due_at = Some(now);
            }
        }
        Status::Mastered => {
            if card.interval_days < 1.0 {
                card.interval_days = 1.0;
            } else if card.interval_days < 3.0 {
                card.interval_days = 3.0;
            } else {
                card.interval_days *= card.ease;
            }
            card.ease = (card.ease + 0.1).min(3.0);
            card.due_at = Some(now + days(card.interval_days));
        }
    }
}

fn graduate(card: &mut Card, now: DateTime<Utc>) {
    card.status = Status::Mastered;
    card.interval_days = 1.0;
    card.due_at = Some(now + days(1.0));
    if card.ease < 2.5 {
        card.ease = 2.5;
    }
}

fn days(n: f64) -> Duration {
    Duration::milliseconds((n * 86_400_000.0).round() as i64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Card, CardId, DeckId, Status};

    fn card(status: Status) -> Card {
        Card {
            id: CardId(1),
            deck_id: DeckId(1),
            front: "f".into(),
            back: "b".into(),
            highlights: vec![],
            position: 0,
            status,
            ease: 2.5,
            interval_days: 0.0,
            due_at: None,
            reps: 0,
            lapses: 0,
            streak: 0,
            learning_step: 0,
            last_reviewed_at: None,
        }
    }

    #[test]
    fn two_goods_graduate_to_tomorrow() {
        let now = Utc::now();
        let mut c = card(Status::New);
        apply_answer(&mut c, true, now);
        assert_eq!(c.status, Status::Learning);
        apply_answer(&mut c, true, now);
        assert_eq!(c.status, Status::Mastered);
        let due = c.due_at.unwrap();
        let delta = (due - now).num_hours();
        assert!(delta >= 23 && delta <= 25, "due in {delta} hours");
    }

    #[test]
    fn miss_resets_to_learning() {
        let now = Utc::now();
        let mut c = card(Status::Mastered);
        c.interval_days = 6.0;
        apply_answer(&mut c, false, now);
        assert_eq!(c.status, Status::Learning);
        assert_eq!(c.streak, 0);
        assert!(c.ease < 2.5);
    }

    #[test]
    fn mastered_good_grows_interval() {
        let now = Utc::now();
        let mut c = card(Status::Mastered);
        c.interval_days = 1.0;
        apply_answer(&mut c, true, now);
        assert_eq!(c.interval_days, 3.0);
        apply_answer(&mut c, true, now);
        assert!((c.interval_days - 7.8).abs() < 0.01);
    }
}
