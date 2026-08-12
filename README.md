# Studybuddy

A small desktop flashcard app for short study sessions. Nested folders, decks, and Gizmo-style multiple-choice cloze quizzes.

## Run

```sh
cargo run
```

Data lives in your OS app-support directory. Put `OPENAI_API_KEY` in `.env` if you want extra keyword hints on import. It is optional.

## Import format

Blank line separates cards. First lines are the front. Lines starting with `- ` are the back. Wrap quiz words in `==...==`.

```
The ==mitochondria== is the powerhouse of the cell
- mitochondria

Powerhouse of the cell
- mitochondria
```
