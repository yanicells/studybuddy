# StudyBuddy

A personal flashcard app for short study sessions, built with TanStack Start, React, and Convex. It includes nested folders and decks, markdown bold and bullets, status filters, spaced repetition, and multiple-choice cloze sessions.

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

## Data

Copy `.env.example` to `.env` and set `CONVEX_URL` to the production Convex deployment. This app talks to Convex from TanStack server functions; the Convex client is not bundled into the browser.

Put `OPENAI_API_KEY` in `.env` if you want optional keyword enrichment during import. Import and study still work without it, and `.env` is ignored by Git.

Schema and persistence live in `convex/`. Deploy function changes with:

```sh
pnpm exec convex deploy
```

## Vercel

In the Vercel project settings, add:

- `CONVEX_URL` — the Convex production URL, for example `https://striped-bulldog-38.convex.cloud`
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
