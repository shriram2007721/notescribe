import { z } from "zod";

/*
 * AI request contract + prompt builder.
 * Shared by the browser (to build requests) and the server-side proxy in ai-proxy/ (which builds the prompt),
 * so the proxy never forwards arbitrary prompts and can't be used as a general-purpose LLM relay.
 */

export const AI_TASKS = [
  "summarize",
  "explain",
  "stepByStep",
  "examQuestions",
  "qa",
  "mcq",
  "flashcards",
  "compare",
  "revision",
  "gaps",
  "ask",
] as const;

export type AITask = (typeof AI_TASKS)[number];

export const TASK_LABELS: Record<AITask, string> = {
  summarize: "Summarize",
  explain: "Explain simply",
  stepByStep: "Explain step by step",
  examQuestions: "Likely exam questions",
  qa: "Questions with answers",
  mcq: "Multiple-choice quiz",
  flashcards: "Create flashcards",
  compare: "Compare two notes",
  revision: "Revision notes",
  gaps: "Find gaps & unclear parts",
  ask: "Ask your notes",
};

/** Tasks whose response must be JSON matching a schema (validated by the client). */
export const JSON_TASKS = new Set<AITask>(["mcq", "flashcards", "ask"]);

export const MAX_SOURCES = 8;
export const MAX_SOURCE_CHARS = 24_000;
export const MAX_QUESTION_CHARS = 1_000;

export const aiRequestSchema = z.object({
  task: z.enum(AI_TASKS),
  options: z.object({
    length: z.enum(["short", "detailed"]).default("short"),
    level: z.enum(["beginner", "advanced"]).default("beginner"),
    mode: z.enum(["quick", "comprehensive"]).default("quick"),
  }),
  sources: z
    .array(z.object({ id: z.string().min(1).max(100), title: z.string().max(300), text: z.string().min(1) }))
    .min(1)
    .max(MAX_SOURCES)
    .refine((s) => s.reduce((n, x) => n + x.text.length, 0) <= MAX_SOURCE_CHARS, {
      message: `Notes are too long for one request (max ${MAX_SOURCE_CHARS.toLocaleString()} characters). Select a section instead.`,
    }),
  question: z.string().max(MAX_QUESTION_CHARS).optional(),
  /** "selection" when the source is a highlighted part of a note rather than the whole note. */
  scope: z.enum(["note", "selection"]).default("note"),
});

export type AIRequest = z.input<typeof aiRequestSchema>;
export type AIRequestParsed = z.output<typeof aiRequestSchema>;

export interface BuiltPrompt {
  system: string;
  user: string;
  json: boolean;
}

const GROUNDING = `Ground everything in the student's notes provided below.
- Put information taken from the notes first.
- If you add anything that is NOT in the notes, put it under a heading "Beyond your notes" so the student can tell the difference.
- If the notes don't contain enough information for the request, say so plainly instead of guessing.
- Never invent sources, citations, page numbers or quotes.`;

function styleLine(o: AIRequestParsed["options"]) {
  return [
    o.length === "short" ? "Keep it concise." : "Be thorough and detailed.",
    o.level === "beginner" ? "Use simple language and define jargon, for a beginner." : "Assume an advanced student; use precise technical language.",
    o.mode === "quick" ? "Optimise for quick revision." : "Optimise for comprehensive study.",
  ].join(" ");
}

const TASK_INSTRUCTIONS: Record<AITask, string> = {
  summarize: "Summarize the notes in Markdown: a one-paragraph overview, then the key points as bullets.",
  explain: "Explain the main concept(s) in the notes in simple language, with an everyday analogy where it helps. Use Markdown.",
  stepByStep: "Explain the topic step by step as a numbered list, building from fundamentals to the full idea. Use Markdown.",
  examQuestions: "Write the most likely exam questions on this material as a numbered Markdown list. Mix recall, understanding and application questions. Do not include answers.",
  qa: "Write exam-style questions, each followed by a model answer. Format: '**Q1.** question' then '**A.** answer'. Use Markdown.",
  revision: "Turn the notes into compact revision notes in Markdown: headings per topic, bullet points, key terms in bold, and a short 'Remember' list at the end.",
  gaps: "Review the notes like a tutor. In Markdown, list (1) explanations that are missing or incomplete, (2) statements that are unclear or possibly incorrect, and (3) what to add to make the notes exam-ready. Quote the relevant part of the notes for each point.",
  compare:
    "Compare the topics in the two notes in Markdown: a short overview, a comparison table (aspect | first | second), key similarities, key differences, and when to use or apply each.",
  mcq: `Create multiple-choice and true/false questions that test understanding of the notes.
Return ONLY JSON: {"questions":[{"kind":"mcq","prompt":string,"options":[string,string,string,string],"answerIndex":number,"explanation":string} | {"kind":"truefalse","prompt":string,"answer":boolean,"explanation":string}]}.
answerIndex is 0-based. Each explanation says why the answer is right, using the notes.`,
  flashcards: `Create flashcards for active recall from the notes. One fact or idea per card; questions must make sense on their own.
Return ONLY JSON: {"cards":[{"front":string,"back":string}]}.`,
  ask: `Answer the student's question using only the notes provided.
Return ONLY JSON: {"answer":string,"citations":[{"noteId":string,"quote":string}],"additional":string,"insufficient":boolean}.
- "answer": Markdown answer based on the notes.
- "citations": for each claim from the notes, the source noteId and a short EXACT quote copied from that note's text.
- "additional": optional extra explanation that is NOT from the notes (empty string if none).
- "insufficient": true if the notes don't contain enough to answer; then say what's missing in "answer".`,
};

function countFor(o: AIRequestParsed["options"], quick: number, full: number) {
  return o.mode === "quick" ? quick : full;
}

export function buildPrompt(input: AIRequest): BuiltPrompt {
  const req = aiRequestSchema.parse(input);
  const { task, options } = req;

  let instruction = TASK_INSTRUCTIONS[task];
  if (task === "mcq") instruction += ` Write ${countFor(options, 5, 10)} questions.`;
  if (task === "flashcards") instruction += ` Write ${countFor(options, 8, 20)} cards.`;
  if (task === "examQuestions" || task === "qa") instruction += ` Write ${countFor(options, 5, 10)} questions.`;
  if (task === "compare" && req.sources.length !== 2) throw new Error("Compare needs exactly two notes.");
  if (task === "ask" && !req.question?.trim()) throw new Error("Ask needs a question.");

  const system = [
    "You are NoteScribe's study assistant for students preparing for exams and interviews.",
    GROUNDING,
    styleLine(options),
    JSON_TASKS.has(task) ? "Respond with valid JSON only, no Markdown fences." : "Respond in Markdown.",
  ].join("\n\n");

  const scopeNote = req.scope === "selection" ? "The student selected this part of a note:" : "Notes:";
  const sources = req.sources
    .map((s) => `<note id="${s.id}" title="${s.title.replace(/"/g, "'")}">\n${s.text}\n</note>`)
    .join("\n\n");

  const user = [
    `Task: ${instruction}`,
    req.question ? `Student's question: ${req.question.trim()}` : "",
    `${scopeNote}\n${sources}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user, json: JSON_TASKS.has(task) };
}
