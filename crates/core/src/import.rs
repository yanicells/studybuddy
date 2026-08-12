//! Flashcard import. Blank line separates cards.
//!
//! ```text
//! Front of the card
//! - back line
//! - another back line
//!
//! The ==mitochondria== is the powerhouse of the cell
//! - mitochondria
//! ```

use crate::model::{Highlight, NewCard, Side};

pub fn parse(text: &str) -> Vec<NewCard> {
    let mut cards = Vec::new();
    let mut block = String::new();

    for line in text.lines() {
        if line.trim().is_empty() {
            if let Some(card) = parse_block(&block) {
                cards.push(card);
            }
            block.clear();
        } else {
            if !block.is_empty() {
                block.push('\n');
            }
            block.push_str(line);
        }
    }
    if let Some(card) = parse_block(&block) {
        cards.push(card);
    }
    cards
}

fn parse_block(block: &str) -> Option<NewCard> {
    let block = block.trim();
    if block.is_empty() {
        return None;
    }

    let mut front_lines = Vec::new();
    let mut back_lines = Vec::new();
    let mut in_back = false;

    for line in block.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed
            .strip_prefix("- ")
            .or_else(|| trimmed.strip_prefix("* "))
        {
            in_back = true;
            back_lines.push(rest.trim().to_string());
        } else if in_back {
            back_lines.push(trimmed.to_string());
        } else {
            front_lines.push(trimmed.to_string());
        }
    }

    if front_lines.is_empty() {
        return None;
    }

    // No bullets: first line is front, remaining lines are back.
    if back_lines.is_empty() && front_lines.len() > 1 {
        back_lines = front_lines.split_off(1);
    }

    let (front, mut front_marks) = strip_marks(&front_lines.join("\n"));
    let (back, mut back_marks) = strip_marks(&back_lines.join("\n"));

    if front.is_empty() {
        return None;
    }

    let mut highlights = Vec::new();
    for text in front_marks.drain(..) {
        highlights.push(Highlight {
            side: Side::Front,
            text,
        });
    }
    for text in back_marks.drain(..) {
        highlights.push(Highlight {
            side: Side::Back,
            text,
        });
    }

    if highlights.is_empty() {
        highlights = heuristic_highlights(&front, &back);
    }

    Some(NewCard {
        front,
        back,
        highlights,
    })
}

/// Pull `==keyword==` markers out of text and return cleaned text plus keywords.
pub fn strip_marks(input: &str) -> (String, Vec<String>) {
    let mut out = String::new();
    let mut highlights = Vec::new();
    let mut rest = input;

    while let Some(start) = rest.find("==") {
        out.push_str(&rest[..start]);
        rest = &rest[start + 2..];
        if let Some(end) = rest.find("==") {
            let word = rest[..end].trim();
            if !word.is_empty() {
                highlights.push(word.to_string());
                out.push_str(word);
            }
            rest = &rest[end + 2..];
        } else {
            out.push_str("==");
            out.push_str(rest);
            rest = "";
            break;
        }
    }
    out.push_str(rest);
    (out, highlights)
}

pub fn heuristic_highlights(front: &str, back: &str) -> Vec<Highlight> {
    let mut found = Vec::new();

    let bullets: Vec<&str> = back
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect();

    let short_bullets = !bullets.is_empty()
        && bullets.len() <= 8
        && bullets
            .iter()
            .all(|b| b.split_whitespace().count() <= 5 && is_good_keyword(b));

    if short_bullets {
        for b in bullets {
            found.push(Highlight {
                side: Side::Back,
                text: b.to_string(),
            });
        }
        return found;
    }

    for (side, text) in [(Side::Back, back), (Side::Front, front)] {
        for phrase in quoted_phrases(text) {
            if is_good_keyword(&phrase)
                && !found.iter().any(|h| h.text.eq_ignore_ascii_case(&phrase))
            {
                found.push(Highlight { side, text: phrase });
            }
        }
        if found.len() >= 3 {
            break;
        }
        for phrase in proper_phrases(text) {
            if is_good_keyword(&phrase)
                && !found.iter().any(|h| h.text.eq_ignore_ascii_case(&phrase))
            {
                found.push(Highlight { side, text: phrase });
            }
            if found.len() >= 3 {
                break;
            }
        }
    }

    if found.is_empty() && is_good_keyword(back) && back.split_whitespace().count() <= 8 {
        found.push(Highlight {
            side: Side::Back,
            text: back.trim().to_string(),
        });
    }

    found
}

/// Split `text` into plain and highlighted spans for notes display.
pub fn mark_spans(text: &str, phrases: &[String]) -> Vec<(String, bool)> {
    let mut spans: Vec<(usize, usize)> = Vec::new();
    let lower = text.to_ascii_lowercase();
    for p in phrases {
        if p.is_empty() {
            continue;
        }
        let needle = p.to_ascii_lowercase();
        let mut from = 0;
        while let Some(rel) = lower[from..].find(&needle) {
            let start = from + rel;
            let end = start + p.len();
            if !spans.iter().any(|(s, e)| start < *e && end > *s) {
                spans.push((start, end));
            }
            from = end;
        }
    }
    spans.sort_by_key(|s| s.0);

    let mut out = Vec::new();
    let mut cursor = 0;
    for (start, end) in spans {
        if start > cursor {
            out.push((text[cursor..start].to_string(), false));
        }
        if end <= text.len() {
            out.push((text[start..end].to_string(), true));
            cursor = end;
        }
    }
    if cursor < text.len() {
        out.push((text[cursor..].to_string(), false));
    }
    if out.is_empty() {
        out.push((text.to_string(), false));
    }
    out
}

/// Wrap known phrases in `==...==` for the editor.
pub fn wrap_marks(text: &str, phrases: &[String]) -> String {
    let mut spans: Vec<(usize, usize)> = Vec::new();
    let lower = text.to_ascii_lowercase();
    for p in phrases {
        if p.is_empty() {
            continue;
        }
        if let Some(start) = lower.find(&p.to_ascii_lowercase()) {
            let end = start + p.len();
            if spans.iter().any(|(s, e)| start < *e && end > *s) {
                continue;
            }
            spans.push((start, end));
        }
    }
    spans.sort_by_key(|s| std::cmp::Reverse(s.0));
    let mut out = text.to_string();
    for (start, end) in spans {
        let inner = out[start..end].to_string();
        out.replace_range(start..end, &format!("=={inner}=="));
    }
    out
}

fn quoted_phrases(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    for (open, close) in [('"', '"'), ('`', '`')] {
        let mut rest = text;
        while let Some(start) = rest.find(open) {
            rest = &rest[start + 1..];
            if let Some(end) = rest.find(close) {
                let inner = rest[..end].trim();
                if !inner.is_empty() {
                    out.push(inner.to_string());
                }
                rest = &rest[end + 1..];
            } else {
                break;
            }
        }
    }
    out
}

fn proper_phrases(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = Vec::new();

    for token in text.split_whitespace() {
        let cleaned = token.trim_matches(|c: char| !c.is_alphanumeric() && c != '-');
        if cleaned.is_empty() {
            continue;
        }
        let starts_upper = cleaned
            .chars()
            .next()
            .map(|c| c.is_uppercase())
            .unwrap_or(false);
        if starts_upper && !is_stop(cleaned) {
            current.push(cleaned.to_string());
        } else {
            if !current.is_empty() {
                out.push(current.join(" "));
                current.clear();
            }
        }
    }
    if !current.is_empty() {
        out.push(current.join(" "));
    }
    out
}

fn is_good_keyword(s: &str) -> bool {
    let s = s.trim();
    if s.len() < 2 {
        return false;
    }
    if s.chars().any(|c| c.is_ascii_digit()) {
        return true;
    }
    s.split_whitespace().any(|w| w.len() >= 4 && !is_stop(w)) || s.chars().any(|c| c.is_uppercase())
}

fn is_stop(w: &str) -> bool {
    matches!(
        w.to_ascii_lowercase().as_str(),
        "the"
            | "a"
            | "an"
            | "of"
            | "and"
            | "or"
            | "to"
            | "in"
            | "on"
            | "for"
            | "is"
            | "are"
            | "was"
            | "were"
            | "be"
            | "as"
            | "by"
            | "with"
            | "that"
            | "this"
            | "from"
            | "it"
            | "its"
            | "at"
            | "into"
            | "than"
            | "then"
            | "also"
            | "can"
            | "may"
            | "not"
            | "but"
            | "if"
            | "we"
            | "you"
            | "they"
            | "their"
            | "our"
            | "your"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_bullet_cards() {
        let cards = parse(
            "Front side of the deck\n- here\n- is\n- a\n- possible back side\n\nSecond card\n- answer\n",
        );
        assert_eq!(cards.len(), 2);
        assert_eq!(cards[0].front, "Front side of the deck");
        assert_eq!(cards[0].back, "here\nis\na\npossible back side");
        assert_eq!(cards[1].front, "Second card");
        assert_eq!(cards[1].back, "answer");
        assert!(cards[1]
            .highlights
            .iter()
            .any(|h| h.text.eq_ignore_ascii_case("answer")));
    }

    #[test]
    fn parses_cloze_marks() {
        let cards = parse("The ==mitochondria== is the powerhouse of the cell\n- mitochondria\n");
        assert_eq!(cards.len(), 1);
        assert_eq!(
            cards[0].front,
            "The mitochondria is the powerhouse of the cell"
        );
        assert!(cards[0]
            .highlights
            .iter()
            .any(|h| h.text == "mitochondria" && h.side == Side::Front));
    }

    #[test]
    fn two_line_card_without_bullets() {
        let cards = parse("What is 2+2?\n4\n");
        assert_eq!(cards.len(), 1);
        assert_eq!(cards[0].front, "What is 2+2?");
        assert_eq!(cards[0].back, "4");
    }

    #[test]
    fn mark_spans_bolds_phrases() {
        let spans = mark_spans(
            "Attributes visible to a programmer",
            &["visible to a programmer".into()],
        );
        assert_eq!(
            spans,
            vec![
                ("Attributes ".into(), false),
                ("visible to a programmer".into(), true),
            ]
        );
    }
}
