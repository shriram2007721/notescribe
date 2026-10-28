"use client";

import { GraduationCap, Search, Sparkles } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { StatTile } from "@/components/dashboard/stat-tile";
import { AIGate } from "@/components/study/ai-gate";
import { AIResultView } from "@/components/study/ai-result";
import { QuizRunner } from "@/components/study/quiz-runner";
import { useAI } from "@/components/study/use-ai";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useAllNotes, useCards, useFolders, useQuizAttempts, useReviews } from "@/hooks/use-data";
import { noteToSourceText } from "@/lib/ai/config";
import { MAX_SOURCE_CHARS, TASK_LABELS, type AITask } from "@/lib/ai/prompts";
import { buildQuizFromCards, type Question } from "@/lib/quiz";
import { computeStats } from "@/lib/stats";
import { cn } from "@/lib/utils";

type Tab = "quiz" | "ai" | "progress";

export default function StudyPage() {
  const [tab, setTab] = useState<Tab>("quiz");
  const tabs: [Tab, string][] = [
    ["quiz", "Practice quiz"],
    ["ai", "AI study tools"],
    ["progress", "Progress"],
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Study</h1>
      <p className="mt-1 text-sm text-muted-foreground">Practise with your flashcards, ask questions about your notes, and track real progress.</p>

      <div role="tablist" aria-label="Study sections" className="mt-6 flex gap-1 border-b">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              tab === id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="pt-6">
        {tab === "quiz" && <LocalQuiz />}
        {tab === "ai" && <AITools />}
        {tab === "progress" && <Progress />}
      </div>
    </div>
  );
}

function LocalQuiz() {
  const cards = useCards();
  const folders = useFolders();
  const [folder, setFolder] = useState("");
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<Question[] | null>(null);

  if (!cards || !folders) return null;
  const pool = cards.filter((c) => !folder || c.folderId === folder);

  if (questions) {
    const name = folder ? folders.find((f) => f.id === folder)?.name : "All subjects";
    return <QuizRunner questions={questions} title={`Flashcard quiz: ${name}`} source="flashcards" onExit={() => setQuestions(null)} />;
  }

  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm text-muted-foreground">
        Builds multiple-choice, true/false and short-answer questions from your flashcards. Works offline; no AI involved.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="quiz-folder">Subject</Label>
          <Select id="quiz-folder" value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">All subjects</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quiz-count">Questions</Label>
          <Select id="quiz-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {pool.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No flashcards {folder ? "in this subject" : "yet"}. Create some on the Flashcards page first.
        </p>
      ) : (
        <>
          <Button onClick={() => setQuestions(buildQuizFromCards(pool, { count }))}>
            <GraduationCap className="h-4 w-4" /> Start quiz ({Math.min(count, pool.length)} questions)
          </Button>
          {pool.length < 4 && <p className="text-xs text-muted-foreground">With fewer than 4 cards, questions are short-answer or true/false.</p>}
        </>
      )}
    </div>
  );
}

const MULTI_TASKS: AITask[] = ["ask", "mcq", "compare", "summarize", "revision", "flashcards", "examQuestions"];

function AITools() {
  const notes = useAllNotes();
  const { state, run, reset } = useAI();
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const deferred = useDeferredValue(filter);
  const [task, setTask] = useState<AITask>("ask");
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState<"beginner" | "advanced">("beginner");
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(() => (notes ?? []).filter((n) => n.deletedAt === undefined).sort((a, b) => b.updatedAt - a.updatedAt), [notes]);
  const titles = useMemo(() => Object.fromEntries(active.map((n) => [n.id, n.title || "Untitled note"])), [active]);
  const shown = active.filter((n) => !deferred || `${n.title} ${n.plainText}`.toLowerCase().includes(deferred.toLowerCase())).slice(0, 50);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 8 ? s : [...s, id]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const sources = active.filter((n) => selected.includes(n.id)).map((n) => ({ id: n.id, title: n.title || "Untitled note", text: noteToSourceText(n) })).filter((s) => s.text);
    if (!sources.length) return setError("Select at least one note with content.");
    if (task === "compare" && sources.length !== 2) return setError("Select exactly two notes to compare.");
    if (task === "ask" && !question.trim()) return setError("Type a question.");
    const size = sources.reduce((n, s) => n + s.text.length, 0);
    if (size > MAX_SOURCE_CHARS) return setError(`Selected notes total ${size.toLocaleString()} characters; the limit is ${MAX_SOURCE_CHARS.toLocaleString()}. Select fewer notes.`);
    run({ task, options: { level, length: "short", mode: "quick" }, sources, question: task === "ask" ? question : undefined });
  };

  return (
    <AIGate>
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">
            Notes to use <span className="font-normal text-muted-foreground">({selected.length}/8)</span>
          </legend>
          <label className="relative block">
            <span className="sr-only">Filter notes</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter notes" className="h-9 pl-9" />
          </label>
          <ul className="max-h-80 space-y-0.5 overflow-y-auto rounded-lg border p-1">
            {shown.length === 0 && <li className="p-3 text-sm text-muted-foreground">No notes.</li>}
            {shown.map((n) => (
              <li key={n.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                  <input type="checkbox" checked={selected.includes(n.id)} onChange={() => toggle(n.id)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                  <span className="truncate">{n.title || "Untitled note"}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="space-y-4">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="multi-task">Action</Label>
                <Select id="multi-task" value={task} onChange={(e) => setTask(e.target.value as AITask)}>
                  {MULTI_TASKS.map((t) => (
                    <option key={t} value={t}>
                      {TASK_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="multi-level">Level</Label>
                <Select id="multi-level" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
                  <option value="beginner">Beginner-friendly</option>
                  <option value="advanced">Advanced</option>
                </Select>
              </div>
            </div>
            {task === "ask" && (
              <div className="space-y-1.5">
                <Label htmlFor="multi-question">Question</Label>
                <Textarea id="multi-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} placeholder="e.g. What are the four conditions for deadlock?" />
                <p className="text-xs text-muted-foreground">Answers cite the notes they used; quotes are checked against your notes.</p>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={state.status === "loading"}>
              <Sparkles className="h-4 w-4" /> {state.status === "loading" ? "Working…" : TASK_LABELS[task]}
            </Button>
          </form>

          <AIResultView
            state={state}
            onRegenerate={() => (state.status === "done" || state.status === "error") && run(state.request)}
            onDiscard={reset}
            context={{ title: selected.length === 1 ? titles[selected[0]] : "Study notes", noteIds: selected }}
            sourceTitles={titles}
          />
        </div>
      </div>
    </AIGate>
  );
}

function Progress() {
  const notes = useAllNotes();
  const cards = useCards();
  const reviews = useReviews();
  const quizzes = useQuizAttempts();
  const stats = useMemo(() => (notes && cards && reviews && quizzes ? computeStats(notes, cards, reviews, quizzes) : null), [notes, cards, reviews, quizzes]);
  if (!stats || !quizzes) return null;

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="Cards due today" value={stats.dueToday} detail={`of ${stats.totalCards} flashcards`} />
        <StatTile label="Reviews this week" value={stats.reviewsThisWeek} detail="Flashcard ratings, last 7 days" />
        <StatTile label="Quizzes taken" value={stats.quizzesTaken} detail="All time" />
        <StatTile
          label="Quiz accuracy"
          value={stats.quizAccuracy === null ? "—" : `${Math.round(stats.quizAccuracy * 100)}%`}
          detail="Correct answers ÷ questions answered"
        />
      </dl>
      <ActivityChart days={stats.activity} />
      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-2 text-sm font-semibold">
          Quiz history
        </h2>
        {quizzes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quizzes yet. Results appear here after you finish one.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {quizzes.slice(0, 20).map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{q.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(q.finishedAt).toLocaleString()} · {q.source === "ai" ? "AI-generated" : "From flashcards"}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums">
                  {q.correct}/{q.total} <span className="text-muted-foreground">({Math.round((q.correct / Math.max(1, q.total)) * 100)}%)</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
