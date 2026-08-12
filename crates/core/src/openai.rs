//! Optional OpenAI keyword extraction for import.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use crate::model::{Highlight, NewCard, Side};

pub fn api_key() -> Option<String> {
    std::env::var("OPENAI_API_KEY")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn fill_missing_keywords(cards: &mut [NewCard]) -> Result<usize> {
    let Some(key) = api_key() else {
        return Ok(0);
    };

    let mut pending: Vec<(usize, String, String)> = Vec::new();
    for (i, card) in cards.iter().enumerate() {
        if card.highlights.is_empty() {
            pending.push((i, card.front.clone(), card.back.clone()));
        }
    }
    if pending.is_empty() {
        return Ok(0);
    }

    let keywords = extract(&key, &pending)?;
    let mut filled = 0;
    for ((index, _, _), words) in pending.iter().zip(keywords) {
        if words.is_empty() {
            continue;
        }
        let card = &mut cards[*index];
        for word in words {
            let side = if find_ci(&card.back, &word) {
                Side::Back
            } else if find_ci(&card.front, &word) {
                Side::Front
            } else {
                continue;
            };
            if !card
                .highlights
                .iter()
                .any(|h| h.text.eq_ignore_ascii_case(&word))
            {
                card.highlights.push(Highlight { side, text: word });
            }
        }
        if !card.highlights.is_empty() {
            filled += 1;
        }
    }
    Ok(filled)
}

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    temperature: f32,
}

#[derive(Serialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatContent,
}

#[derive(Deserialize)]
struct ChatContent {
    content: Option<String>,
}

#[derive(Deserialize)]
struct Payload {
    items: Vec<Item>,
}

#[derive(Deserialize)]
struct Item {
    i: usize,
    keywords: Vec<String>,
}

fn extract(key: &str, cards: &[(usize, String, String)]) -> Result<Vec<Vec<String>>> {
    let mut body = String::from(
        "Extract 1-3 quiz keywords per flashcard. Keywords must appear in the card text. Return JSON only: {\"items\":[{\"i\":0,\"keywords\":[\"...\"]}]}\n\n",
    );
    for (i, (_, front, back)) in cards.iter().enumerate() {
        body.push_str(&format!("[{i}] FRONT: {front}\nBACK: {back}\n\n"));
    }

    let req = ChatRequest {
        model: "gpt-4o-mini",
        messages: vec![
            ChatMessage {
                role: "system",
                content: "You pick short study keywords for cloze quizzes. JSON only.",
            },
            ChatMessage {
                role: "user",
                content: &body,
            },
        ],
        temperature: 0.2,
    };

    let resp: ChatResponse = ureq::post("https://api.openai.com/v1/chat/completions")
        .set("Authorization", &format!("Bearer {key}"))
        .set("Content-Type", "application/json")
        .send_json(&req)
        .context("openai request failed")?
        .into_json()
        .context("openai response was not json")?;

    let content = resp
        .choices
        .first()
        .and_then(|c| c.message.content.clone())
        .unwrap_or_default();
    let json = strip_fence(&content);
    let parsed: Payload = serde_json::from_str(json).unwrap_or(Payload { items: vec![] });

    let mut out = vec![Vec::new(); cards.len()];
    for item in parsed.items {
        if let Some(slot) = out.get_mut(item.i) {
            *slot = item
                .keywords
                .into_iter()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty() && s.len() < 80)
                .take(3)
                .collect();
        }
    }
    Ok(out)
}

fn strip_fence(s: &str) -> &str {
    let s = s.trim();
    if let Some(rest) = s.strip_prefix("```json") {
        return rest.trim().trim_end_matches("```").trim();
    }
    if let Some(rest) = s.strip_prefix("```") {
        return rest.trim().trim_end_matches("```").trim();
    }
    s
}

fn find_ci(hay: &str, needle: &str) -> bool {
    hay.to_ascii_lowercase()
        .contains(&needle.to_ascii_lowercase())
}
