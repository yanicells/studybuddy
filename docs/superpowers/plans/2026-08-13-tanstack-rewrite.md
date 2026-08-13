# TanStack Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Rust/GPUI desktop application with a mobile-responsive TanStack Start application while preserving the complete library, import, card-management, SQLite, scheduling, and quiz feature set.

**Architecture:** TanStack Start owns SSR, file-based routing, and typed server functions. Pure domain logic stays in `src/core`; SQLite access and optional OpenAI enrichment stay server-only in `src/server`; route and feature components call narrow server functions and never contain scheduling or persistence logic. The database schema remains compatible with the Rust app, and the server prefers the existing macOS Studybuddy database unless `STUDYBUDDY_DB_PATH` is set.

**Tech Stack:** TypeScript, React 19, TanStack Start and Router, Vite, Nitro, better-sqlite3, Zod, Vitest, Testing Library, Playwright, and plain responsive CSS.

## Global Constraints

- Keep every existing feature; do not add gamification, social features, or cloud sync.
- Keep SQLite as the source of truth.
- Put domain logic in `src/core` and keep route/UI code thin.
- Preserve the current SQLite schema and existing macOS data path compatibility.
- Make the full library and study experience usable from 320px mobile widths through desktop.
- Never commit `.env`, database files, OpenAI keys, or other secrets.

---

## File map

- `src/core/types.ts`: serializable folder, deck, card, review, stats, prompt, and session types.
- `src/core/import.ts`: plain-text card parsing, `==term==` markers, keyword heuristics, marked spans, and editor wrapping.
- `src/core/srs.ts`: between-session learning and mastered-card scheduling.
- `src/core/session.ts`: wave queue and card re-insertion behavior.
- `src/core/quiz.ts`: cloze construction and four-choice distractor selection.
- `src/server/database.server.ts`: SQLite connection, schema setup, legacy-path selection, and sample seeding.
- `src/server/library.server.ts`: transactional folder, deck, card, import, stats, and review repository operations.
- `src/server/openai.server.ts`: optional import keyword enrichment when `OPENAI_API_KEY` exists.
- `src/features/library/library.functions.ts`: validated TanStack server functions for library mutations and reads.
- `src/features/library/LibraryWorkspace.tsx`: selection, filters, responsive shell, and mutation refresh orchestration.
- `src/features/library/LibraryTree.tsx`: recursive folder/deck navigation shared by desktop sidebar and mobile drawer.
- `src/features/library/LibraryContent.tsx`: folder contents, deck statistics, card list, and empty states.
- `src/features/library/LibraryDialogs.tsx`: accessible create, rename, move, delete, import, and card-edit dialogs.
- `src/features/study/StudySession.tsx`: keyboard-accessible quiz, feedback, progress, and completion UI.
- `src/components/*`: small reusable icon, dialog, button, progress, and highlighted-text primitives.
- `src/routes/__root.tsx`: document shell, metadata, CSS import, and error/not-found boundaries.
- `src/routes/index.tsx`: initial library loader and the single application workspace.
- `src/styles.css`: token system, desktop/mobile layouts, focus/reduced-motion states, and the card-stack signature.
- `tests/e2e/studybuddy.spec.ts`: browser parity and responsive flows against an isolated SQLite database.

### Task 1: Scaffold and lock the TanStack application

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`
- Create: `src/router.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/styles.css`
- Delete after the TypeScript behavior tests exist: `Cargo.toml`, `Cargo.lock`, `crates/`

**Interfaces:**
- Produces: `getRouter(): Router` and the generated `src/routeTree.gen.ts`.
- Produces scripts: `dev`, `build`, `start`, `typecheck`, `lint`, `test`, and `test:e2e`.

- [ ] **Step 1: Create package and compiler configuration**

Use React 19, the current TanStack Start/Router releases, Nitro’s Vite plugin, strict TypeScript, and Node-compatible server output. Ignore `data/*.db*`, `.env*`, Playwright artifacts, and generated build output.

- [ ] **Step 2: Add the minimum root and index routes**

The root route must emit a real document:

```tsx
export const Route = createRootRoute({
  head: () => ({ meta: [{ title: 'Studybuddy' }] }),
  shellComponent: RootDocument,
  component: Outlet,
})
```

The index route starts as a loader-backed workspace rather than a marketing page.

- [ ] **Step 3: Generate the route tree and verify the scaffold**

Run: `pnpm install && pnpm typecheck && pnpm build`

Expected: dependency installation, TypeScript, and the Nitro production build all succeed.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vite.config.ts vitest.config.ts playwright.config.ts eslint.config.js src .gitignore
git commit -m "chore: scaffold tanstack start app"
```

### Task 2: Port and prove the pure flashcard domain

**Files:**
- Create: `src/core/types.ts`, `src/core/import.ts`, `src/core/srs.ts`, `src/core/session.ts`, `src/core/quiz.ts`
- Test: `src/core/import.test.ts`, `src/core/srs.test.ts`, `src/core/session.test.ts`, `src/core/quiz.test.ts`

**Interfaces:**
- Produces: `parseCards(text): NewCard[]`, `stripMarks`, `heuristicHighlights`, `markSpans`, and `wrapMarks`.
- Produces: `applyAnswer(card, correct, now): Card` without mutating the input.
- Produces: `StudySession` with `nextCard`, `answer`, `remaining`, `completed`, `wave`, and `cardHits`.
- Produces: `buildQuestion(card, deck, random?): Question`.

- [ ] **Step 1: Write parity tests from the Rust behavior**

Tests must cover blank-line blocks, bullet backs, two-line cards, cloze marks, heuristic highlights, two correct answers to graduate, misses resetting learning state, mastered interval growth, the first eight-card wave, quick miss re-queue, one-hit mastered retirement, cloze selection, and four unique choices.

- [ ] **Step 2: Confirm the new tests fail before implementation**

Run: `pnpm vitest run src/core`

Expected: failures because the TypeScript domain modules do not yet exist.

- [ ] **Step 3: Port the smallest pure implementations**

Keep the Rust constants exactly: first wave `8`, later wave `12`, miss gap `2`, first-hit gap `3`, second-hit gap `8`, ease floor `1.3`, graduation after two correct answers, and first mastered interval of one day.

- [ ] **Step 4: Run domain tests**

Run: `pnpm vitest run src/core`

Expected: all import, scheduling, session, and quiz tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core
git commit -m "feat: port flashcard domain to typescript"
```

### Task 3: Port SQLite persistence and sample data

**Files:**
- Create: `src/server/database.server.ts`, `src/server/library.server.ts`, `src/server/seed.server.ts`, `src/server/openai.server.ts`
- Test: `src/server/library.server.test.ts`

**Interfaces:**
- Produces: `openDatabase(path?): Database.Database` with foreign keys, WAL, and the four compatible tables.
- Produces CRUD for folders, decks, cards, imports, due-card reads, stats, SRS writes, and review logs.
- Produces: `seedSampleIfMissing(db): boolean` and `fillMissingKeywords(cards): Promise<number>`.

- [ ] **Step 1: Write isolated repository tests**

Create a temporary SQLite file per test and cover nested create/move/delete, folder-cycle rejection, card import, status stats, due reads, cascade deletion, review logging, and one-time sample seeding.

- [ ] **Step 2: Confirm repository tests fail**

Run: `pnpm vitest run src/server/library.server.test.ts`

Expected: failures because the server repository has not been implemented.

- [ ] **Step 3: Implement schema-compatible persistence**

Use the existing `folders`, `decks`, `cards`, and `reviews` SQL columns verbatim. Resolve the database path in this order: `STUDYBUDDY_DB_PATH`; existing `~/Library/Application Support/dev.yanicells.Studybuddy/studybuddy.db`; then `data/studybuddy.db`.

- [ ] **Step 4: Port optional keyword enrichment**

If `OPENAI_API_KEY` is absent, return zero without a request. If enrichment fails, imports still succeed and return a non-blocking notice.

- [ ] **Step 5: Run persistence tests**

Run: `pnpm vitest run src/server`

Expected: all repository tests pass without touching the real user database.

- [ ] **Step 6: Commit**

```bash
git add src/server
git commit -m "feat: add sqlite library persistence"
```

### Task 4: Add validated TanStack server functions

**Files:**
- Create: `src/features/library/library.schemas.ts`, `src/features/library/library.functions.ts`
- Modify: `src/routes/index.tsx`
- Test: `src/features/library/library.schemas.test.ts`

**Interfaces:**
- Produces: `getLibrary`, `createFolder`, `renameFolder`, `moveFolder`, `deleteFolder`, `createDeck`, `renameDeck`, `moveDeck`, `deleteDeck`, `saveCard`, `deleteCard`, `importCards`, `startStudy`, and `recordAnswer`.
- Each mutation returns `{ ok: true, notice?: string }` or throws a safe validation error.

- [ ] **Step 1: Write Zod boundary tests**

Cover trimmed non-empty names/fronts, nullable parent IDs, positive integer IDs, import body size, highlight side values, and boolean answers.

- [ ] **Step 2: Implement server functions with direct imports**

Every mutation uses `createServerFn({ method: 'POST' }).validator(schema)` and calls one repository operation. `getLibrary` returns serializable ISO timestamps and stats in one request to avoid waterfalls.

- [ ] **Step 3: Load the library from the route**

```tsx
export const Route = createFileRoute('/')({
  loader: () => getLibrary(),
  component: StudybuddyPage,
})
```

- [ ] **Step 4: Verify the boundary**

Run: `pnpm test && pnpm typecheck && pnpm build`

Expected: all tests, types, server/client splitting, and production build pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/library src/routes/index.tsx
git commit -m "feat: expose typed library operations"
```

### Task 5: Build the responsive library workspace

**Files:**
- Create: `src/features/library/LibraryWorkspace.tsx`, `src/features/library/LibraryTree.tsx`, `src/features/library/LibraryContent.tsx`, `src/features/library/LibraryDialogs.tsx`
- Create: `src/components/AppIcon.tsx`, `src/components/Button.tsx`, `src/components/Dialog.tsx`, `src/components/HighlightedText.tsx`, `src/components/ProgressBars.tsx`
- Modify: `src/styles.css`, `src/routes/index.tsx`
- Test: `src/features/library/LibraryWorkspace.test.tsx`

**Interfaces:**
- Consumes the route loader’s complete `LibrarySnapshot` and the validated server functions.
- Produces every non-study user flow and refreshes loader data with `router.invalidate()` after successful mutations.

- [ ] **Step 1: Write interaction tests**

Cover folder/deck selection, expand/collapse, create/rename/move/delete dialog states, status filtering, card edit/delete, import file text loading, and the mobile library drawer.

- [ ] **Step 2: Implement the desktop workspace**

Use a 280px library rail and flexible content canvas. The visual tokens are index-card white `#FCFCF7`, desk mist `#F2F5F7`, navy ink `#182038`, cobalt `#526AE8`, highlighter `#DDF56C`, coral correction `#F16D5D`, and rule blue `#DCE3F4`. Use a geometric display face, a highly legible sans body, and a monospaced utility face. The signature is a slightly offset stack of ruled index cards in deck and study contexts.

- [ ] **Step 3: Implement mobile behavior**

At widths below 760px, replace the persistent rail with a top bar and focus-trapped library drawer; stack header actions into an overflow sheet; make filters horizontally scrollable; keep all targets at least 44px; and make dialogs full-width bottom sheets without losing keyboard access.

- [ ] **Step 4: Add accessible states**

Use semantic buttons, named dialogs, explicit labels, visible `:focus-visible`, Escape-to-close, background scroll locking, and `prefers-reduced-motion` fallbacks.

- [ ] **Step 5: Verify UI unit tests and static checks**

Run: `pnpm vitest run src/features/library && pnpm typecheck && pnpm lint`

Expected: library interactions, types, and lint all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components src/features/library src/routes/index.tsx src/styles.css
git commit -m "feat: build responsive study library"
```

### Task 6: Build the complete study session

**Files:**
- Create: `src/features/study/StudySession.tsx`, `src/features/study/StudyCard.tsx`, `src/features/study/ChoiceList.tsx`
- Modify: `src/features/library/LibraryWorkspace.tsx`, `src/styles.css`
- Test: `src/features/study/StudySession.test.tsx`

**Interfaces:**
- Consumes due cards and full deck cards from `startStudy`.
- Calls `recordAnswer` once per answer and keeps the wave queue client-side using the pure `StudySession` domain.
- Returns to the selected deck with fresh stats on leave or completion.

- [ ] **Step 1: Write study interaction tests**

Cover due-only startup, 1–4 shortcuts, correct/wrong feedback, answer reveal, Enter/Space continuation, Escape leave, hit pips, progress, reappearing missed cards, and completion.

- [ ] **Step 2: Implement quiz rendering**

Render front- or back-side cloze segments, preserve line breaks and bullets, reveal the selected and correct choices distinctly without relying only on color, and disable repeat answers after feedback.

- [ ] **Step 3: Implement responsive study layout**

Keep the card stage centered at desktop sizes. On mobile, use the full viewport, a sticky compact progress header, single-column 44px choices, and a sticky continue footer that respects safe-area insets.

- [ ] **Step 4: Run study and full tests**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`

Expected: domain, repository, library, and study tests pass and production builds.

- [ ] **Step 5: Commit**

```bash
git add src/features/study src/features/library/LibraryWorkspace.tsx src/styles.css
git commit -m "feat: add responsive quiz sessions"
```

### Task 7: Remove Rust and update project documentation

**Files:**
- Delete: `Cargo.toml`, `Cargo.lock`, `crates/app/`, `crates/core/`
- Preserve: `assets/icon.svg`, `assets/icon.png`, `assets/app-icon.png`
- Modify: `README.md`, `AGENTS.md`, `.gitignore`

**Interfaces:**
- The README documents local setup, existing-data behavior, import format, optional OpenAI key, tests, and production start.

- [ ] **Step 1: Verify all ported behavior before deletion**

Run: `pnpm test && pnpm typecheck && pnpm build`

Expected: all TypeScript parity tests pass before the Rust source is removed.

- [ ] **Step 2: Delete the replaced Rust implementation**

Remove only Cargo files and `crates/`; keep reusable image assets and the repository instructions.

- [ ] **Step 3: Rewrite documentation and architecture instructions**

Replace Cargo commands with pnpm commands and replace the old `crates/core` rule with the equivalent `src/core` domain boundary.

- [ ] **Step 4: Commit**

```bash
git add -A Cargo.toml Cargo.lock crates README.md AGENTS.md .gitignore assets
git commit -m "chore: retire rust desktop app"
```

### Task 8: Browser QA, responsive critique, and final verification

**Files:**
- Create: `tests/e2e/studybuddy.spec.ts`
- Modify as needed: UI files found by browser QA

**Interfaces:**
- E2E starts the app with an isolated temporary `STUDYBUDDY_DB_PATH` and never mutates the user’s existing database.

- [ ] **Step 1: Add an end-to-end parity path**

Exercise folder/deck/card creation, import from textarea and file, edit/move/delete, status filtering, a wrong and correct quiz answer, continuation, leave, and persisted reload state.

- [ ] **Step 2: Run desktop and mobile browser tests**

Run: `pnpm test:e2e`

Expected: Chromium desktop and mobile projects pass with no page errors.

- [ ] **Step 3: Inspect screenshots at desktop and mobile widths**

Use 1440x900 and iPhone 15 Pro viewports. Check information hierarchy, clipping, dialog/drawer reachability, touch targets, sticky regions, card-stack restraint, and empty/error states. Remove any decorative treatment that competes with the study content.

- [ ] **Step 4: Run the final gate**

Run: `pnpm test && pnpm test:e2e && pnpm typecheck && pnpm lint && pnpm build && git status --short`

Expected: every check passes; only intentional source, lockfile, documentation, and generated route-tree changes remain.

- [ ] **Step 5: Commit final QA fixes**

```bash
git add tests src package.json pnpm-lock.yaml
git commit -m "test: verify complete studybuddy workflows"
```

## Self-review

- Spec coverage: every Rust feature identified in the audit maps to Tasks 2–6; mobile responsiveness is explicit in Tasks 5, 6, and 8; SQLite and legacy data compatibility are covered in Task 3.
- Placeholder scan: no implementation step relies on a later TODO or unspecified error handling.
- Type consistency: `LibrarySnapshot`, server-function names, session methods, and serializable timestamps are defined once and consumed consistently.
