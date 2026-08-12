# Studybuddy

Personal flashcard app. Rust + GPUI.

## Do

- Keep changes small and local. No extra features.
- Put domain logic in `crates/core`. UI in `crates/app` stays thin.
- SQLite is the source of truth.
- Match existing style. Don't refactor unrelated code.
- Never commit `.env` or secrets.

## Don't

- Don't add gamification, social, or cloud sync.
- Don't rewrite working scheduling or import code without a failing test.
