use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use chrono::Utc;
use gpui::{
    div, prelude::*, px, rgb, AnyElement, Context, Entity, FocusHandle, FontWeight, SharedString,
    Window,
};
use gpui_component::button::{Button, ButtonVariants};
use gpui_component::input::{Input, InputState};
use rand::rng;
use studybuddy_core::import::{self, wrap_marks};
use studybuddy_core::quiz::{self, Prompt, Question, Segment};
use studybuddy_core::{
    apply_answer, Card, CardId, Deck, DeckId, DeckStats, Folder, FolderId, Highlight, NewCard,
    Session, Side, Status, Store,
};

const CANVAS: u32 = 0xF4F6F7;
const SIDEBAR: u32 = 0xEBEEF0;
const CARD: u32 = 0xFFFEFB;
const INK: u32 = 0x1C2430;
const MUTED: u32 = 0x6A727A;
const LINE: u32 = 0xD8DEE2;
const ACCENT: u32 = 0x3F6F8A;
const SELECT: u32 = 0xD9E4EA;
const NEW: u32 = 0x4C7A9B;
const LEARNING: u32 = 0xB0893A;
const MASTERED: u32 = 0x5B7F62;
const WRONG: u32 = 0xB45A4A;
const BLANK: u32 = 0xC5D9E0;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Selection {
    None,
    Folder(FolderId),
    Deck(DeckId),
}

#[derive(Clone)]
enum Overlay {
    None,
    Name {
        title: SharedString,
        kind: NameKind,
    },
    Confirm {
        title: SharedString,
        body: SharedString,
        kind: ConfirmKind,
    },
    Import,
    EditCard {
        id: Option<CardId>,
    },
    Move {
        kind: MoveKind,
    },
}

#[derive(Clone, Copy)]
enum NameKind {
    NewFolder,
    NewDeck,
    RenameFolder(FolderId),
    RenameDeck(DeckId),
}

#[derive(Clone, Copy)]
enum ConfirmKind {
    DeleteFolder(FolderId),
    DeleteDeck(DeckId),
    DeleteCard(CardId),
}

#[derive(Clone, Copy)]
enum MoveKind {
    Folder(FolderId),
    Deck(DeckId),
}

struct StudyView {
    session: Session,
    current: Option<Question>,
    feedback: Option<Feedback>,
    deck_cards: Vec<Card>,
    done: bool,
}

struct Feedback {
    picked: usize,
    correct: bool,
}

pub struct Studybuddy {
    store: Store,
    folders: Vec<Folder>,
    decks: Vec<Deck>,
    cards: Vec<Card>,
    stats: HashMap<DeckId, DeckStats>,
    expanded: HashSet<FolderId>,
    selected: Selection,
    overlay: Overlay,
    study: Option<StudyView>,
    notice: Option<String>,
    name_input: Entity<InputState>,
    front_input: Entity<InputState>,
    back_input: Entity<InputState>,
    import_input: Entity<InputState>,
    focus_handle: FocusHandle,
}

impl Studybuddy {
    pub fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        let store = Store::open(&db_path()).expect("open studybuddy database");
        let name_input = cx.new(|cx| InputState::new(window, cx).placeholder("Name"));
        let front_input = cx.new(|cx| {
            InputState::new(window, cx)
                .multi_line(true)
                .rows(4)
                .placeholder("Front")
        });
        let back_input = cx.new(|cx| {
            InputState::new(window, cx)
                .multi_line(true)
                .rows(4)
                .placeholder("Back  (use ==word== to mark quiz terms)")
        });
        let import_input = cx.new(|cx| {
            InputState::new(window, cx)
                .multi_line(true)
                .rows(12)
                .placeholder("Paste cards…")
        });

        let mut app = Self {
            store,
            folders: Vec::new(),
            decks: Vec::new(),
            cards: Vec::new(),
            stats: HashMap::new(),
            expanded: HashSet::new(),
            selected: Selection::None,
            overlay: Overlay::None,
            study: None,
            notice: None,
            name_input,
            front_input,
            back_input,
            import_input,
            focus_handle: cx.focus_handle(),
        };
        app.reload();
        for folder in &app.folders {
            if folder.parent_id.is_none() {
                app.expanded.insert(folder.id);
            }
        }
        app
    }

    fn reload(&mut self) {
        self.folders = self.store.list_folders().unwrap_or_default();
        self.decks = self.store.list_decks().unwrap_or_default();
        self.stats = self.store.deck_stats(Utc::now()).unwrap_or_default();
        self.cards = match self.selected {
            Selection::Deck(id) => self.store.list_cards(id).unwrap_or_default(),
            _ => Vec::new(),
        };
    }

    fn fail(&mut self, err: impl std::fmt::Display) {
        self.notice = Some(err.to_string());
    }

    fn current_folder(&self) -> Option<FolderId> {
        match self.selected {
            Selection::Folder(id) => Some(id),
            Selection::Deck(id) => self
                .decks
                .iter()
                .find(|d| d.id == id)
                .and_then(|d| d.folder_id),
            Selection::None => None,
        }
    }

    fn selected_deck(&self) -> Option<&Deck> {
        match self.selected {
            Selection::Deck(id) => self.decks.iter().find(|d| d.id == id),
            _ => None,
        }
    }

    fn selected_folder(&self) -> Option<&Folder> {
        match self.selected {
            Selection::Folder(id) => self.folders.iter().find(|f| f.id == id),
            _ => None,
        }
    }

    fn open_name(
        &mut self,
        title: impl Into<SharedString>,
        kind: NameKind,
        preset: impl Into<String>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let preset = preset.into();
        self.name_input.update(cx, |input, cx| {
            input.set_value(preset, window, cx);
        });
        self.overlay = Overlay::Name {
            title: title.into(),
            kind,
        };
        cx.notify();
    }

    fn submit_name(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let Overlay::Name { kind, .. } = self.overlay.clone() else {
            return;
        };
        let name = self.name_input.read(cx).value().to_string();
        let result = match kind {
            NameKind::NewFolder => {
                self.store
                    .create_folder(self.current_folder(), &name)
                    .map(|f| {
                        self.selected = Selection::Folder(f.id);
                        if let Some(parent) = f.parent_id {
                            self.expanded.insert(parent);
                        }
                    })
            }
            NameKind::NewDeck => self
                .store
                .create_deck(self.current_folder(), &name)
                .map(|d| {
                    self.selected = Selection::Deck(d.id);
                    if let Some(parent) = d.folder_id {
                        self.expanded.insert(parent);
                    }
                }),
            NameKind::RenameFolder(id) => self.store.rename_folder(id, &name),
            NameKind::RenameDeck(id) => self.store.rename_deck(id, &name),
        };
        match result {
            Ok(_) => {
                self.overlay = Overlay::None;
                self.reload();
            }
            Err(err) => self.fail(err),
        }
        let _ = window;
        cx.notify();
    }

    fn confirm(&mut self, cx: &mut Context<Self>) {
        let Overlay::Confirm { kind, .. } = self.overlay.clone() else {
            return;
        };
        let result = match kind {
            ConfirmKind::DeleteFolder(id) => {
                if matches!(self.selected, Selection::Folder(s) if s == id) {
                    self.selected = Selection::None;
                }
                self.store.delete_folder(id)
            }
            ConfirmKind::DeleteDeck(id) => {
                if matches!(self.selected, Selection::Deck(s) if s == id) {
                    self.selected = Selection::None;
                }
                self.store.delete_deck(id)
            }
            ConfirmKind::DeleteCard(id) => self.store.delete_card(id),
        };
        match result {
            Ok(_) => {
                self.overlay = Overlay::None;
                self.reload();
            }
            Err(err) => self.fail(err),
        }
        cx.notify();
    }

    fn submit_import(&mut self, cx: &mut Context<Self>) {
        let text = self.import_input.read(cx).value().to_string();
        let mut cards = import::parse(&text);
        if cards.is_empty() {
            self.fail("No cards found. Use a front line, then - back lines.");
            cx.notify();
            return;
        }
        if let Err(err) = studybuddy_core::openai::fill_missing_keywords(&mut cards) {
            self.notice = Some(format!("Imported without AI keywords ({err})"));
        }
        let deck_id = match self.selected {
            Selection::Deck(id) => id,
            _ => match self.store.create_deck(self.current_folder(), "Imported") {
                Ok(d) => {
                    self.selected = Selection::Deck(d.id);
                    d.id
                }
                Err(err) => {
                    self.fail(err);
                    cx.notify();
                    return;
                }
            },
        };
        match self.store.import_cards(deck_id, &cards) {
            Ok(n) => {
                self.overlay = Overlay::None;
                self.reload();
                self.notice = Some(format!("Imported {n} cards"));
            }
            Err(err) => self.fail(err),
        }
        cx.notify();
    }

    fn import_from_file(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let path = rfd::FileDialog::new()
            .add_filter("Text", &["txt", "md"])
            .pick_file();
        if let Some(path) = path {
            match std::fs::read_to_string(&path) {
                Ok(text) => {
                    self.import_input.update(cx, |input, cx| {
                        input.set_value(text, window, cx);
                    });
                }
                Err(err) => self.fail(err),
            }
        }
        cx.notify();
    }

    fn open_edit(&mut self, id: Option<CardId>, window: &mut Window, cx: &mut Context<Self>) {
        let (front, back) = if let Some(id) = id {
            match self.store.get_card(id) {
                Ok(card) => {
                    let front_h: Vec<String> = card
                        .highlights
                        .iter()
                        .filter(|h| h.side == Side::Front)
                        .map(|h| h.text.clone())
                        .collect();
                    let back_h: Vec<String> = card
                        .highlights
                        .iter()
                        .filter(|h| h.side == Side::Back)
                        .map(|h| h.text.clone())
                        .collect();
                    (
                        wrap_marks(&card.front, &front_h),
                        wrap_marks(&card.back, &back_h),
                    )
                }
                Err(err) => {
                    self.fail(err);
                    cx.notify();
                    return;
                }
            }
        } else {
            (String::new(), String::new())
        };
        self.front_input.update(cx, |input, cx| {
            input.set_value(front, window, cx);
        });
        self.back_input.update(cx, |input, cx| {
            input.set_value(back, window, cx);
        });
        self.overlay = Overlay::EditCard { id };
        cx.notify();
    }

    fn save_card(&mut self, cx: &mut Context<Self>) {
        let Overlay::EditCard { id } = self.overlay else {
            return;
        };
        let front_raw = self.front_input.read(cx).value().to_string();
        let back_raw = self.back_input.read(cx).value().to_string();
        let (front, front_marks) = import::strip_marks(&front_raw);
        let (back, back_marks) = import::strip_marks(&back_raw);
        if front.trim().is_empty() {
            self.fail("Front is empty");
            cx.notify();
            return;
        }
        let mut highlights = Vec::new();
        for text in front_marks {
            highlights.push(Highlight {
                side: Side::Front,
                text,
            });
        }
        for text in back_marks {
            highlights.push(Highlight {
                side: Side::Back,
                text,
            });
        }
        if highlights.is_empty() {
            highlights = import::heuristic_highlights(&front, &back);
        }
        let result = if let Some(id) = id {
            self.store.update_card(id, &front, &back, &highlights)
        } else {
            let Some(deck) = self.selected_deck() else {
                self.fail("Select a deck first");
                cx.notify();
                return;
            };
            self.store
                .create_card(
                    deck.id,
                    &NewCard {
                        front,
                        back,
                        highlights,
                    },
                )
                .map(|_| ())
        };
        match result {
            Ok(_) => {
                self.overlay = Overlay::None;
                self.reload();
            }
            Err(err) => self.fail(err),
        }
        cx.notify();
    }

    fn move_to(&mut self, folder_id: Option<FolderId>, cx: &mut Context<Self>) {
        let Overlay::Move { kind } = self.overlay else {
            return;
        };
        let result = match kind {
            MoveKind::Folder(id) => self.store.move_folder(id, folder_id),
            MoveKind::Deck(id) => self.store.move_deck(id, folder_id),
        };
        match result {
            Ok(_) => {
                self.overlay = Overlay::None;
                self.reload();
            }
            Err(err) => self.fail(err),
        }
        cx.notify();
    }

    fn start_study(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let Some(deck) = self.selected_deck().cloned() else {
            self.fail("Select a deck to study");
            cx.notify();
            return;
        };
        let due = match self.store.due_cards(deck.id, Utc::now()) {
            Ok(cards) => cards,
            Err(err) => {
                self.fail(err);
                cx.notify();
                return;
            }
        };
        if due.is_empty() {
            self.fail("Nothing due in this deck");
            cx.notify();
            return;
        }
        let deck_cards = self.store.list_cards(deck.id).unwrap_or_default();
        let mut session = Session::new(due);
        let current = next_question(&mut session, &self.store, &deck_cards);
        self.study = Some(StudyView {
            session,
            current,
            feedback: None,
            deck_cards,
            done: false,
        });
        if self
            .study
            .as_ref()
            .and_then(|s| s.current.as_ref())
            .is_none()
        {
            if let Some(s) = self.study.as_mut() {
                s.done = true;
            }
        }
        window.focus(&self.focus_handle);
        cx.notify();
    }

    fn pick(&mut self, index: usize, cx: &mut Context<Self>) {
        let Some(study) = self.study.as_mut() else {
            return;
        };
        if study.feedback.is_some() || study.done {
            return;
        }
        let Some(question) = study.current.clone() else {
            return;
        };
        if index >= question.choices.len() {
            return;
        }
        let correct = index == question.answer_index;
        study.session.answer(question.card_id, correct);
        if let Ok(mut card) = self.store.get_card(question.card_id) {
            apply_answer(&mut card, correct, Utc::now());
            let _ = self.store.save_card_srs(&card);
            let _ = self.store.log_review(question.card_id, correct);
        }
        study.feedback = Some(Feedback {
            picked: index,
            correct,
        });
        cx.notify();
    }

    fn continue_study(&mut self, cx: &mut Context<Self>) {
        let Some(study) = self.study.as_mut() else {
            return;
        };
        if study.feedback.is_none() {
            return;
        }
        study.feedback = None;
        let next = next_question(&mut study.session, &self.store, &study.deck_cards);
        if next.is_none() {
            study.done = true;
            study.current = None;
            self.reload();
        } else {
            study.current = next;
        }
        cx.notify();
    }

    fn exit_study(&mut self, cx: &mut Context<Self>) {
        self.study = None;
        self.reload();
        cx.notify();
    }
}

fn next_question(session: &mut Session, store: &Store, deck_cards: &[Card]) -> Option<Question> {
    let id = session.next_card()?;
    let card = store.get_card(id).ok()?;
    let mut rng = rng();
    Some(quiz::build_question(&card, deck_cards, &mut rng))
}

fn db_path() -> PathBuf {
    if let Some(dirs) = directories::ProjectDirs::from("dev", "yanicells", "Studybuddy") {
        dirs.data_dir().join("studybuddy.db")
    } else {
        PathBuf::from("studybuddy.db")
    }
}

impl Render for Studybuddy {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let overlay = self.overlay.clone();
        let studying = self.study.is_some();

        div()
            .track_focus(&self.focus_handle)
            .key_context("Studybuddy")
            .size_full()
            .flex()
            .flex_col()
            .bg(rgb(CANVAS))
            .text_color(rgb(INK))
            .on_key_down(cx.listener(|this, event: &gpui::KeyDownEvent, _, cx| {
                let key = event.keystroke.key.as_str();
                if this.study.is_some() {
                    match key {
                        "1" => this.pick(0, cx),
                        "2" => this.pick(1, cx),
                        "3" => this.pick(2, cx),
                        "4" => this.pick(3, cx),
                        "enter" | "space" => this.continue_study(cx),
                        "escape" => this.exit_study(cx),
                        _ => {}
                    }
                    return;
                }
                if key == "escape" {
                    this.overlay = Overlay::None;
                    cx.notify();
                }
            }))
            .child(if studying {
                self.render_study(cx).into_any_element()
            } else {
                self.render_library(cx).into_any_element()
            })
            .children(self.render_overlay(overlay, window, cx))
    }
}

impl Studybuddy {
    fn render_library(&mut self, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex()
            .flex_row()
            .size_full()
            .child(self.render_sidebar(cx))
            .child(self.render_main(cx))
    }

    fn render_sidebar(&mut self, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .w(px(280.))
            .h_full()
            .flex()
            .flex_col()
            .bg(rgb(SIDEBAR))
            .border_r_1()
            .border_color(rgb(LINE))
            .child(
                div()
                    .px_4()
                    .py_3()
                    .border_b_1()
                    .border_color(rgb(LINE))
                    .child(
                        div()
                            .flex()
                            .flex_row()
                            .items_center()
                            .gap_2()
                            .child(div().w(px(18.)).h(px(18.)).rounded_sm().bg(rgb(ACCENT)))
                            .child(
                                div()
                                    .text_sm()
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .child("Studybuddy"),
                            ),
                    ),
            )
            .child(
                div()
                    .px_3()
                    .py_2()
                    .flex()
                    .flex_row()
                    .gap_2()
                    .child(
                        Button::new("new-folder")
                            .ghost()
                            .label("Folder")
                            .on_click(cx.listener(|this, _, window, cx| {
                                this.open_name("New folder", NameKind::NewFolder, "", window, cx);
                            })),
                    )
                    .child(
                        Button::new("new-deck")
                            .ghost()
                            .label("Deck")
                            .on_click(cx.listener(|this, _, window, cx| {
                                this.open_name("New deck", NameKind::NewDeck, "", window, cx);
                            })),
                    ),
            )
            .child(
                div()
                    .id("sidebar-tree")
                    .flex_1()
                    .px_2()
                    .pb_3()
                    .overflow_y_scroll()
                    .child(self.render_tree(cx)),
            )
    }

    fn render_tree(&mut self, cx: &mut Context<Self>) -> impl IntoElement {
        let mut col = div().flex().flex_col().gap_1();
        let roots: Vec<Folder> = self
            .folders
            .iter()
            .filter(|f| f.parent_id.is_none())
            .cloned()
            .collect();
        for folder in roots {
            col = col.child(self.folder_branch(&folder, 0, cx));
        }
        let root_decks: Vec<Deck> = self
            .decks
            .iter()
            .filter(|d| d.folder_id.is_none())
            .cloned()
            .collect();
        for deck in root_decks {
            col = col.child(self.deck_row(&deck, 0, cx));
        }
        col
    }

    fn folder_branch(&mut self, folder: &Folder, depth: u32, cx: &mut Context<Self>) -> AnyElement {
        let id = folder.id;
        let expanded = self.expanded.contains(&id);
        let selected = matches!(self.selected, Selection::Folder(s) if s == id);
        let mut col = div().flex().flex_col();
        col = col.child(
            div()
                .id(SharedString::from(format!("folder-{}", id.0)))
                .flex()
                .flex_row()
                .items_center()
                .h(px(30.))
                .px_2()
                .ml(px(depth as f32 * 12.))
                .rounded_md()
                .cursor_pointer()
                .when(selected, |d| d.bg(rgb(SELECT)))
                .hover(|d| d.bg(rgb(SELECT)))
                .on_click(cx.listener(move |this, _, _, cx| {
                    if this.expanded.contains(&id) {
                        this.expanded.remove(&id);
                    } else {
                        this.expanded.insert(id);
                    }
                    this.selected = Selection::Folder(id);
                    this.reload();
                    cx.notify();
                }))
                .child(
                    div()
                        .w(px(14.))
                        .text_color(rgb(MUTED))
                        .text_xs()
                        .child(if expanded { "▾" } else { "▸" }),
                )
                .child(div().text_sm().child(folder.name.clone())),
        );
        if expanded {
            let children: Vec<Folder> = self
                .folders
                .iter()
                .filter(|f| f.parent_id == Some(id))
                .cloned()
                .collect();
            for child in children {
                col = col.child(self.folder_branch(&child, depth + 1, cx));
            }
            let decks: Vec<Deck> = self
                .decks
                .iter()
                .filter(|d| d.folder_id == Some(id))
                .cloned()
                .collect();
            for deck in decks {
                col = col.child(self.deck_row(&deck, depth + 1, cx));
            }
        }
        col.into_any_element()
    }

    fn deck_row(&mut self, deck: &Deck, depth: u32, cx: &mut Context<Self>) -> impl IntoElement {
        let id = deck.id;
        let selected = matches!(self.selected, Selection::Deck(s) if s == id);
        let due = self.stats.get(&id).map(|s| s.due).unwrap_or(0);
        div()
            .id(SharedString::from(format!("deck-{}", id.0)))
            .flex()
            .flex_row()
            .items_center()
            .justify_between()
            .h(px(30.))
            .px_2()
            .ml(px(depth as f32 * 12. + 14.))
            .rounded_md()
            .cursor_pointer()
            .when(selected, |d| d.bg(rgb(SELECT)))
            .hover(|d| d.bg(rgb(SELECT)))
            .on_click(cx.listener(move |this, _, _, cx| {
                this.selected = Selection::Deck(id);
                this.reload();
                cx.notify();
            }))
            .child(div().text_sm().child(deck.name.clone()))
            .when(due > 0, |d| {
                d.child(
                    div()
                        .text_xs()
                        .text_color(rgb(ACCENT))
                        .child(due.to_string()),
                )
            })
    }

    fn render_main(&mut self, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex_1()
            .h_full()
            .flex()
            .flex_col()
            .child(self.render_header(cx))
            .child(
                div()
                    .id("main-scroll")
                    .flex_1()
                    .overflow_y_scroll()
                    .px_6()
                    .py_4()
                    .child(self.render_content(cx)),
            )
            .children(self.notice.clone().map(|msg| {
                div()
                    .px_6()
                    .py_2()
                    .text_sm()
                    .text_color(rgb(ACCENT))
                    .child(msg)
            }))
    }

    fn render_header(&mut self, cx: &mut Context<Self>) -> impl IntoElement {
        let title = match self.selected {
            Selection::None => "Library".to_string(),
            Selection::Folder(_) => self
                .selected_folder()
                .map(|f| f.name.clone())
                .unwrap_or_else(|| "Folder".into()),
            Selection::Deck(_) => self
                .selected_deck()
                .map(|d| d.name.clone())
                .unwrap_or_else(|| "Deck".into()),
        };

        let mut actions = div().flex().flex_row().gap_2();
        match self.selected {
            Selection::Folder(id) => {
                let name = self
                    .selected_folder()
                    .map(|f| f.name.clone())
                    .unwrap_or_default();
                actions =
                    actions
                        .child(
                            Button::new("rename-folder")
                                .ghost()
                                .label("Rename")
                                .on_click({
                                    let name = name.clone();
                                    cx.listener(move |this, _, window, cx| {
                                        this.open_name(
                                            "Rename folder",
                                            NameKind::RenameFolder(id),
                                            &name,
                                            window,
                                            cx,
                                        );
                                    })
                                }),
                        )
                        .child(Button::new("move-folder").ghost().label("Move").on_click(
                            cx.listener(move |this, _, _, cx| {
                                this.overlay = Overlay::Move {
                                    kind: MoveKind::Folder(id),
                                };
                                cx.notify();
                            }),
                        ))
                        .child(
                            Button::new("delete-folder")
                                .ghost()
                                .label("Delete")
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    this.overlay = Overlay::Confirm {
                                        title: "Delete folder?".into(),
                                        body: "Decks and cards inside will be removed.".into(),
                                        kind: ConfirmKind::DeleteFolder(id),
                                    };
                                    cx.notify();
                                })),
                        );
            }
            Selection::Deck(id) => {
                let name = self
                    .selected_deck()
                    .map(|d| d.name.clone())
                    .unwrap_or_default();
                let due = self.stats.get(&id).map(|s| s.due).unwrap_or(0);
                actions =
                    actions
                        .child(
                            Button::new("study")
                                .primary()
                                .label(if due > 0 {
                                    format!("Study ({due})")
                                } else {
                                    "Study".into()
                                })
                                .on_click(
                                    cx.listener(|this, _, window, cx| this.start_study(window, cx)),
                                ),
                        )
                        .child(Button::new("import").label("Import").on_click(cx.listener(
                            |this, _, window, cx| {
                                this.import_input
                                    .update(cx, |input, cx| input.set_value("", window, cx));
                                this.overlay = Overlay::Import;
                                cx.notify();
                            },
                        )))
                        .child(
                            Button::new("new-card")
                                .ghost()
                                .label("Card")
                                .on_click(cx.listener(|this, _, window, cx| {
                                    this.open_edit(None, window, cx);
                                })),
                        )
                        .child(
                            Button::new("rename-deck")
                                .ghost()
                                .label("Rename")
                                .on_click({
                                    let name = name.clone();
                                    cx.listener(move |this, _, window, cx| {
                                        this.open_name(
                                            "Rename deck",
                                            NameKind::RenameDeck(id),
                                            &name,
                                            window,
                                            cx,
                                        );
                                    })
                                }),
                        )
                        .child(Button::new("move-deck").ghost().label("Move").on_click(
                            cx.listener(move |this, _, _, cx| {
                                this.overlay = Overlay::Move {
                                    kind: MoveKind::Deck(id),
                                };
                                cx.notify();
                            }),
                        ))
                        .child(Button::new("delete-deck").ghost().label("Delete").on_click(
                            cx.listener(move |this, _, _, cx| {
                                this.overlay = Overlay::Confirm {
                                    title: "Delete deck?".into(),
                                    body: "All cards in this deck will be removed.".into(),
                                    kind: ConfirmKind::DeleteDeck(id),
                                };
                                cx.notify();
                            }),
                        ));
            }
            Selection::None => {}
        }

        div()
            .px_6()
            .py_3()
            .border_b_1()
            .border_color(rgb(LINE))
            .flex()
            .flex_row()
            .items_center()
            .justify_between()
            .child(
                div()
                    .text_lg()
                    .font_weight(FontWeight::SEMIBOLD)
                    .child(title),
            )
            .child(actions)
    }

    fn render_content(&mut self, cx: &mut Context<Self>) -> AnyElement {
        match self.selected {
            Selection::None => empty_state("Pick a folder or deck, or create one."),
            Selection::Folder(_) => self.render_folder_contents(cx),
            Selection::Deck(_) => self.render_deck_contents(cx),
        }
    }

    fn render_folder_contents(&mut self, cx: &mut Context<Self>) -> AnyElement {
        let Selection::Folder(id) = self.selected else {
            return empty_state("Folder");
        };
        let child_folders: Vec<Folder> = self
            .folders
            .iter()
            .filter(|f| f.parent_id == Some(id))
            .cloned()
            .collect();
        let child_decks: Vec<Deck> = self
            .decks
            .iter()
            .filter(|d| d.folder_id == Some(id))
            .cloned()
            .collect();
        if child_folders.is_empty() && child_decks.is_empty() {
            return empty_state("This folder is empty.");
        }
        let mut col = div().flex().flex_col().gap_2();
        for folder in child_folders {
            let fid = folder.id;
            col = col.child(row_card(
                format!("folder-card-{}", fid.0),
                folder.name,
                "Folder",
                cx.listener(move |this, _, _, cx| {
                    this.selected = Selection::Folder(fid);
                    this.expanded.insert(fid);
                    this.reload();
                    cx.notify();
                }),
            ));
        }
        for deck in child_decks {
            let did = deck.id;
            let stats = self.stats.get(&did).cloned().unwrap_or_default();
            col = col.child(row_card(
                format!("deck-card-{}", did.0),
                deck.name,
                format!(
                    "{} due · {} new · {} learning · {} mastered",
                    stats.due, stats.new, stats.learning, stats.mastered
                ),
                cx.listener(move |this, _, _, cx| {
                    this.selected = Selection::Deck(did);
                    this.reload();
                    cx.notify();
                }),
            ));
        }
        col.into_any_element()
    }

    fn render_deck_contents(&mut self, cx: &mut Context<Self>) -> AnyElement {
        let Some(deck) = self.selected_deck().cloned() else {
            return empty_state("Deck");
        };
        let stats = self.stats.get(&deck.id).cloned().unwrap_or_default();
        let mut col = div().flex().flex_col().gap_4();
        col = col.child(
            div()
                .flex()
                .flex_row()
                .gap_2()
                .child(chip("New", stats.new, NEW))
                .child(chip("Learning", stats.learning, LEARNING))
                .child(chip("Mastered", stats.mastered, MASTERED)),
        );
        if self.cards.is_empty() {
            col = col.child(empty_state("No cards yet. Import a list or add one."));
            return col.into_any_element();
        }
        for card in self.cards.clone() {
            let id = card.id;
            col = col.child(
                div()
                    .flex()
                    .flex_row()
                    .items_start()
                    .justify_between()
                    .gap_3()
                    .p_3()
                    .rounded_lg()
                    .border_1()
                    .border_color(rgb(LINE))
                    .bg(rgb(CARD))
                    .child(
                        div()
                            .flex_1()
                            .flex()
                            .flex_col()
                            .gap_1()
                            .child(div().text_sm().child(card.front.clone()))
                            .child(
                                div()
                                    .text_sm()
                                    .text_color(rgb(MUTED))
                                    .child(card.back.replace('\n', " · ")),
                            ),
                    )
                    .child(
                        div()
                            .flex()
                            .flex_row()
                            .items_center()
                            .gap_2()
                            .child(status_chip(card.status))
                            .child(
                                Button::new(SharedString::from(format!("edit-{}", id.0)))
                                    .ghost()
                                    .label("Edit")
                                    .on_click(cx.listener(move |this, _, window, cx| {
                                        this.open_edit(Some(id), window, cx);
                                    })),
                            )
                            .child(
                                Button::new(SharedString::from(format!("del-{}", id.0)))
                                    .ghost()
                                    .label("Delete")
                                    .on_click(cx.listener(move |this, _, _, cx| {
                                        this.overlay = Overlay::Confirm {
                                            title: "Delete card?".into(),
                                            body: "This cannot be undone.".into(),
                                            kind: ConfirmKind::DeleteCard(id),
                                        };
                                        cx.notify();
                                    })),
                            ),
                    ),
            );
        }
        col.into_any_element()
    }

    fn render_study(&mut self, cx: &mut Context<Self>) -> impl IntoElement {
        let Some(study) = self.study.as_ref() else {
            return div();
        };
        let remaining = study.session.remaining();
        let shown = study.session.answered_count();
        let wave = study.session.wave();

        let mut body = div()
            .flex_1()
            .flex()
            .flex_col()
            .items_center()
            .justify_center()
            .px_8();

        if study.done {
            body = body.child(
                div()
                    .w(px(520.))
                    .p_8()
                    .rounded_xl()
                    .bg(rgb(CARD))
                    .border_1()
                    .border_color(rgb(LINE))
                    .flex()
                    .flex_col()
                    .gap_4()
                    .items_center()
                    .child(
                        div()
                            .text_lg()
                            .font_weight(FontWeight::SEMIBOLD)
                            .child("That's the set"),
                    )
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(MUTED))
                            .child("Come back tomorrow for the ones that graduated."),
                    )
                    .child(
                        Button::new("done-study")
                            .primary()
                            .label("Back")
                            .on_click(cx.listener(|this, _, _, cx| this.exit_study(cx))),
                    ),
            );
        } else if let Some(question) = study.current.clone() {
            let feedback = study.feedback.as_ref();
            body = body.child(
                div()
                    .w(px(640.))
                    .flex()
                    .flex_col()
                    .gap_5()
                    .child(self.render_prompt(&question))
                    .child(self.render_choices(&question, feedback, cx))
                    .when(feedback.is_some(), |d| {
                        let fb = feedback.unwrap();
                        d.child(
                            div()
                                .flex()
                                .flex_col()
                                .gap_3()
                                .items_start()
                                .child(
                                    div()
                                        .text_sm()
                                        .font_weight(FontWeight::MEDIUM)
                                        .text_color(rgb(if fb.correct { MASTERED } else { WRONG }))
                                        .child(if fb.correct { "Correct" } else { "Not quite" }),
                                )
                                .when(!fb.correct, |d| {
                                    d.child(
                                        div()
                                            .text_sm()
                                            .text_color(rgb(MUTED))
                                            .child(format!("Answer: {}", question.answer)),
                                    )
                                })
                                .child(
                                    Button::new("continue")
                                        .primary()
                                        .label("Continue")
                                        .on_click(
                                            cx.listener(|this, _, _, cx| this.continue_study(cx)),
                                        ),
                                ),
                        )
                    }),
            );
        }

        div()
            .size_full()
            .flex()
            .flex_col()
            .bg(rgb(CANVAS))
            .child(
                div()
                    .px_6()
                    .py_3()
                    .flex()
                    .flex_row()
                    .items_center()
                    .justify_between()
                    .border_b_1()
                    .border_color(rgb(LINE))
                    .child(
                        Button::new("leave-study")
                            .ghost()
                            .label("Leave")
                            .on_click(cx.listener(|this, _, _, cx| this.exit_study(cx))),
                    )
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(MUTED))
                            .child(format!("Wave {wave} · {shown} seen · {remaining} left")),
                    ),
            )
            .child(body)
    }

    fn render_prompt(&self, question: &Question) -> impl IntoElement {
        let inner = match &question.prompt {
            Prompt::Front { text } => div().text_lg().child(text.clone()).into_any_element(),
            Prompt::Cloze { segments } => {
                let mut line = div().flex().flex_row().flex_wrap().items_center().gap_1();
                for segment in segments {
                    line = match segment {
                        Segment::Text(t) => line.child(div().text_lg().child(t.clone())),
                        Segment::Blank { text, target } => line.child(blank_pill(text, *target)),
                    };
                }
                line.into_any_element()
            }
        };
        div()
            .p_6()
            .rounded_xl()
            .bg(rgb(CARD))
            .border_1()
            .border_color(rgb(LINE))
            .child(inner)
    }

    fn render_choices(
        &self,
        question: &Question,
        feedback: Option<&Feedback>,
        cx: &mut Context<Self>,
    ) -> impl IntoElement {
        let mut col = div().flex().flex_col().gap_2();
        for (i, choice) in question.choices.iter().enumerate() {
            let mut bg = CARD;
            let mut border = LINE;
            if let Some(fb) = feedback {
                if i == question.answer_index {
                    bg = 0xE7F0EA;
                    border = MASTERED;
                } else if i == fb.picked {
                    bg = 0xF6E8E5;
                    border = WRONG;
                }
            }
            col = col.child(
                div()
                    .id(SharedString::from(format!("choice-{i}")))
                    .flex()
                    .flex_row()
                    .items_center()
                    .gap_3()
                    .px_4()
                    .py_3()
                    .rounded_lg()
                    .border_1()
                    .border_color(rgb(border))
                    .bg(rgb(bg))
                    .cursor_pointer()
                    .hover(|d| d.border_color(rgb(ACCENT)))
                    .on_click(cx.listener(move |this, _, _, cx| this.pick(i, cx)))
                    .child(
                        div()
                            .w(px(22.))
                            .h(px(22.))
                            .rounded_full()
                            .border_1()
                            .border_color(rgb(LINE))
                            .flex()
                            .items_center()
                            .justify_center()
                            .text_xs()
                            .text_color(rgb(MUTED))
                            .child((i + 1).to_string()),
                    )
                    .child(div().text_sm().child(choice.clone())),
            );
        }
        col
    }

    fn render_overlay(
        &mut self,
        overlay: Overlay,
        _window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Option<impl IntoElement> {
        if matches!(overlay, Overlay::None) {
            return None;
        }
        let card = match overlay {
            Overlay::None => return None,
            Overlay::Name { title, .. } => modal(
                title,
                div()
                    .flex()
                    .flex_col()
                    .gap_3()
                    .child(Input::new(&self.name_input))
                    .child(
                        div()
                            .flex()
                            .flex_row()
                            .justify_end()
                            .gap_2()
                            .child(Button::new("cancel-name").label("Cancel").on_click(
                                cx.listener(|this, _, _, cx| {
                                    this.overlay = Overlay::None;
                                    cx.notify();
                                }),
                            ))
                            .child(Button::new("ok-name").primary().label("Save").on_click(
                                cx.listener(|this, _, window, cx| {
                                    this.submit_name(window, cx);
                                }),
                            )),
                    ),
            ),
            Overlay::Confirm { title, body, .. } => {
                modal(
                    title,
                    div()
                        .flex()
                        .flex_col()
                        .gap_3()
                        .child(div().text_sm().text_color(rgb(MUTED)).child(body))
                        .child(
                            div()
                                .flex()
                                .flex_row()
                                .justify_end()
                                .gap_2()
                                .child(Button::new("cancel-del").label("Cancel").on_click(
                                    cx.listener(|this, _, _, cx| {
                                        this.overlay = Overlay::None;
                                        cx.notify();
                                    }),
                                ))
                                .child(Button::new("ok-del").danger().label("Delete").on_click(
                                    cx.listener(|this, _, _, cx| {
                                        this.confirm(cx);
                                    }),
                                )),
                        ),
                )
            }
            Overlay::Import => modal(
                "Import cards",
                div()
                    .flex()
                    .flex_col()
                    .gap_3()
                    .w(px(520.))
                    .child(div().text_sm().text_color(rgb(MUTED)).child(
                        "Front on the first line. Back on - lines. Mark terms with ==word==.",
                    ))
                    .child(div().h(px(240.)).child(Input::new(&self.import_input)))
                    .child(
                        div()
                            .flex()
                            .flex_row()
                            .justify_between()
                            .child(
                                Button::new("from-file")
                                    .ghost()
                                    .label("From file")
                                    .on_click(cx.listener(|this, _, window, cx| {
                                        this.import_from_file(window, cx);
                                    })),
                            )
                            .child(
                                div()
                                    .flex()
                                    .flex_row()
                                    .gap_2()
                                    .child(Button::new("cancel-import").label("Cancel").on_click(
                                        cx.listener(|this, _, _, cx| {
                                            this.overlay = Overlay::None;
                                            cx.notify();
                                        }),
                                    ))
                                    .child(
                                        Button::new("ok-import")
                                            .primary()
                                            .label("Import")
                                            .on_click(cx.listener(|this, _, _, cx| {
                                                this.submit_import(cx);
                                            })),
                                    ),
                            ),
                    ),
            ),
            Overlay::EditCard { id } => modal(
                if id.is_some() {
                    "Edit card"
                } else {
                    "New card"
                },
                div()
                    .flex()
                    .flex_col()
                    .gap_3()
                    .w(px(520.))
                    .child(div().text_xs().text_color(rgb(MUTED)).child("Front"))
                    .child(div().h(px(110.)).child(Input::new(&self.front_input)))
                    .child(div().text_xs().text_color(rgb(MUTED)).child("Back"))
                    .child(div().h(px(110.)).child(Input::new(&self.back_input)))
                    .child(
                        div()
                            .flex()
                            .flex_row()
                            .justify_end()
                            .gap_2()
                            .child(Button::new("cancel-card").label("Cancel").on_click(
                                cx.listener(|this, _, _, cx| {
                                    this.overlay = Overlay::None;
                                    cx.notify();
                                }),
                            ))
                            .child(Button::new("ok-card").primary().label("Save").on_click(
                                cx.listener(|this, _, _, cx| {
                                    this.save_card(cx);
                                }),
                            )),
                    ),
            ),
            Overlay::Move { kind } => self.render_move_modal(kind, cx),
        };

        Some(
            div()
                .absolute()
                .size_full()
                .top_0()
                .left_0()
                .flex()
                .items_center()
                .justify_center()
                .bg(gpui::hsla(0., 0., 0.12, 0.28))
                .on_mouse_down(
                    gpui::MouseButton::Left,
                    cx.listener(|this, _, _, cx| {
                        this.overlay = Overlay::None;
                        cx.notify();
                    }),
                )
                .child(card),
        )
    }

    fn render_move_modal(&self, kind: MoveKind, cx: &mut Context<Self>) -> AnyElement {
        let blocked = match kind {
            MoveKind::Folder(id) => {
                let mut set = self.store.folder_descendants(id).unwrap_or_default();
                set.push(id);
                set
            }
            MoveKind::Deck(_) => Vec::new(),
        };
        let mut list = div()
            .id("move-list")
            .flex()
            .flex_col()
            .gap_1()
            .max_h(px(320.))
            .overflow_y_scroll();
        list = list.child(move_row("Library", None, cx));
        for folder in &self.folders {
            if blocked.contains(&folder.id) {
                continue;
            }
            list = list.child(move_row(&folder.name, Some(folder.id), cx));
        }
        modal("Move to", list)
    }
}

fn move_row(
    name: &str,
    folder_id: Option<FolderId>,
    cx: &mut Context<Studybuddy>,
) -> impl IntoElement {
    let label = name.to_string();
    div()
        .id(SharedString::from(format!(
            "move-{}",
            folder_id.map(|f| f.0).unwrap_or(-1)
        )))
        .px_3()
        .py_2()
        .rounded_md()
        .cursor_pointer()
        .hover(|d| d.bg(rgb(SELECT)))
        .on_click(cx.listener(move |this, _, _, cx| this.move_to(folder_id, cx)))
        .child(div().text_sm().child(label))
}

fn modal(title: impl Into<SharedString>, body: impl IntoElement) -> AnyElement {
    div()
        .on_mouse_down(gpui::MouseButton::Left, |_, _, _| {})
        .p_5()
        .rounded_xl()
        .bg(rgb(CARD))
        .border_1()
        .border_color(rgb(LINE))
        .shadow_lg()
        .flex()
        .flex_col()
        .gap_3()
        .child(
            div()
                .text_sm()
                .font_weight(FontWeight::SEMIBOLD)
                .child(title.into()),
        )
        .child(body)
        .into_any_element()
}

fn empty_state(text: &str) -> AnyElement {
    div()
        .pt_8()
        .text_sm()
        .text_color(rgb(MUTED))
        .child(text.to_string())
        .into_any_element()
}

fn row_card(
    id: impl Into<SharedString>,
    title: impl Into<String>,
    subtitle: impl Into<String>,
    on_click: impl Fn(&gpui::ClickEvent, &mut Window, &mut gpui::App) + 'static,
) -> impl IntoElement {
    div()
        .id(id.into())
        .p_3()
        .rounded_lg()
        .border_1()
        .border_color(rgb(LINE))
        .bg(rgb(CARD))
        .cursor_pointer()
        .hover(|d| d.border_color(rgb(ACCENT)))
        .on_click(on_click)
        .flex()
        .flex_col()
        .gap_1()
        .child(
            div()
                .text_sm()
                .font_weight(FontWeight::MEDIUM)
                .child(title.into()),
        )
        .child(
            div()
                .text_xs()
                .text_color(rgb(MUTED))
                .child(subtitle.into()),
        )
}

fn chip(label: &str, n: u32, color: u32) -> impl IntoElement {
    div()
        .flex()
        .flex_row()
        .items_center()
        .gap_2()
        .px_3()
        .py_1()
        .rounded_md()
        .bg(rgb(CARD))
        .border_1()
        .border_color(rgb(LINE))
        .child(div().w(px(8.)).h(px(8.)).rounded_full().bg(rgb(color)))
        .child(
            div()
                .text_xs()
                .text_color(rgb(MUTED))
                .child(format!("{label} {n}")),
        )
}

fn status_chip(status: Status) -> impl IntoElement {
    let (label, color) = match status {
        Status::New => ("New", NEW),
        Status::Learning => ("Learning", LEARNING),
        Status::Mastered => ("Mastered", MASTERED),
    };
    div()
        .px_2()
        .py_1()
        .rounded_md()
        .bg(rgb(color))
        .text_color(rgb(0xFFFFFF))
        .text_xs()
        .child(label)
}

fn blank_pill(_text: &str, target: bool) -> AnyElement {
    if target {
        div()
            .px_3()
            .py_1()
            .min_w(px(72.))
            .rounded_md()
            .bg(rgb(BLANK))
            .border_b_2()
            .border_color(rgb(ACCENT))
            .text_lg()
            .text_color(rgb(ACCENT))
            .child("    ")
            .into_any_element()
    } else {
        div()
            .px_3()
            .py_1()
            .min_w(px(48.))
            .rounded_md()
            .bg(rgb(0xE7ECEE))
            .text_lg()
            .text_color(rgb(MUTED))
            .child("    ")
            .into_any_element()
    }
}
