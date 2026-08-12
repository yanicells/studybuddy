//! SQLite persistence.

use std::collections::HashMap;
use std::path::Path;

use anyhow::{bail, Context, Result};
use chrono::{DateTime, SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};

use crate::model::{
    Card, CardId, Deck, DeckId, DeckStats, Folder, FolderId, Highlight, NewCard, Status,
};

pub struct Store {
    conn: Connection,
}

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path).context("open sqlite")?;
        Self::from_conn(conn)
    }

    pub fn open_in_memory() -> Result<Self> {
        Self::from_conn(Connection::open_in_memory()?)
    }

    fn from_conn(conn: Connection) -> Result<Self> {
        conn.execute_batch(
            "
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            ",
        )?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self { conn })
    }

    pub fn create_folder(&self, parent_id: Option<FolderId>, name: &str) -> Result<Folder> {
        let name = name.trim();
        if name.is_empty() {
            bail!("folder name is empty");
        }
        let position = next_pos(
            &self.conn,
            "SELECT COALESCE(MAX(position), -1) + 1 FROM folders WHERE parent_id IS ?",
            parent_id.map(|id| id.0),
        )?;
        let now = now_str();
        self.conn.execute(
            "INSERT INTO folders (parent_id, name, position, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![parent_id.map(|id| id.0), name, position, now],
        )?;
        Ok(Folder {
            id: FolderId(self.conn.last_insert_rowid()),
            parent_id,
            name: name.to_string(),
            position,
        })
    }

    pub fn rename_folder(&self, id: FolderId, name: &str) -> Result<()> {
        let name = name.trim();
        if name.is_empty() {
            bail!("folder name is empty");
        }
        let n = self.conn.execute(
            "UPDATE folders SET name = ?1 WHERE id = ?2",
            params![name, id.0],
        )?;
        if n == 0 {
            bail!("folder not found");
        }
        Ok(())
    }

    pub fn move_folder(&self, id: FolderId, new_parent: Option<FolderId>) -> Result<()> {
        if let Some(parent) = new_parent {
            if parent == id {
                bail!("cannot move a folder into itself");
            }
            if self.folder_descendants(id)?.contains(&parent) {
                bail!("cannot move a folder into its own child");
            }
        }
        let n = self.conn.execute(
            "UPDATE folders SET parent_id = ?1 WHERE id = ?2",
            params![new_parent.map(|p| p.0), id.0],
        )?;
        if n == 0 {
            bail!("folder not found");
        }
        Ok(())
    }

    pub fn delete_folder(&self, id: FolderId) -> Result<()> {
        let n = self
            .conn
            .execute("DELETE FROM folders WHERE id = ?1", params![id.0])?;
        if n == 0 {
            bail!("folder not found");
        }
        Ok(())
    }

    pub fn list_folders(&self) -> Result<Vec<Folder>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, parent_id, name, position FROM folders ORDER BY position, name")?;
        let rows = stmt.query_map([], |row| {
            Ok(Folder {
                id: FolderId(row.get(0)?),
                parent_id: row.get::<_, Option<i64>>(1)?.map(FolderId),
                name: row.get(2)?,
                position: row.get(3)?,
            })
        })?;
        rows.collect::<rusqlite::Result<_>>().map_err(Into::into)
    }

    pub fn folder_descendants(&self, id: FolderId) -> Result<Vec<FolderId>> {
        let folders = self.list_folders()?;
        let mut kids: HashMap<Option<FolderId>, Vec<FolderId>> = HashMap::new();
        for f in &folders {
            kids.entry(f.parent_id).or_default().push(f.id);
        }
        let mut out = Vec::new();
        let mut stack = kids.get(&Some(id)).cloned().unwrap_or_default();
        while let Some(next) = stack.pop() {
            out.push(next);
            if let Some(more) = kids.get(&Some(next)) {
                stack.extend(more);
            }
        }
        Ok(out)
    }

    pub fn create_deck(&self, folder_id: Option<FolderId>, name: &str) -> Result<Deck> {
        let name = name.trim();
        if name.is_empty() {
            bail!("deck name is empty");
        }
        let position = next_pos(
            &self.conn,
            "SELECT COALESCE(MAX(position), -1) + 1 FROM decks WHERE folder_id IS ?",
            folder_id.map(|id| id.0),
        )?;
        let now = now_str();
        self.conn.execute(
            "INSERT INTO decks (folder_id, name, position, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![folder_id.map(|id| id.0), name, position, now],
        )?;
        Ok(Deck {
            id: DeckId(self.conn.last_insert_rowid()),
            folder_id,
            name: name.to_string(),
            position,
        })
    }

    pub fn rename_deck(&self, id: DeckId, name: &str) -> Result<()> {
        let name = name.trim();
        if name.is_empty() {
            bail!("deck name is empty");
        }
        let n = self.conn.execute(
            "UPDATE decks SET name = ?1 WHERE id = ?2",
            params![name, id.0],
        )?;
        if n == 0 {
            bail!("deck not found");
        }
        Ok(())
    }

    pub fn move_deck(&self, id: DeckId, folder_id: Option<FolderId>) -> Result<()> {
        let n = self.conn.execute(
            "UPDATE decks SET folder_id = ?1 WHERE id = ?2",
            params![folder_id.map(|f| f.0), id.0],
        )?;
        if n == 0 {
            bail!("deck not found");
        }
        Ok(())
    }

    pub fn delete_deck(&self, id: DeckId) -> Result<()> {
        let n = self
            .conn
            .execute("DELETE FROM decks WHERE id = ?1", params![id.0])?;
        if n == 0 {
            bail!("deck not found");
        }
        Ok(())
    }

    pub fn get_deck(&self, id: DeckId) -> Result<Deck> {
        self.conn
            .query_row(
                "SELECT id, folder_id, name, position FROM decks WHERE id = ?1",
                params![id.0],
                |row| {
                    Ok(Deck {
                        id: DeckId(row.get(0)?),
                        folder_id: row.get::<_, Option<i64>>(1)?.map(FolderId),
                        name: row.get(2)?,
                        position: row.get(3)?,
                    })
                },
            )
            .optional()?
            .context("deck not found")
    }

    pub fn list_decks(&self) -> Result<Vec<Deck>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, folder_id, name, position FROM decks ORDER BY position, name")?;
        let rows = stmt.query_map([], |row| {
            Ok(Deck {
                id: DeckId(row.get(0)?),
                folder_id: row.get::<_, Option<i64>>(1)?.map(FolderId),
                name: row.get(2)?,
                position: row.get(3)?,
            })
        })?;
        rows.collect::<rusqlite::Result<_>>().map_err(Into::into)
    }

    pub fn create_card(&self, deck_id: DeckId, card: &NewCard) -> Result<Card> {
        let position = next_pos(
            &self.conn,
            "SELECT COALESCE(MAX(position), -1) + 1 FROM cards WHERE deck_id = ?",
            Some(deck_id.0),
        )?;
        let now = now_str();
        let highlights = serde_json::to_string(&card.highlights)?;
        self.conn.execute(
            "INSERT INTO cards (deck_id, front, back, highlights, position, created_at, status, ease, interval_days, due_at, reps, lapses, streak, learning_step)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'new', 2.5, 0, NULL, 0, 0, 0, 0)",
            params![deck_id.0, card.front, card.back, highlights, position, now],
        )?;
        self.get_card(CardId(self.conn.last_insert_rowid()))
    }

    pub fn update_card(
        &self,
        id: CardId,
        front: &str,
        back: &str,
        highlights: &[Highlight],
    ) -> Result<()> {
        let highlights = serde_json::to_string(highlights)?;
        let n = self.conn.execute(
            "UPDATE cards SET front = ?1, back = ?2, highlights = ?3 WHERE id = ?4",
            params![front, back, highlights, id.0],
        )?;
        if n == 0 {
            bail!("card not found");
        }
        Ok(())
    }

    pub fn delete_card(&self, id: CardId) -> Result<()> {
        let n = self
            .conn
            .execute("DELETE FROM cards WHERE id = ?1", params![id.0])?;
        if n == 0 {
            bail!("card not found");
        }
        Ok(())
    }

    pub fn get_card(&self, id: CardId) -> Result<Card> {
        self.conn
            .query_row(
                "SELECT id, deck_id, front, back, highlights, position, status, ease, interval_days, due_at, reps, lapses, streak, learning_step, last_reviewed_at
                 FROM cards WHERE id = ?1",
                params![id.0],
                row_to_card,
            )
            .optional()?
            .context("card not found")
    }

    pub fn list_cards(&self, deck_id: DeckId) -> Result<Vec<Card>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, deck_id, front, back, highlights, position, status, ease, interval_days, due_at, reps, lapses, streak, learning_step, last_reviewed_at
             FROM cards WHERE deck_id = ?1 ORDER BY position, id",
        )?;
        let rows = stmt.query_map(params![deck_id.0], row_to_card)?;
        rows.collect::<rusqlite::Result<_>>().map_err(Into::into)
    }

    pub fn save_card_srs(&self, card: &Card) -> Result<()> {
        self.conn.execute(
            "UPDATE cards SET status = ?1, ease = ?2, interval_days = ?3, due_at = ?4, reps = ?5, lapses = ?6, streak = ?7, learning_step = ?8, last_reviewed_at = ?9 WHERE id = ?10",
            params![
                card.status.as_str(),
                card.ease,
                card.interval_days,
                card.due_at.map(fmt_time),
                card.reps,
                card.lapses,
                card.streak,
                card.learning_step,
                card.last_reviewed_at.map(fmt_time),
                card.id.0,
            ],
        )?;
        Ok(())
    }

    pub fn log_review(&self, card_id: CardId, correct: bool) -> Result<()> {
        self.conn.execute(
            "INSERT INTO reviews (card_id, correct, reviewed_at) VALUES (?1, ?2, ?3)",
            params![card_id.0, correct as i64, now_str()],
        )?;
        Ok(())
    }

    pub fn import_cards(&self, deck_id: DeckId, cards: &[NewCard]) -> Result<usize> {
        let tx = self.conn.unchecked_transaction()?;
        let mut count = 0;
        for card in cards {
            if card.front.trim().is_empty() {
                continue;
            }
            let position: i64 = tx.query_row(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM cards WHERE deck_id = ?1",
                params![deck_id.0],
                |row| row.get(0),
            )?;
            let highlights = serde_json::to_string(&card.highlights)?;
            tx.execute(
                "INSERT INTO cards (deck_id, front, back, highlights, position, created_at, status, ease, interval_days, due_at, reps, lapses, streak, learning_step)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'new', 2.5, 0, NULL, 0, 0, 0, 0)",
                params![deck_id.0, card.front, card.back, highlights, position, now_str()],
            )?;
            count += 1;
        }
        tx.commit()?;
        Ok(count)
    }

    pub fn due_cards(&self, deck_id: DeckId, now: DateTime<Utc>) -> Result<Vec<Card>> {
        Ok(self
            .list_cards(deck_id)?
            .into_iter()
            .filter(|c| c.is_due(now))
            .collect())
    }

    pub fn deck_stats(&self, now: DateTime<Utc>) -> Result<HashMap<DeckId, DeckStats>> {
        let mut map: HashMap<DeckId, DeckStats> = HashMap::new();
        let mut stmt = self
            .conn
            .prepare("SELECT deck_id, status, due_at FROM cards")?;
        let rows = stmt.query_map([], |row| {
            Ok((
                DeckId(row.get(0)?),
                Status::parse(&row.get::<_, String>(1)?),
                row.get::<_, Option<String>>(2)?,
            ))
        })?;
        for row in rows {
            let (deck_id, status, due) = row?;
            let stats = map.entry(deck_id).or_default();
            match status {
                Status::New => stats.new += 1,
                Status::Learning => stats.learning += 1,
                Status::Mastered => stats.mastered += 1,
            }
            let due_now = match status {
                Status::New => true,
                _ => due
                    .as_deref()
                    .and_then(parse_time)
                    .map(|t| t <= now)
                    .unwrap_or(true),
            };
            if due_now {
                stats.due += 1;
            }
        }
        Ok(map)
    }
}

fn row_to_card(row: &rusqlite::Row<'_>) -> rusqlite::Result<Card> {
    let highlights: String = row.get(4)?;
    let highlights: Vec<Highlight> = serde_json::from_str(&highlights).unwrap_or_default();
    let status: String = row.get(6)?;
    Ok(Card {
        id: CardId(row.get(0)?),
        deck_id: DeckId(row.get(1)?),
        front: row.get(2)?,
        back: row.get(3)?,
        highlights,
        position: row.get(5)?,
        status: Status::parse(&status),
        ease: row.get(7)?,
        interval_days: row.get(8)?,
        due_at: row
            .get::<_, Option<String>>(9)?
            .as_deref()
            .and_then(parse_time),
        reps: row.get(10)?,
        lapses: row.get(11)?,
        streak: row.get(12)?,
        learning_step: row.get(13)?,
        last_reviewed_at: row
            .get::<_, Option<String>>(14)?
            .as_deref()
            .and_then(parse_time),
    })
}

fn next_pos(conn: &Connection, sql: &str, parent: Option<i64>) -> Result<i64> {
    Ok(conn.query_row(sql, params![parent], |row| row.get(0))?)
}

fn now_str() -> String {
    fmt_time(Utc::now())
}

fn fmt_time(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn parse_time(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|t| t.with_timezone(&Utc))
}

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY,
    parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS decks (
    id INTEGER PRIMARY KEY,
    folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY,
    deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    highlights TEXT NOT NULL DEFAULT '[]',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    ease REAL NOT NULL DEFAULT 2.5,
    interval_days REAL NOT NULL DEFAULT 0,
    due_at TEXT,
    reps INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    learning_step INTEGER NOT NULL DEFAULT 0,
    last_reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    correct INTEGER NOT NULL,
    reviewed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_decks_folder ON decks(folder_id);
CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);
";

#[cfg(test)]
mod tests {
    use super::*;
    use crate::import;

    #[test]
    fn folder_nest_move_delete() {
        let store = Store::open_in_memory().unwrap();
        let root = store.create_folder(None, "Bio").unwrap();
        let child = store.create_folder(Some(root.id), "Week 1").unwrap();
        store
            .move_folder(root.id, Some(child.id))
            .expect_err("cycle");
        store.move_folder(child.id, None).unwrap();
        assert_eq!(store.list_folders().unwrap().len(), 2);
        store.delete_folder(root.id).unwrap();
        assert_eq!(store.list_folders().unwrap().len(), 1);
    }

    #[test]
    fn import_and_stats() {
        let store = Store::open_in_memory().unwrap();
        let deck = store.create_deck(None, "Cells").unwrap();
        let cards = import::parse(
            "The ==mitochondria== is the powerhouse of the cell\n- mitochondria\n\nNucleus\n- control center\n",
        );
        let n = store.import_cards(deck.id, &cards).unwrap();
        assert_eq!(n, 2);
        let stats = store.deck_stats(Utc::now()).unwrap();
        let s = stats.get(&deck.id).unwrap();
        assert_eq!(s.new, 2);
        assert_eq!(s.due, 2);
    }

    #[test]
    fn cascade_delete_deck_removes_cards() {
        let store = Store::open_in_memory().unwrap();
        let deck = store.create_deck(None, "X").unwrap();
        store
            .create_card(
                deck.id,
                &NewCard {
                    front: "a".into(),
                    back: "b".into(),
                    highlights: vec![],
                },
            )
            .unwrap();
        store.delete_deck(deck.id).unwrap();
        assert!(store.list_cards(deck.id).unwrap().is_empty());
    }
}
