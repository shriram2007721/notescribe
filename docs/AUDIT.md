# NoteScribe audit (before the study-workspace upgrade)

Baseline at commit `9196517`: `npm run lint`, `npx tsc --noEmit` and `npm run build` (static export) all pass.
The app is deployed by GitHub Actions to GitHub Pages under `/notescribe/`. An Azure Pipelines file is also present.

## 1. Works today
- Notes: create, edit, title, delete, search title/content, filter by highlight tag (Dexie, IndexedDB `notescribe` v2).
- TipTap editor: bold, italic, H2, lists, undo/redo, autosave (400 ms debounce, flush on unmount/pagehide).
- Smart highlights (exam / interview / concept) as one mark with a `tag` attribute; Ctrl+Alt+1/2/3; bubble menu.
- Highlight extractor with tag filter, jump-to, copy list.
- Offline: service worker (next-pwa) precaches app routes; notes live in IndexedDB.
- Local Whisper (`Xenova/whisper-tiny.en`) in a Web Worker, loaded only on first mic use, model cached by the browser.
- Share links: whole note lz-compressed into the URL fragment (`/shared#…`), read-only view, "save a copy".
- Community: **local mock only** (posts stored in this browser's IndexedDB, 4 seeded samples).

## 2. Exists but needs improvement
- Delete is a `window.confirm` with no undo; deleted notes are unrecoverable.
- Dictation inserts text immediately: no preview/edit, no duration, no pause, generic errors.
- Search scans all notes on each keystroke (fine for hundreds of notes; no debounce).
- The dashboard is a flat grid: no pinned/recent/sorting, no folders.
- Community does not label seeded posts as samples. Its limits are only mentioned inside the share dialog.

## 3. Missing
Folders/subjects, pin/favorite, sort options, trash/undo, dark mode toggle, export/import/backup,
flashcards + spaced repetition, quizzes, study stats, AI assistant, command palette, settings page,
error boundary, storage-failure handling, unit tests.

## 4. Technical limitations / potential bugs
- **Static export only.** There are no API routes, so any AI provider key needs a separate server-side proxy.
- `NoteWorkspace` saves on `pagehide` but not on `visibilitychange` (mobile tab switches can skip the final save).
- If IndexedDB can't open (private mode, quota, blocked), the UI silently shows nothing.
- Share links grow with note size; very large notes can exceed practical URL lengths.
- No tests at all; CI runs `npm test --if-present`, which currently does nothing.

## 5. UI/UX problems
- No app navigation beyond two header links; no settings; no theme toggle (dark tokens exist but are unused).
- The editor toolbar wraps onto several lines on phones.
- The highlights panel is the only side panel; no focus/distraction-free mode.

## 6. Required changes
- Dexie **v3** migration: note fields `folderId`, `pinned`, `favorite`, `deletedAt`; new tables
  `folders`, `cards`, `reviews`, `quizAttempts`. Existing notes get `pinned: 0, favorite: 0` and remain unfiled.
- New deps: `zod` (validate imports + AI output), `marked` + `@tiptap/html` (Markdown import/export),
  `vitest` + `fake-indexeddb` (tests).
- AI: a small serverless proxy (`ai-proxy/`, Cloudflare Worker, free tier) holds the Gemini key; the static
  app only stores the proxy **URL** (not a secret).

## 7. Plan (priority order)
1. Stabilize: save on `visibilitychange`, storage error banner, error boundary, tests.
2. App shell, dark mode, dashboard, folders, pin/favorite, sort, trash with undo, command palette.
3. Markdown/JSON export + import with preview, backup, print-to-PDF.
4. Flashcards + SM-2 scheduling, review sessions, quizzes, study stats.
5. Better recording: timer, pause/resume, preview/edit before insert, clear errors.
6. AI assistant (via proxy) with grounded Q&A and validated structured output.
7. Cloud sync + real community: **design only** (needs a backend with auth). See `docs/ARCHITECTURE.md`.
