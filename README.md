# Studybuddy

A local-first flashcard app for short study sessions, built with TanStack Start, React, and SQLite. It includes nested folders and decks, highlighted imports, status filters, spaced repetition, and Gizmo-style multiple-choice cloze sessions.

## Development

Install Node.js and pnpm, then run:

```sh
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

For a production build:

```sh
pnpm build
pnpm start
```

## Local data

SQLite remains the source of truth. Studybuddy uses the existing Rust app database when it finds it at:

```text
~/Library/Application Support/dev.yanicells.Studybuddy/studybuddy.db
```

Otherwise, it creates `data/studybuddy.db` in the project. Set `STUDYBUDDY_DB_PATH` to use a different file.

Put `OPENAI_API_KEY` in `.env` if you want optional keyword enrichment during import. Import and study still work without it, and `.env` is ignored by Git.

## Import format

Blank lines separate cards. The first lines are the front; lines starting with `- ` or `* ` are the back. With no bullets, the first line is the front and the rest is the back. Wrap quiz words in `==...==`, or import a `.txt`/`.md` file from the dialog.

```
The ==mitochondria== is the powerhouse of the cell
- mitochondria

Powerhouse of the cell
- mitochondria
```

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```
