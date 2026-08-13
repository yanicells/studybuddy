# StudyBuddy

A local-first flashcard app for short study sessions, built with TanStack Start, React, Drizzle, and SQLite/Turso. It includes nested folders and decks, markdown bold and bullets, status filters, spaced repetition, and multiple-choice cloze sessions.

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

Copy `.env.example` to `.env`. With `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set, the app uses Turso. Otherwise SQLite remains the source of truth:

```text
~/Library/Application Support/dev.yanicells.Studybuddy/studybuddy.db
```

or `data/studybuddy.db` in the project. Set `STUDYBUDDY_DB_PATH` to use a different file.

Put `OPENAI_API_KEY` in `.env` if you want optional keyword enrichment during import. Import and study still work without it, and `.env` is ignored by Git.

Schema changes live in `src/server/schema.ts`. The runtime applies `src/server/migrations.ts` on boot. Generate extra SQL with `pnpm db:generate`.

## Vercel

In the Vercel project settings, add:

- `TURSO_DATABASE_URL` — `libsql://studybuddy-yanicells.aws-ap-northeast-1.turso.io`
- `TURSO_AUTH_TOKEN` — a token from the Turso dashboard
- `OPENAI_API_KEY` — optional

Then import the Git repo and deploy. Build command is `pnpm build`.

## Import format

Blank lines separate cards. The first lines are the front; lines starting with `- ` or `* ` are the back. With no bullets, the first line is the front and the rest is the back. Bold quiz words with `**...**`. Answer lines render as bullets.

```
The **mitochondria** is the powerhouse of the cell
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
