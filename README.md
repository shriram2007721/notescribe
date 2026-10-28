# NoteScribe

An offline-first study workspace for students: take or dictate lecture notes, highlight what matters,
then turn it into flashcards and quizzes and review it with spaced repetition. Everything runs in the
browser and is stored on your device. AI features are optional and go through your own proxy.

**Live demo:** https://shriram2007721.github.io/notescribe/

## Features

| Area | What you get |
|---|---|
| Notes | Rich-text editor (TipTap), autosave with crash-safe journal, focus mode, subjects (folders), pin, favorite, sort, search, Trash with undo |
| Smart highlights | 📚 Exam, 💼 Interview, 💡 Key concept (Ctrl+Alt+1/2/3), highlight extractor with filters |
| Voice | On-device Whisper transcription (audio never leaves the device), pause/resume, timer, edit-before-insert |
| Flashcards | Manual, from highlights, or AI-generated; SM-2 spaced repetition; keyboard review (Space, 1–4) |
| Quizzes | Offline quizzes built from your flashcards; AI quizzes with validated questions; history and accuracy |
| AI assistant (optional) | Summaries, explanations, exam questions, Q&A, MCQs, flashcards, comparisons, revision notes, gap finding, grounded "ask your notes" with verified citations |
| Data | Markdown export/import, full JSON backup/restore with preview, print to PDF |
| App | Installable PWA, works offline, light/dark theme, command palette (Ctrl+K), responsive layout |

## Run locally

Requires Node.js 20+.

```bash
npm ci
npm run dev          # http://localhost:3000 (service worker disabled in dev)
```

Production build (static site in `out/`, service worker enabled):

```bash
npm run build
npx serve out        # http://localhost:3000
```

## Checks

```bash
npm run lint         # ESLint (next lint)
npm run typecheck    # TypeScript
npm test             # Vitest unit tests
npm run build        # static export
```

## AI (optional)

AI features need a small proxy that keeps the API key off the browser. See **[AI_SETUP.md](AI_SETUP.md)**.
Without it, the AI panels show a setup message; everything else works.

## Documentation

- [docs/AUDIT.md](docs/AUDIT.md): audit of the codebase before this upgrade
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): architecture, data model, migrations, cloud-sync design
- [AI_SETUP.md](AI_SETUP.md): deploying the AI proxy (free Cloudflare Worker + Gemini key)
- [GITHUB_SETUP.md](GITHUB_SETUP.md): GitHub Actions CI/CD to GitHub Pages
- [DEPLOY.md](DEPLOY.md) and [GOVERNANCE.md](GOVERNANCE.md): Azure DevOps pipeline and governance
