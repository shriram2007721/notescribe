"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { db, type QuizAnswerRecord, type QuizAttempt } from "@/lib/db";
import { normalizeAnswer, type Question } from "@/lib/quiz";
import { cn } from "@/lib/utils";

interface Answer {
  given: string;
  correct: boolean;
}

const expectedText = (q: Question) =>
  q.kind === "mcq" ? q.options[q.answerIndex] : q.kind === "truefalse" ? (q.answer ? "True" : "False") : q.expected;

/** Runs a quiz one question at a time and saves the attempt (real results only) when finished. */
export function QuizRunner({
  questions,
  title,
  source,
  noteIds = [],
  onExit,
}: {
  questions: Question[];
  title: string;
  source: QuizAttempt["source"];
  noteIds?: string[];
  onExit?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(Answer | null)[]>(() => questions.map(() => null));
  const [shortDraft, setShortDraft] = useState("");
  const [shortRevealed, setShortRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const startedAt = useRef(Date.now());
  const saved = useRef(false);

  const q = questions[index];
  const answer = answers[index];

  const record = (a: Answer) => setAnswers((prev) => prev.map((x, i) => (i === index ? a : x)));

  const next = () => {
    setShortDraft("");
    setShortRevealed(false);
    if (index + 1 < questions.length) setIndex(index + 1);
    else setFinished(true);
  };

  // Save the attempt exactly once when the quiz finishes.
  useEffect(() => {
    if (!finished || saved.current) return;
    saved.current = true;
    const records: QuizAnswerRecord[] = questions.map((qq, i) => ({
      questionId: qq.id,
      prompt: qq.prompt,
      correct: Boolean(answers[i]?.correct),
      given: answers[i]?.given ?? "",
      expected: expectedText(qq),
    }));
    db.quizAttempts
      .add({
        id: nanoid(),
        title,
        source,
        noteIds,
        total: questions.length,
        correct: records.filter((r) => r.correct).length,
        answers: records,
        startedAt: startedAt.current,
        finishedAt: Date.now(),
      })
      .catch(() => {
        /* results are still shown even if storage fails */
      });
  }, [finished, answers, questions, title, source, noteIds]);

  // Keyboard: 1-6 choose an option, T/F for true/false, Enter = next.
  useEffect(() => {
    if (finished) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("textarea, input")) return;
      if (answer && e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (!answer && q.kind === "mcq" && /^[1-6]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < q.options.length) record({ given: q.options[i], correct: i === q.answerIndex });
      } else if (!answer && q.kind === "truefalse" && /^[tf]$/i.test(e.key)) {
        const v = e.key.toLowerCase() === "t";
        record({ given: v ? "True" : "False", correct: v === q.answer });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (finished) {
    const correct = answers.filter((a) => a?.correct).length;
    const wrong = questions.map((qq, i) => ({ q: qq, a: answers[i] })).filter((x) => !x.a?.correct);
    return (
      <div className="space-y-5">
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Quiz complete</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {correct} / {questions.length}
          </p>
          <p className="text-sm text-muted-foreground">{Math.round((correct / questions.length) * 100)}% correct · saved to your quiz history</p>
        </div>
        {wrong.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Review what you missed</h3>
            <ul className="space-y-2">
              {wrong.map(({ q: qq, a }) => (
                <li key={qq.id} className="rounded-lg border p-3 text-sm">
                  <p className="whitespace-pre-line font-medium">{qq.prompt}</p>
                  <p className="mt-1 text-destructive">Your answer: {a?.given || "(skipped)"}</p>
                  <p className="text-green-700 dark:text-green-400">Correct: {expectedText(qq)}</p>
                  {qq.explanation && <p className="mt-1 text-muted-foreground">{qq.explanation}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setAnswers(questions.map(() => null));
              setIndex(0);
              setFinished(false);
              saved.current = false;
              startedAt.current = Date.now();
            }}
          >
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
          {onExit && (
            <Button variant="outline" onClick={onExit}>
              Done
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Question {index + 1} of {questions.length}
        </span>
        <span>{answers.filter((a) => a?.correct).length} correct so far</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={index}>
        <div className="h-full bg-primary transition-all" style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>

      <p className="whitespace-pre-line text-lg font-medium leading-snug">{q.prompt}</p>

      {q.kind === "mcq" && (
        <div className="grid gap-2">
          {q.options.map((opt, i) => {
            const picked = answer?.given === opt;
            const isRight = i === q.answerIndex;
            return (
              <button
                key={i}
                type="button"
                disabled={!!answer}
                onClick={() => record({ given: opt, correct: isRight })}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors enabled:hover:bg-accent",
                  answer && isRight && "border-green-600 bg-green-50 dark:bg-green-950/40",
                  answer && picked && !isRight && "border-destructive bg-destructive/10",
                )}
              >
                <kbd className="rounded border bg-muted px-1.5 text-xs">{i + 1}</kbd>
                <span className="flex-1">{opt}</span>
                {answer && isRight && <Check className="h-4 w-4 text-green-600" />}
                {answer && picked && !isRight && <X className="h-4 w-4 text-destructive" />}
              </button>
            );
          })}
        </div>
      )}

      {q.kind === "truefalse" && (
        <div className="flex gap-2">
          {[true, false].map((v) => (
            <Button
              key={String(v)}
              variant="outline"
              disabled={!!answer}
              onClick={() => record({ given: v ? "True" : "False", correct: v === q.answer })}
              className={cn(
                "flex-1",
                answer && v === q.answer && "border-green-600 bg-green-50 dark:bg-green-950/40",
                answer && answer.given === (v ? "True" : "False") && v !== q.answer && "border-destructive bg-destructive/10",
              )}
            >
              {v ? "True (T)" : "False (F)"}
            </Button>
          ))}
        </div>
      )}

      {q.kind === "short" && (
        <div className="space-y-2">
          <Textarea
            value={shortDraft}
            onChange={(e) => setShortDraft(e.target.value)}
            disabled={shortRevealed}
            placeholder="Type your answer…"
            aria-label="Your answer"
            className="min-h-20"
          />
          {!shortRevealed ? (
            <Button
              onClick={() => {
                setShortRevealed(true);
                if (normalizeAnswer(shortDraft) && normalizeAnswer(shortDraft) === normalizeAnswer(q.expected)) record({ given: shortDraft, correct: true });
              }}
            >
              Check answer
            </Button>
          ) : (
            <div className="rounded-lg border bg-muted/50 p-3 text-sm">
              <p>
                <span className="font-medium">Expected:</span> {q.expected}
              </p>
              {!answer && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">Did you get it right?</span>
                  <Button size="sm" variant="outline" onClick={() => record({ given: shortDraft, correct: true })}>
                    <Check className="h-4 w-4" /> Yes
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => record({ given: shortDraft, correct: false })}>
                    <X className="h-4 w-4" /> No
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {answer && (
        <div className="space-y-3" aria-live="polite">
          <p className={cn("text-sm font-medium", answer.correct ? "text-green-700 dark:text-green-400" : "text-destructive")}>
            {answer.correct ? "Correct" : `Not quite. Answer: ${expectedText(q)}`}
          </p>
          {q.explanation && <p className="text-sm text-muted-foreground">{q.explanation}</p>}
          <Button onClick={next} autoFocus>
            {index + 1 < questions.length ? "Next question" : "See results"}
          </Button>
        </div>
      )}
    </div>
  );
}
