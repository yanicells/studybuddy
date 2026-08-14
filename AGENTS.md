# StudyBuddy

Personal, local-first flashcard app. TanStack Start + React + Convex.

## Do

- Keep changes small and local. No extra features.
- Put pure domain logic in `src/core`, persistence and integrations in `convex` and `src/server`, and keep React UI in `src/components` and `src/features` thin.
- Validate every server-function input with the schemas in `src/features/library/library.schemas.ts`.
- Convex is the source of truth.
- Keep desktop and mobile workflows covered when changing interactive UI.
- Match existing style. Don't refactor unrelated code.
- Never commit `.env` or secrets.

## Don't

- Don't add gamification, social, or cloud sync.
- Don't rewrite working scheduling or import code without a failing test.
- Don't move database or OpenAI code into the client bundle.
