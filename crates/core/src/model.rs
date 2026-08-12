//! Domain types for folders, decks, cards, and review state.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FolderId(pub i64);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct DeckId(pub i64);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct CardId(pub i64);

#[derive(Debug, Clone)]
pub struct Folder {
    pub id: FolderId,
    pub parent_id: Option<FolderId>,
    pub name: String,
    pub position: i64,
}

#[derive(Debug, Clone)]
pub struct Deck {
    pub id: DeckId,
    pub folder_id: Option<FolderId>,
    pub name: String,
    pub position: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    New,
    Learning,
    Mastered,
}

impl Status {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::New => "new",
            Self::Learning => "learning",
            Self::Mastered => "mastered",
        }
    }

    pub fn parse(s: &str) -> Self {
        match s {
            "learning" => Self::Learning,
            "mastered" => Self::Mastered,
            _ => Self::New,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Front,
    Back,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Highlight {
    pub side: Side,
    pub text: String,
}

#[derive(Debug, Clone)]
pub struct Card {
    pub id: CardId,
    pub deck_id: DeckId,
    pub front: String,
    pub back: String,
    pub highlights: Vec<Highlight>,
    pub position: i64,
    pub status: Status,
    pub ease: f64,
    pub interval_days: f64,
    pub due_at: Option<DateTime<Utc>>,
    pub reps: i64,
    pub lapses: i64,
    pub streak: i64,
    pub learning_step: i64,
    pub last_reviewed_at: Option<DateTime<Utc>>,
}

impl Card {
    pub fn is_due(&self, now: DateTime<Utc>) -> bool {
        match self.status {
            Status::New => true,
            _ => self.due_at.map(|due| due <= now).unwrap_or(true),
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct DeckStats {
    pub new: u32,
    pub learning: u32,
    pub mastered: u32,
    pub due: u32,
}

impl DeckStats {
    pub fn total(&self) -> u32 {
        self.new + self.learning + self.mastered
    }
}

#[derive(Debug, Clone)]
pub struct NewCard {
    pub front: String,
    pub back: String,
    pub highlights: Vec<Highlight>,
}
