import type { CommunityPost, HighlightTag } from "@/lib/db";
import { HIGHLIGHT_ORDER } from "@/lib/highlights";

type Part = string | [HighlightTag, string];

const DAY = 86_400_000;

function post(id: string, title: string, author: string, daysAgo: number, likes: number, paragraphs: Part[][]): CommunityPost {
  const content = {
    type: "doc",
    content: paragraphs.map((parts) => ({
      type: "paragraph",
      content: parts.map((p) =>
        typeof p === "string"
          ? { type: "text", text: p }
          : { type: "text", text: p[1], marks: [{ type: "smartHighlight", attrs: { tag: p[0] } }] },
      ),
    })),
  };
  const used = new Set(paragraphs.flat().flatMap((p) => (typeof p === "string" ? [] : [p[0]])));
  return {
    id,
    title,
    author,
    content,
    plainText: paragraphs.map((ps) => ps.map((p) => (typeof p === "string" ? p : p[1])).join("")).join("\n"),
    tags: HIGHLIGHT_ORDER.filter((t) => used.has(t)),
    // Fixed epoch offset so the seed is deterministic.
    publishedAt: Date.UTC(2026, 9, 25) - daysAgo * DAY,
    likes,
  };
}

export const SEED_POSTS: CommunityPost[] = [
  post("seed-os", "Operating Systems: Deadlocks", "Priya S.", 0, 42, [
    [
      "A deadlock is a state where processes wait on each other forever. ",
      ["exam", "The four Coffman conditions are mutual exclusion, hold and wait, no preemption, and circular wait."],
      " Break any one and deadlock cannot occur.",
    ],
    [
      ["concept", "The Banker's algorithm avoids deadlock by only granting requests that keep the system in a safe state."],
      " It needs each process's maximum demand up front.",
    ],
    [["interview", "Be ready to explain how you'd detect a deadlock in a production service using thread dumps."]],
  ]),
  post("seed-sql", "SQL Joins Cheat Sheet", "Marcus T.", 1, 31, [
    [
      ["concept", "INNER JOIN returns only matching rows; LEFT JOIN keeps every row from the left table."],
      " Unmatched columns come back as NULL.",
    ],
    [
      ["interview", "Classic question: find employees earning more than their manager. Use a self-join on manager_id."],
    ],
    [["exam", "Normal forms: 1NF atomic values, 2NF no partial dependency, 3NF no transitive dependency."]],
  ]),
  post("seed-behav", "Behavioural Interview: STAR Method", "Aisha K.", 3, 58, [
    [
      ["interview", "STAR = Situation, Task, Action, Result. Spend most of the answer on Action."],
      " Quantify the result whenever you can.",
    ],
    [
      "Prepare 5–6 stories that can flex across questions. ",
      ["interview", "Always have a 'failure' story that ends with what you changed afterwards."],
    ],
    [["concept", "Interviewers score evidence of ownership, not the size of the project."]],
  ]),
  post("seed-bio", "Cell Biology: Photosynthesis", "Daniel R.", 6, 19, [
    [
      ["exam", "Light reactions happen in the thylakoid membrane; the Calvin cycle happens in the stroma."],
    ],
    [
      ["concept", "Chlorophyll absorbs red and blue light and reflects green."],
      " That's why leaves look green.",
    ],
    [["exam", "Overall equation: 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂."]],
  ]),
];
