use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use chrono::Utc;
use gpui::{
    div, prelude::*, px, relative, rgb, svg, AnyElement, Context, Entity, FocusHandle, FontWeight,
    SharedString, Window,
};
use gpui_component::button::{Button, ButtonVariants};
use gpui_component::input::{Input, InputState};
use gpui_component::Sizable;
use rand::rng;
use studybuddy_core::import::{self, wrap_marks};
use studybuddy_core::quiz::{self, Prompt, Question, Segment};
use studybuddy_core::{
    apply_answer, Card, CardId, Deck, DeckId, DeckStats, Folder, FolderId, Highlight, NewCard,
    Session, Side, Status, Store,
};

const PAPER: u32 = 0xFFFFFF;
const CANVAS: u32 = 0xFFFFFF;
const SIDEBAR: u32 = 0xFAFAFA;
const CARD: u32 = 0xFFFFFF;
const INK: u32 = 0x111111;
const MUTED: u32 = 0x737373;
const LINE: u32 = 0xE5E5E5;
const HOVER: u32 = 0xF5F5F5;

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

#[derive(Clone, Copy, PartialEq, Eq)]
enum StatusFilter {
    All,
    Only(Status),
}

impl StatusFilter {
    fn matches(self, status: Status) -> bool {
        match self {
            Self::All => true,
            Self::Only(want) => status == want,
        }
    }
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
    filter: StatusFilter,
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
        if let Err(err) = studybuddy_core::seed::sample_if_missing(&store) {
            eprintln!("seed sample: {err}");
        }
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
            filter: StatusFilter::All,
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
        app.expand_to_decks();
        app
    }

    fn expand_to_decks(&mut self) {
        let parent_of: HashMap<FolderId, Option<FolderId>> =
            self.folders.iter().map(|f| (f.id, f.parent_id)).collect();
        for folder in &self.folders {
            if folder.parent_id.is_none() {
                self.expanded.insert(folder.id);
            }
        }
        for deck in &self.decks {
            let mut cur = deck.folder_id;
            while let Some(id) = cur {
                self.expanded.insert(id);
                cur = parent_of.get(&id).copied().flatten();
            }
        }
    }

    fn select(&mut self, selected: Selection) {
        if self.selected != selected {
            self.filter = StatusFilter::All;
        }
        self.selected = selected;
        self.reload();
    }

    fn toggle_filter(&mut self, next: StatusFilter, cx: &mut Context<Self>) {
        self.filter = if self.filter == next && next != StatusFilter::All {
            StatusFilter::All
        } else {
            next
        };
        cx.notify();
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
                            .child(brand_mark())
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
                            .small()
                            .label("Folder")
                            .on_click(cx.listener(|this, _, window, cx| {
                                this.open_name("New folder", NameKind::NewFolder, "", window, cx);
                            })),
                    )
                    .child(
                        Button::new("new-deck")
                            .ghost()
                            .small()
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
                .when(!selected, |d| d.hover(|h| h.bg(rgb(HOVER))))
                .when(selected, |d| {
                    d.bg(rgb(INK))
                        .text_color(rgb(PAPER))
                        .hover(|h| h.bg(rgb(INK)).text_color(rgb(PAPER)))
                })
                .on_click(cx.listener(move |this, _, _, cx| {
                    if this.expanded.contains(&id) {
                        this.expanded.remove(&id);
                    } else {
                        this.expanded.insert(id);
                    }
                    this.select(Selection::Folder(id));
                    cx.notify();
                }))
                .child(
                    div()
                        .w(px(14.))
                        .text_color(rgb(if selected { PAPER } else { MUTED }))
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
            .when(!selected, |d| d.hover(|h| h.bg(rgb(HOVER))))
            .when(selected, |d| {
                d.bg(rgb(INK))
                    .text_color(rgb(PAPER))
                    .hover(|h| h.bg(rgb(INK)).text_color(rgb(PAPER)))
            })
            .on_click(cx.listener(move |this, _, _, cx| {
                this.select(Selection::Deck(id));
                cx.notify();
            }))
            .child(div().text_sm().child(deck.name.clone()))
            .when(due > 0, |d| {
                d.child(
                    div()
                        .text_xs()
                        .text_color(rgb(if selected { PAPER } else { MUTED }))
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
                    .border_t_1()
                    .border_color(rgb(LINE))
                    .text_xs()
                    .text_color(rgb(MUTED))
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

        let mut actions = div().flex().flex_row().flex_wrap().items_center().gap_2();
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
                                .small()
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
                        .child(Button::new("move-folder").ghost().small().label("Move").on_click(
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
                                .small()
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
                        .child(Button::new("import").small().label("Import").on_click(cx.listener(
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
                                .small()
                                .label("Card")
                                .on_click(cx.listener(|this, _, window, cx| {
                                    this.open_edit(None, window, cx);
                                })),
                        )
                        .child(
                            Button::new("rename-deck")
                                .ghost()
                                .small()
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
                        .child(Button::new("move-deck").ghost().small().label("Move").on_click(
                            cx.listener(move |this, _, _, cx| {
                                this.overlay = Overlay::Move {
                                    kind: MoveKind::Deck(id),
                                };
                                cx.notify();
                            }),
                        ))
                        .child(Button::new("delete-deck").ghost().small().label("Delete").on_click(
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
            Selection::None => empty_library(),
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
                None,
                cx.listener(move |this, _, _, cx| {
                    this.expanded.insert(fid);
                    this.select(Selection::Folder(fid));
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
                    "{} due · {} cards",
                    stats.due,
                    stats.total()
                ),
                Some(stats),
                cx.listener(move |this, _, _, cx| {
                    this.select(Selection::Deck(did));
                    cx.notify();
                }),
            ));
        }
        col.into_any_element()
    }

    fn render_deck_contents(&mut self, cx: &mut Context<Self>) -> AnyElement {
        let Some(deck_id) = self.selected_deck().map(|d| d.id) else {
            return empty_state("Deck");
        };
        let stats = self.stats.get(&deck_id).cloned().unwrap_or_default();
        let filter = self.filter;
        let mut col = div().flex().flex_col().gap_3();
        col = col.child(
            div()
                .flex()
                .flex_col()
                .gap_3()
                .child(stacked_bar(&stats))
                .child(self.render_filters(&stats, cx)),
        );
        if self.cards.is_empty() {
            col = col.child(empty_state("No cards yet. Import a list or add one."));
            return col.into_any_element();
        }
        let mut shown = 0u32;
        for card in &self.cards {
            if !filter.matches(card.status) {
                continue;
            }
            shown += 1;
            col = col.child(note_card(card, cx));
        }
        if shown == 0 {
            let label = match filter {
                StatusFilter::All => "cards",
                StatusFilter::Only(Status::New) => "new cards",
                StatusFilter::Only(Status::Learning) => "learning cards",
                StatusFilter::Only(Status::Mastered) => "mastered cards",
            };
            col = col.child(empty_state(&format!("No {label} in this deck.")));
        }
        col.into_any_element()
    }

    fn render_filters(&mut self, stats: &DeckStats, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex()
            .flex_row()
            .rounded_md()
            .border_1()
            .border_color(rgb(LINE))
            .overflow_hidden()
            .child(self.filter_seg("All", stats.total(), StatusFilter::All, true, cx))
            .child(self.filter_seg("New", stats.new, StatusFilter::Only(Status::New), true, cx))
            .child(self.filter_seg(
                "Learning",
                stats.learning,
                StatusFilter::Only(Status::Learning),
                true,
                cx,
            ))
            .child(self.filter_seg(
                "Mastered",
                stats.mastered,
                StatusFilter::Only(Status::Mastered),
                false,
                cx,
            ))
    }

    fn filter_seg(
        &mut self,
        label: &'static str,
        n: u32,
        filter: StatusFilter,
        divider: bool,
        cx: &mut Context<Self>,
    ) -> impl IntoElement {
        let active = self.filter == filter;
        div()
            .id(SharedString::from(format!("filter-{label}")))
            .flex()
            .flex_row()
            .items_center()
            .px_3()
            .h(px(28.))
            .cursor_pointer()
            .when(divider, |d| d.border_r_1().border_color(rgb(LINE)))
            .when(active, |d| d.bg(rgb(INK)).text_color(rgb(PAPER)))
            .when(!active, |d| d.hover(|h| h.bg(rgb(HOVER))))
            .on_click(cx.listener(move |this, _, _, cx| this.toggle_filter(filter, cx)))
            .child(
                div()
                    .text_xs()
                    .font_weight(if active {
                        FontWeight::MEDIUM
                    } else {
                        FontWeight::NORMAL
                    })
                    .child(format!("{label} {n}")),
            )
    }

    fn render_study(&mut self, cx: &mut Context<Self>) -> impl IntoElement {
        let Some(study) = self.study.as_ref() else {
            return div();
        };
        let remaining = study.session.remaining();
        let completed = study.session.completed();
        let total = study.session.total.max(1);
        let wave = study.session.wave();
        let fill = completed as f32 / total as f32;
        let hits = study
            .current
            .as_ref()
            .map(|q| study.session.card_hits(q.card_id));

        let header = div()
            .px_6()
            .py_3()
            .flex()
            .flex_row()
            .items_center()
            .gap_4()
            .border_b_1()
            .border_color(rgb(LINE))
            .child(
                Button::new("leave-study")
                    .ghost()
                    .small()
                    .label("Leave")
                    .on_click(cx.listener(|this, _, _, cx| this.exit_study(cx))),
            )
            .child(
                div()
                    .flex_1()
                    .flex()
                    .flex_col()
                    .gap_1()
                    .child(progress_bar(fill))
                    .child(
                        div()
                            .text_xs()
                            .text_color(rgb(MUTED))
                            .child(format!(
                                "{completed} of {total} done · wave {wave} · {remaining} left"
                            )),
                    ),
            );

        if study.done {
            return div()
                .size_full()
                .flex()
                .flex_col()
                .bg(rgb(CANVAS))
                .child(header)
                .child(
                    div()
                        .flex_1()
                        .flex()
                        .flex_col()
                        .items_center()
                        .justify_center()
                        .px_8()
                        .child(
                            div()
                                .w(px(480.))
                                .p_8()
                                .rounded_xl()
                                .bg(rgb(CARD))
                                .border_1()
                                .border_color(rgb(LINE))
                                .flex()
                                .flex_col()
                                .gap_4()
                                .items_center()
                                .child(brand_mark())
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
                                .child(progress_bar(1.0))
                                .child(
                                    Button::new("done-study")
                                        .primary()
                                        .label("Back to deck")
                                        .on_click(
                                            cx.listener(|this, _, _, cx| this.exit_study(cx)),
                                        ),
                                ),
                        ),
                );
        }

        let question = study.current.clone();
        let feedback = study.feedback.as_ref();
        let revealed = feedback.is_some();

        let mut inner = div().w(px(640.)).flex().flex_col().gap_5();
        if let Some(question) = question.as_ref() {
            inner = inner
                .child(self.render_prompt(question, revealed, hits))
                .child(self.render_choices(question, feedback, cx));
        }

        let scroll = div()
            .id("study-scroll")
            .flex_1()
            .overflow_y_scroll()
            .child(
                div()
                    .w_full()
                    .flex()
                    .flex_col()
                    .items_center()
                    .px_8()
                    .py_6()
                    .child(inner),
            );

        let wrong = feedback.map(|fb| !fb.correct).unwrap_or(false);
        let answer_hint = question
            .as_ref()
            .map(|q| q.answer.clone())
            .unwrap_or_default();
        let footer = div()
            .px_6()
            .py_3()
            .border_t_1()
            .border_color(rgb(LINE))
            .flex()
            .flex_row()
            .items_center()
            .justify_between()
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_1()
                    .child(
                        div()
                            .text_sm()
                            .font_weight(FontWeight::MEDIUM)
                            .text_color(rgb(if feedback.is_some() { INK } else { MUTED }))
                            .child(match feedback {
                                Some(fb) if fb.correct => "Correct".to_string(),
                                Some(_) => "Not quite".to_string(),
                                None => "Press 1–4 to answer".to_string(),
                            }),
                    )
                    .when(wrong, |d| {
                        d.child(
                            div()
                                .text_sm()
                                .text_color(rgb(MUTED))
                                .child(format!("Answer: {answer_hint}")),
                        )
                    }),
            )
            .child(div().when(revealed, |d| {
                d.child(
                    Button::new("continue")
                        .primary()
                        .label("Continue")
                        .on_click(cx.listener(|this, _, _, cx| this.continue_study(cx))),
                )
            }));

        div()
            .size_full()
            .flex()
            .flex_col()
            .bg(rgb(CANVAS))
            .child(header)
            .child(scroll)
            .child(footer)
    }

    fn render_prompt(
        &self,
        question: &Question,
        revealed: bool,
        hits: Option<(u32, u32)>,
    ) -> impl IntoElement {
        let cloze = match &question.prompt {
            Prompt::Cloze { segments } => Some(segments.as_slice()),
            Prompt::Front { .. } => None,
        };
        let cloze_on_front = question.cloze_side == Some(Side::Front);
        let cloze_on_back = question.cloze_side == Some(Side::Back);

        let question_body = if cloze_on_front {
            if let Some(segments) = cloze {
                render_cloze(segments, revealed, false)
            } else {
                prompt_text(&question.front)
            }
        } else {
            prompt_text(&question.front)
        };

        let answer_body = if cloze_on_back {
            if let Some(segments) = cloze {
                render_cloze(segments, revealed, true)
            } else {
                marked_passage(&question.back, &[], true)
            }
        } else if revealed && !question.back.trim().is_empty() {
            marked_passage(&question.back, &[], true)
        } else if cloze.is_none() && !revealed {
            div()
                .text_sm()
                .text_color(rgb(MUTED))
                .child("Pick the matching answer.")
                .into_any_element()
        } else {
            div().into_any_element()
        };

        let show_answer = cloze_on_back
            || (revealed && !question.back.trim().is_empty())
            || cloze.is_none();

        div()
            .p_6()
            .rounded_xl()
            .bg(rgb(CARD))
            .border_1()
            .border_color(rgb(LINE))
            .flex()
            .flex_col()
            .gap_4()
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_2()
                    .child(section_label("Question"))
                    .child(question_body),
            )
            .when(show_answer, |d| {
                d.child(
                    div()
                        .flex()
                        .flex_col()
                        .gap_2()
                        .child(section_label("Answer"))
                        .child(answer_body),
                )
            })
            .when_some(hits, |d, (have, need)| {
                d.child(
                    div()
                        .pt_2()
                        .border_t_1()
                        .border_color(rgb(LINE))
                        .flex()
                        .flex_row()
                        .items_center()
                        .gap_2()
                        .child(
                            div()
                                .text_xs()
                                .text_color(rgb(MUTED))
                                .child(format!("This card · {have} of {need}")),
                        )
                        .child(hit_pips(have, need)),
                )
            })
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
            let mut fg = INK;
            let mut badge_bg = PAPER;
            let mut badge_fg = MUTED;
            let mut badge_border = LINE;
            if let Some(fb) = feedback {
                if i == question.answer_index {
                    bg = INK;
                    border = INK;
                    fg = PAPER;
                    badge_bg = PAPER;
                    badge_fg = INK;
                    badge_border = PAPER;
                } else if i == fb.picked {
                    bg = PAPER;
                    border = INK;
                    fg = INK;
                    badge_bg = PAPER;
                    badge_fg = INK;
                    badge_border = INK;
                }
            }
            col = col.child(
                div()
                    .id(SharedString::from(format!("choice-{i}")))
                    .flex()
                    .flex_row()
                    .items_start()
                    .gap_3()
                    .px_4()
                    .py_3()
                    .rounded_lg()
                    .border_1()
                    .border_color(rgb(border))
                    .bg(rgb(bg))
                    .text_color(rgb(fg))
                    .cursor_pointer()
                    .when(feedback.is_none(), |d| d.hover(|h| h.bg(rgb(HOVER))))
                    .on_click(cx.listener(move |this, _, _, cx| this.pick(i, cx)))
                    .child(
                        div()
                            .w(px(22.))
                            .h(px(22.))
                            .rounded_full()
                            .border_1()
                            .border_color(rgb(badge_border))
                            .bg(rgb(badge_bg))
                            .flex()
                            .items_center()
                            .justify_center()
                            .flex_shrink_0()
                            .text_xs()
                            .text_color(rgb(badge_fg))
                            .child((i + 1).to_string()),
                    )
                    .child(choice_lines(choice)),
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
        .hover(|d| d.bg(rgb(HOVER)))
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

fn empty_library() -> AnyElement {
    div()
        .pt_16()
        .flex()
        .flex_col()
        .items_center()
        .gap_3()
        .child(brand_mark())
        .child(
            div()
                .text_sm()
                .font_weight(FontWeight::SEMIBOLD)
                .child("Studybuddy"),
        )
        .child(
            div()
                .text_sm()
                .text_color(rgb(MUTED))
                .child("Pick a folder or deck, or create one."),
        )
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
    stats: Option<DeckStats>,
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
        .hover(|d| d.bg(rgb(HOVER)))
        .on_click(on_click)
        .flex()
        .flex_col()
        .gap_2()
        .child(
            div()
                .text_sm()
                .font_weight(FontWeight::MEDIUM)
                .child(title.into()),
        )
        .when_some(stats, |d, stats| d.child(stacked_bar(&stats)))
        .child(
            div()
                .text_xs()
                .text_color(rgb(MUTED))
                .child(subtitle.into()),
        )
}

fn text_action(
    id: impl Into<SharedString>,
    label: &'static str,
    on_click: impl Fn(&gpui::ClickEvent, &mut Window, &mut gpui::App) + 'static,
) -> impl IntoElement {
    div()
        .id(id.into())
        .px_2()
        .py_1()
        .rounded_md()
        .text_xs()
        .text_color(rgb(MUTED))
        .cursor_pointer()
        .hover(|d| d.bg(rgb(PAPER)).text_color(rgb(INK)))
        .on_click(on_click)
        .child(label)
}

fn note_card(card: &Card, cx: &mut Context<Studybuddy>) -> impl IntoElement {
    let id = card.id;
    let front = phrases(card, Side::Front);
    let back = phrases(card, Side::Back);
    div()
        .id(SharedString::from(format!("card-{}", id.0)))
        .flex()
        .flex_col()
        .gap_3()
        .p_4()
        .rounded_lg()
        .border_1()
        .border_color(rgb(LINE))
        .bg(rgb(CARD))
        .hover(|d| d.border_color(rgb(INK)))
        .child(
            div()
                .text_sm()
                .font_weight(FontWeight::MEDIUM)
                .child(marked_passage(&card.front, &front, false)),
        )
        .when(!card.back.trim().is_empty(), |d| {
            d.child(
                div()
                    .pt_2()
                    .border_t_1()
                    .border_color(rgb(LINE))
                    .child(marked_passage(&card.back, &back, true)),
            )
        })
        .child(
            div()
                .flex()
                .flex_row()
                .items_center()
                .justify_between()
                .child(status_chip(card.status))
                .child(
                    div()
                        .flex()
                        .flex_row()
                        .gap_1()
                        .child(text_action(
                            format!("edit-{}", id.0),
                            "Edit",
                            cx.listener(move |this, _, window, cx| {
                                this.open_edit(Some(id), window, cx);
                            }),
                        ))
                        .child(text_action(
                            format!("del-{}", id.0),
                            "Delete",
                            cx.listener(move |this, _, _, cx| {
                                this.overlay = Overlay::Confirm {
                                    title: "Delete card?".into(),
                                    body: "This cannot be undone.".into(),
                                    kind: ConfirmKind::DeleteCard(id),
                                };
                                cx.notify();
                            }),
                        )),
                ),
        )
}

fn status_chip(status: Status) -> impl IntoElement {
    let (label, bg, border, fg) = match status {
        Status::New => ("New", PAPER, LINE, MUTED),
        Status::Learning => ("Learning", PAPER, INK, INK),
        Status::Mastered => ("Mastered", INK, INK, PAPER),
    };
    div()
        .px_2()
        .py_1()
        .rounded_md()
        .bg(rgb(bg))
        .border_1()
        .border_color(rgb(border))
        .text_color(rgb(fg))
        .text_xs()
        .child(label)
}

fn brand_mark() -> impl IntoElement {
    div()
        .w(px(24.))
        .h(px(24.))
        .flex_shrink_0()
        .child(
            svg()
                .path("icon.svg")
                .size_full()
                .text_color(rgb(INK)),
        )
}

fn section_label(text: &str) -> impl IntoElement {
    div()
        .text_xs()
        .font_weight(FontWeight::MEDIUM)
        .text_color(rgb(MUTED))
        .child(text.to_string())
}

fn progress_bar(fill: f32) -> impl IntoElement {
    div()
        .h(px(4.))
        .w_full()
        .rounded_full()
        .bg(rgb(LINE))
        .overflow_hidden()
        .child(
            div()
                .h_full()
                .w(relative(fill.clamp(0., 1.)))
                .rounded_full()
                .bg(rgb(INK)),
        )
}

fn stacked_bar(stats: &DeckStats) -> impl IntoElement {
    let total = stats.total();
    if total == 0 {
        return div()
            .h(px(6.))
            .w_full()
            .rounded_full()
            .bg(rgb(LINE))
            .into_any_element();
    }
    let total = total as f32;
    div()
        .h(px(6.))
        .w_full()
        .rounded_full()
        .bg(rgb(HOVER))
        .overflow_hidden()
        .flex()
        .flex_row()
        .child(
            div()
                .h_full()
                .w(relative(stats.new as f32 / total))
                .bg(rgb(LINE)),
        )
        .child(
            div()
                .h_full()
                .w(relative(stats.learning as f32 / total))
                .bg(rgb(MUTED)),
        )
        .child(
            div()
                .h_full()
                .w(relative(stats.mastered as f32 / total))
                .bg(rgb(INK)),
        )
        .into_any_element()
}

fn hit_pips(have: u32, need: u32) -> impl IntoElement {
    let mut row = div().flex().flex_row().gap_1();
    for i in 0..need {
        row = row.child(
            div()
                .w(px(16.))
                .h(px(4.))
                .rounded_full()
                .bg(rgb(if i < have { INK } else { LINE })),
        );
    }
    row
}

fn phrases(card: &Card, side: Side) -> Vec<String> {
    card.highlights
        .iter()
        .filter(|h| h.side == side)
        .map(|h| h.text.clone())
        .collect()
}

fn prompt_text(text: &str) -> AnyElement {
    div()
        .text_lg()
        .font_weight(FontWeight::MEDIUM)
        .child(text.to_string())
        .into_any_element()
}

fn marked_passage(text: &str, phrases: &[String], bullets: bool) -> AnyElement {
    let mut col = div().flex().flex_col().gap_1();
    for line in text.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let spans = import::mark_spans(line, phrases);
        let mut row = div().flex().flex_row().items_start().gap_2();
        if bullets {
            row = row.child(div().text_sm().text_color(rgb(MUTED)).child("•"));
        }
        let mut body = div().flex_1().flex().flex_row().flex_wrap();
        for (chunk, hi) in spans {
            body = body.child(
                div()
                    .text_sm()
                    .when(hi, |d| d.font_weight(FontWeight::SEMIBOLD).italic())
                    .child(chunk),
            );
        }
        col = col.child(row.child(body));
    }
    col.into_any_element()
}

fn render_cloze(segments: &[Segment], revealed: bool, bullets: bool) -> AnyElement {
    let mut col = div().flex().flex_col().gap_2();
    for line in cloze_lines(segments) {
        let mut row = div().flex().flex_row().flex_wrap().items_end().gap_1();
        if bullets {
            row = row.child(div().text_sm().text_color(rgb(MUTED)).child("•"));
        }
        for seg in line {
            match seg {
                Segment::Text(t) => {
                    for word in t.split_inclusive(' ') {
                        if word.is_empty() {
                            continue;
                        }
                        row = row.child(div().text_sm().child(word.to_string()));
                    }
                }
                Segment::Blank { text, target } => {
                    row = row.child(blank_slot(&text, target, revealed));
                }
            }
        }
        col = col.child(row);
    }
    col.into_any_element()
}

fn cloze_lines(segments: &[Segment]) -> Vec<Vec<Segment>> {
    let mut lines: Vec<Vec<Segment>> = vec![Vec::new()];
    for seg in segments {
        match seg {
            Segment::Text(t) => {
                let parts: Vec<&str> = t.split('\n').collect();
                for (i, part) in parts.iter().enumerate() {
                    if !part.is_empty() {
                        lines
                            .last_mut()
                            .unwrap()
                            .push(Segment::Text(part.to_string()));
                    }
                    if i + 1 < parts.len() {
                        lines.push(Vec::new());
                    }
                }
            }
            other => lines.last_mut().unwrap().push(other.clone()),
        }
    }
    lines.retain(|line| !line.is_empty());
    lines
}

fn blank_slot(text: &str, target: bool, revealed: bool) -> AnyElement {
    if revealed {
        return div()
            .text_sm()
            .font_weight(if target {
                FontWeight::SEMIBOLD
            } else {
                FontWeight::NORMAL
            })
            .italic()
            .when(target, |d| d.underline())
            .child(text.to_string())
            .into_any_element();
    }
    let width = (text.chars().count().max(6) as f32 * 7.5).clamp(48.0, 220.0);
    div()
        .h(px(16.))
        .w(px(width))
        .mb(px(2.))
        .border_b_2()
        .border_color(rgb(if target { INK } else { MUTED }))
        .into_any_element()
}

fn choice_lines(text: &str) -> impl IntoElement {
    let mut col = div().flex().flex_col().gap_1().flex_1();
    for line in text.lines() {
        col = col.child(div().text_sm().child(line.to_string()));
    }
    col
}
