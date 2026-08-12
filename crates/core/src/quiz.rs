//! Cloze multiple-choice questions, Gizmo-style.
//!
//! Highlighted phrases are blanked. New cards hide one; learning cards hide
//! about half; mastered cards hide all. One blank is the target. Choices are
//! the target plus distractors from the rest of the deck.

use rand::seq::SliceRandom;
use rand::Rng;

use crate::model::{Card, CardId, Highlight, Side, Status};

#[derive(Debug, Clone)]
pub enum Segment {
    Text(String),
    Blank { text: String, target: bool },
}

#[derive(Debug, Clone)]
pub enum Prompt {
    Cloze { segments: Vec<Segment> },
    Front { text: String },
}

#[derive(Debug, Clone)]
pub struct Question {
    pub card_id: CardId,
    pub prompt: Prompt,
    pub choices: Vec<String>,
    pub answer_index: usize,
    pub answer: String,
}

pub fn build_question(card: &Card, deck: &[Card], rng: &mut impl Rng) -> Question {
    let highlights = usable_highlights(card);
    if let Some(q) = cloze_question(card, &highlights, deck, rng) {
        return q;
    }
    full_choice(card, deck, rng)
}

fn usable_highlights(card: &Card) -> Vec<Highlight> {
    card.highlights
        .iter()
        .filter(|h| {
            let hay = match h.side {
                Side::Front => &card.front,
                Side::Back => &card.back,
            };
            find_ci(hay, &h.text).is_some()
        })
        .cloned()
        .collect()
}

fn cloze_question(
    card: &Card,
    highlights: &[Highlight],
    deck: &[Card],
    rng: &mut impl Rng,
) -> Option<Question> {
    if highlights.is_empty() {
        return None;
    }

    let n_blank = blank_count(card.status, highlights.len());
    let mut order: Vec<usize> = (0..highlights.len()).collect();
    order.shuffle(rng);
    order.truncate(n_blank.max(1));

    let target_idx = order[0];
    let target = &highlights[target_idx];
    let side = preferred_side(highlights, target.side);
    let text = match side {
        Side::Front => card.front.as_str(),
        Side::Back => card.back.as_str(),
    };

    let blanks: Vec<&Highlight> = highlights
        .iter()
        .enumerate()
        .filter(|(i, h)| h.side == side && order.contains(i))
        .map(|(_, h)| h)
        .collect();

    if blanks.is_empty() {
        return None;
    }

    let segments = split_cloze(text, &blanks, &target.text)?;
    let (choices, answer_index) = make_choices(&target.text, card, deck, rng);

    Some(Question {
        card_id: card.id,
        prompt: Prompt::Cloze { segments },
        choices,
        answer_index,
        answer: target.text.clone(),
    })
}

fn full_choice(card: &Card, deck: &[Card], rng: &mut impl Rng) -> Question {
    let answer = if card.back.trim().is_empty() {
        card.front.clone()
    } else {
        card.back.clone()
    };
    let (choices, answer_index) = make_choices(&answer, card, deck, rng);
    Question {
        card_id: card.id,
        prompt: Prompt::Front {
            text: card.front.clone(),
        },
        choices,
        answer_index,
        answer,
    }
}

fn preferred_side(highlights: &[Highlight], target_side: Side) -> Side {
    if highlights.iter().any(|h| h.side == target_side) {
        target_side
    } else if highlights.iter().any(|h| h.side == Side::Back) {
        Side::Back
    } else {
        Side::Front
    }
}

fn blank_count(status: Status, n: usize) -> usize {
    if n == 0 {
        return 0;
    }
    match status {
        Status::New => 1,
        Status::Learning => ((n + 1) / 2).max(1),
        Status::Mastered => n,
    }
}

fn split_cloze(text: &str, blanks: &[&Highlight], target: &str) -> Option<Vec<Segment>> {
    let mut spans: Vec<(usize, usize, bool)> = Vec::new();
    for h in blanks {
        if let Some(start) = find_ci(text, &h.text) {
            let end = start + h.text.len();
            if spans.iter().any(|(s, e, _)| start < *e && end > *s) {
                continue;
            }
            spans.push((start, end, h.text.eq_ignore_ascii_case(target)));
        }
    }
    if spans.is_empty() {
        return None;
    }
    spans.sort_by_key(|(s, _, _)| *s);

    let mut segments = Vec::new();
    let mut cursor = 0;
    for (start, end, is_target) in spans {
        if start > cursor {
            segments.push(Segment::Text(text[cursor..start].to_string()));
        }
        segments.push(Segment::Blank {
            text: text[start..end].to_string(),
            target: is_target,
        });
        cursor = end;
    }
    if cursor < text.len() {
        segments.push(Segment::Text(text[cursor..].to_string()));
    }
    Some(segments)
}

fn find_ci(hay: &str, needle: &str) -> Option<usize> {
    if needle.is_empty() {
        return None;
    }
    hay.to_ascii_lowercase().find(&needle.to_ascii_lowercase())
}

fn make_choices(
    answer: &str,
    card: &Card,
    deck: &[Card],
    rng: &mut impl Rng,
) -> (Vec<String>, usize) {
    let mut options = vec![answer.to_string()];
    let mut pool = Vec::new();

    for c in deck {
        if c.id == card.id {
            continue;
        }
        for h in &c.highlights {
            pool.push(h.text.clone());
        }
        if !c.back.trim().is_empty() {
            pool.push(c.back.clone());
        }
        for line in c.back.lines() {
            let t = line.trim();
            if !t.is_empty() {
                pool.push(t.to_string());
            }
        }
    }

    for h in &card.highlights {
        if !h.text.eq_ignore_ascii_case(answer) {
            pool.push(h.text.clone());
        }
    }

    pool.shuffle(rng);
    for cand in pool {
        if options.len() >= 4 {
            break;
        }
        if options
            .iter()
            .any(|o| o.eq_ignore_ascii_case(&cand) || similar_enough(o, &cand))
        {
            continue;
        }
        options.push(cand);
    }

    // Last resort: nearby words from the same card, then padded labels.
    if options.len() < 4 {
        for word in card
            .front
            .split_whitespace()
            .chain(card.back.split_whitespace())
        {
            let cleaned = word.trim_matches(|c: char| !c.is_alphanumeric());
            if cleaned.len() < 4 {
                continue;
            }
            if options.iter().any(|o| o.eq_ignore_ascii_case(cleaned)) {
                continue;
            }
            options.push(cleaned.to_string());
            if options.len() >= 4 {
                break;
            }
        }
    }
    let fillers = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"];
    for f in fillers {
        if options.len() >= 4 {
            break;
        }
        if !options.iter().any(|o| o.eq_ignore_ascii_case(f)) {
            options.push(f.to_string());
        }
    }

    options.truncate(4);
    options.shuffle(rng);
    let answer_index = options
        .iter()
        .position(|o| o.eq_ignore_ascii_case(answer))
        .unwrap_or(0);
    (options, answer_index)
}

fn similar_enough(a: &str, b: &str) -> bool {
    a.trim().eq_ignore_ascii_case(b.trim())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{DeckId, Highlight, Side, Status};

    fn sample(status: Status) -> (Card, Vec<Card>) {
        let card = Card {
            id: CardId(1),
            deck_id: DeckId(1),
            front: "The mitochondria is the powerhouse of the cell".into(),
            back: "mitochondria".into(),
            highlights: vec![Highlight {
                side: Side::Front,
                text: "mitochondria".into(),
            }],
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
        };
        let others = vec![Card {
            id: CardId(2),
            deck_id: DeckId(1),
            front: "Control center".into(),
            back: "nucleus".into(),
            highlights: vec![Highlight {
                side: Side::Back,
                text: "nucleus".into(),
            }],
            position: 1,
            status: Status::New,
            ease: 2.5,
            interval_days: 0.0,
            due_at: None,
            reps: 0,
            lapses: 0,
            streak: 0,
            learning_step: 0,
            last_reviewed_at: None,
        }];
        (card, others)
    }

    #[test]
    fn cloze_blanks_the_keyword() {
        let (card, others) = sample(Status::New);
        let mut rng = rand::rng();
        let q = build_question(&card, &others, &mut rng);
        match q.prompt {
            Prompt::Cloze { segments } => {
                assert!(segments.iter().any(|s| matches!(
                    s,
                    Segment::Blank {
                        text,
                        target: true
                    } if text.eq_ignore_ascii_case("mitochondria")
                )));
            }
            Prompt::Front { .. } => panic!("expected cloze"),
        }
        assert_eq!(q.choices.len(), 4);
        assert_eq!(q.choices[q.answer_index], "mitochondria");
        assert!(q.choices.contains(&"nucleus".to_string()));
    }

    #[test]
    fn full_choice_when_no_highlights() {
        let card = Card {
            id: CardId(1),
            deck_id: DeckId(1),
            front: "Powerhouse of the cell".into(),
            back: "mitochondria".into(),
            highlights: vec![],
            position: 0,
            status: Status::New,
            ease: 2.5,
            interval_days: 0.0,
            due_at: None,
            reps: 0,
            lapses: 0,
            streak: 0,
            learning_step: 0,
            last_reviewed_at: None,
        };
        let mut rng = rand::rng();
        let q = build_question(&card, &[], &mut rng);
        match q.prompt {
            Prompt::Front { text } => assert_eq!(text, "Powerhouse of the cell"),
            Prompt::Cloze { .. } => panic!("expected front"),
        }
        assert_eq!(q.choices[q.answer_index], "mitochondria");
    }
}
