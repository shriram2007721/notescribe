# NoteScribe architecture

## Overview

```
Next.js 14 (App Router, static export) ── all pages are client components
 ├─ UI           src/app/*, src/components/*   (Tailwind, shadcn-style primitives, TipTap)
 ├─ Domain       src/lib/*                     (pure logic: notes, folders, cards, srs, quiz, stats, markdown, backup)
 ├─ Persistence  src/lib/db.ts                 (Dexie / IndexedDB, versioned schema)
 ├─ Workers      src/workers/whisper.worker.ts (on-device speech-to-text via transformers.js)
 ├─ AI client    src/lib/ai/*                  (provider interface, HTTP proxy client, schema validation)
 └─ PWA          next-pwa service worker       (precached app shell, cached runtime + speech model)

ai-proxy/  Cloudflare Worker that holds the AI key and builds prompts (deployed separately)
```

The site is a static export (`out/`). It's deployed by GitHub Actions to GitHub Pages (`/notescribe/` base path),
and the Azure Pipelines file produces the same artifact. No feature needs server-side rendering or API routes.
The one feature that needs a secret (AI) is isolated in `ai-proxy/`, so static hosting stays sufficient.

## Data model (IndexedDB `notescribe`)

| Table | Key | Indexes | Notes |
|---|---|---|---|
| notes | id | updatedAt, createdAt, *tags, shareId, syncStatus, folderId, pinned, favorite, deletedAt | TipTap JSON + plain text; `deletedAt` = in Trash |
| folders | id | order, name | "Subjects" |
| cards | id | due, noteId, folderId, createdAt | SM-2 state: interval, ease, reps, lapses, due |
| reviews | id | cardId, reviewedAt | One row per rating; drives stats |
| quizAttempts | id | finishedAt | Per-question results; drives accuracy |
| settings | key |  | aiProxyUrl, aiConsent, authorName, communitySeeded |
| community | id | publishedAt, *tags, noteId | Local mock feed |

### Migrations
- v1: notes, settings. v2: community.
- **v3**: adds `folders`, `cards`, `reviews`, `quizAttempts` and new note indexes. The upgrade sets
  `pinned: 0, favorite: 0` on existing notes; nothing else changes and existing notes stay unfiled.
  Covered by `tests/db.test.ts` (creates a real v2 database, opens it with v3, checks every field survives).

Shared links (`/shared#…`) keep the same v1 payload format, so old links still open.

## Reliability
- **Autosave:** 400 ms debounce, plus an immediate flush on unmount, `pagehide`, `visibilitychange` (hidden) and Ctrl+S.
- **Save journal** (`src/lib/save-journal.ts`): each flush first writes the change synchronously to `localStorage`,
  then to IndexedDB, then clears the journal entry. If the tab closes mid-write, the next load applies the entry
  if it's newer than the stored note. (This fixed a real lost-last-edit race found by the browser tests.)
- A failed save keeps the changes queued, shows "Not saved", and warns before the tab closes.
- `StorageGuard` explains blocked/full storage instead of silently showing an empty app.
- Route-level error boundary (`src/app/error.tsx`).

## Spaced repetition
Simplified SM-2 in `src/lib/srs.ts` (documented in the file). Pure and deterministic, unit-tested in `tests/srs.test.ts`.
Again → 10 min and ease −0.20; Hard → ×1.2 and ease −0.15; Good → ×ease; Easy → ×ease×1.3 and ease +0.15.
Intervals keep the order Again < Hard ≤ Good < Easy, capped at 365 days.

## AI
- `AIProvider` interface; the current implementation is `httpProvider(url)` → `POST {url}/v1/generate`.
- The request contract and prompt builder (`src/lib/ai/prompts.ts`) are shared with the proxy, so tasks are whitelisted.
- Structured tasks (flashcards, MCQ, ask) return JSON validated with zod. Invalid output becomes a clear error, never a fake result.
- "Ask your notes" citations are checked locally: a quote is marked verified only if it appears in that note's text.
- Prompts tell the model to separate "from your notes" from "Beyond your notes" and to say when notes are insufficient.

## Cloud sync and real community (designed, not implemented)

Today, notes live only in one browser. Share links work across devices because the note travels inside the URL.
The community feed is a **local demo**, labelled as such in the UI.

A real backend needs auth, per-user isolation and conflict handling. Recommended smallest option: **Supabase**
(Postgres + Auth + Row Level Security, free tier). A comparable Azure stack is Functions + Cosmos DB + Entra ID B2C.

| Requirement | Design |
|---|---|
| Authentication | Supabase Auth (email magic link / Google) |
| Authorization & isolation | RLS: `owner_id = auth.uid()` on notes, folders, cards, reviews; never trust client IDs |
| Change tracking | Each local record gets `rev` (int) and `dirty` flags; an outbox table queues upserts/deletes while offline |
| Conflict resolution | Server keeps `rev`; an update with a stale `rev` is rejected. The client keeps both versions ("conflicted copy") instead of overwriting |
| Deletion | Tombstones (`deleted_at`) sync like edits; hard delete after 30 days |
| Retry / duplicates | Outbox retried with exponential backoff; client-generated UUIDs make upserts idempotent |
| Status | Per-note sync badge plus a global "Synced / Syncing / Offline / Conflict" indicator |
| Community | `posts` table with explicit publish consent, server-side likes (unique `(post_id, user_id)`), author-only delete, report table + admin moderation, rate limits via Postgres functions |

The current `CommunityBackend` interface (`src/lib/share.ts`) is the seam where a server implementation plugs in.
