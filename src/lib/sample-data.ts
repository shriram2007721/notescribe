import { backupSchema, importBackup, BACKUP_FORMAT, BACKUP_VERSION } from "./backup";
import { db, getSetting, setSetting, type HighlightTag, type Rating } from "./db";
import { ensureCommunitySeeded, publishNote } from "./share";
import { DAY_MS, NEW_CARD_STATE, schedule, type SchedulingState } from "./srs";

/*
 * Ready-made study material so a first visit (or a demo) isn't empty: subjects, highlighted notes,
 * flashcards with a review history, quiz results and two notes published to the community feed.
 * Dates are relative to "now", so cards due today and the 7-day activity chart always look current.
 */

type Node = Record<string, unknown>;
const t = (text: string, marks?: Node[]): Node => ({ type: "text", text, ...(marks ? { marks } : {}) });
const hl = (tag: HighlightTag, text: string) => t(text, [{ type: "smartHighlight", attrs: { tag } }]);
const p = (...parts: (string | Node)[]): Node => ({ type: "paragraph", content: parts.map((x) => (typeof x === "string" ? t(x) : x)) });
const h = (text: string): Node => ({ type: "heading", attrs: { level: 2 }, content: [t(text)] });
const ul = (...items: (string | Node)[]): Node => ({
  type: "bulletList",
  content: items.map((x) => ({ type: "listItem", content: [p(x)] })),
});
const doc = (...content: Node[]) => ({ type: "doc" as const, content });

function plainText(node: Node): string {
  const lines: string[] = [];
  const walk = (n: Node) => {
    const kids = n.content as Node[] | undefined;
    if (kids?.some((c) => c.type === "text")) lines.push(kids.map((c) => c.text as string).join(""));
    else kids?.forEach(walk);
  };
  walk(node);
  return lines.join("\n");
}

const tagsOf = (node: Node) => (["exam", "interview", "concept"] as const).filter((tag) => JSON.stringify(node).includes(`"tag":"${tag}"`));

export function buildSampleBackup(now = Date.now()) {
  const day = (offset: number, hour = 10) => {
    const d = new Date(now + offset * DAY_MS);
    d.setHours(hour, 15, 0, 0);
    return d.getTime();
  };

  const folders = [
    { id: "f-os", name: "Operating Systems", createdAt: day(-9), order: 1 },
    { id: "f-dbms", name: "DBMS", createdAt: day(-9), order: 2 },
    { id: "f-cn", name: "Computer Networks", createdAt: day(-8), order: 3 },
    { id: "f-hr", name: "Placement Prep", createdAt: day(-7), order: 4 },
  ];

  const raw = [
    {
      id: "n-deadlock", title: "Operating Systems – Deadlocks", folderId: "f-os", pinned: 1, createdAt: day(-8), updatedAt: day(-1, 18),
      content: doc(
        h("What is a deadlock?"),
        p("A deadlock is a situation where a set of processes are blocked because each process holds a resource and waits for another resource held by some other process."),
        h("Coffman conditions"),
        p("A deadlock can arise only if ", hl("exam", "all four Coffman conditions hold at the same time: mutual exclusion, hold and wait, no preemption and circular wait"), "."),
        ul("Mutual exclusion – at least one resource is non-sharable.", "Hold and wait – a process holds one resource while requesting another.", "No preemption – resources cannot be forcibly taken away.", "Circular wait – a closed chain of processes, each waiting for the next."),
        h("Handling deadlocks"),
        p(hl("concept", "The Banker's algorithm avoids deadlock by granting a request only if the system stays in a safe state"), ". It needs every process to declare its maximum demand in advance."),
        p(hl("interview", "In interviews, compare prevention, avoidance and detection with one example each"), "."),
      ),
    },
    {
      id: "n-sched", title: "Lecture 12 – CPU Scheduling", folderId: "f-os", createdAt: day(-3, 11), updatedAt: day(-3, 12),
      content: doc(
        p("Today we covered CPU scheduling algorithms. The goal is to maximise CPU utilisation and throughput while minimising waiting time and response time."),
        p(hl("exam", "Round Robin gives every process a fixed time quantum"), ". If the quantum is too large it behaves like FCFS; if it is too small, context-switch overhead dominates."),
        p(hl("concept", "Shortest Job First minimises average waiting time but can starve long processes"), ". Ageing is used to prevent starvation."),
        p("Next class: multilevel feedback queues."),
      ),
    },
    {
      id: "n-norm", title: "DBMS – Normalization", folderId: "f-dbms", favorite: 1, createdAt: day(-6), updatedAt: day(-2, 16),
      content: doc(
        p("Normalization organises tables to reduce redundancy and avoid insertion, update and deletion anomalies."),
        ul(
          hl("exam", "1NF: every attribute holds atomic values"),
          hl("exam", "2NF: in 1NF and no partial dependency on a composite key"),
          hl("exam", "3NF: in 2NF and no transitive dependency"),
          hl("concept", "BCNF: for every functional dependency X → Y, X is a super key"),
        ),
        p("Denormalization is sometimes used in read-heavy systems to avoid expensive joins."),
      ),
    },
    {
      id: "n-sql", title: "DBMS – SQL Joins", folderId: "f-dbms", createdAt: day(-4), updatedAt: day(-4, 19),
      content: doc(
        p(hl("exam", "INNER JOIN returns only the rows that match in both tables"), "."),
        p(hl("exam", "LEFT JOIN returns every row of the left table, with NULLs where the right table has no match"), "."),
        p(hl("interview", "Be ready to explain the difference between WHERE and HAVING: WHERE filters rows, HAVING filters groups")),
        p("Practice: write a query that lists every student with their total marks, including students with no marks yet."),
      ),
    },
    {
      id: "n-tcp", title: "Computer Networks – TCP vs UDP", folderId: "f-cn", createdAt: day(-5), updatedAt: day(-4, 20),
      content: doc(
        p(hl("concept", "TCP is connection-oriented and guarantees ordered, reliable delivery"), " using sequence numbers, acknowledgements and retransmission."),
        p(hl("concept", "UDP is connectionless and has lower overhead"), ", so it suits DNS, live video and online games."),
        p(hl("exam", "The TCP three-way handshake is SYN, SYN-ACK, ACK"), "."),
        p(hl("interview", "Common interview question: why does video calling prefer UDP over TCP?")),
      ),
    },
    {
      id: "n-osi", title: "Computer Networks – OSI Model", folderId: "f-cn", createdAt: day(-2, 9), updatedAt: day(-2, 10),
      content: doc(
        p(hl("exam", "The seven OSI layers are Physical, Data Link, Network, Transport, Session, Presentation and Application"), "."),
        p(hl("concept", "Routers work at the Network layer and switches at the Data Link layer")),
        p("Mnemonic: Please Do Not Throw Sausage Pizza Away."),
      ),
    },
    {
      id: "n-star", title: "HR Interview – STAR Method", folderId: "f-hr", pinned: 1, createdAt: day(-7), updatedAt: day(-1, 9),
      content: doc(
        p(hl("interview", "STAR stands for Situation, Task, Action and Result"), ". Spend most of the answer on the Action."),
        p(hl("interview", "Always quantify the result, for example “reduced page load time by 40%”"), "."),
        ul("Prepare five or six stories that fit many questions.", "Keep each answer under two minutes.", "Have one failure story that ends with what you learned."),
      ),
    },
    {
      id: "n-ideas", title: "Ideas for mini project", createdAt: day(-2, 21), updatedAt: day(-2, 21),
      content: doc(p("Offline flashcards for lab viva questions. Maybe add a timer mode before exams.")),
    },
  ];

  const notes = raw.map((n) => ({ pinned: 0, favorite: 0, ...n, plainText: plainText(n.content), tags: tagsOf(n.content) }));

  type CardDef = [noteId: string, folderId: string, source: "manual" | "highlight", front: string, back: string, history: [number, Rating][]];
  const cardDefs: CardDef[] = [
    ["n-deadlock", "f-os", "highlight", "What are the four Coffman conditions for deadlock?", "Mutual exclusion, hold and wait, no preemption, circular wait", [[-6, "good"], [-5, "good"], [-2, "hard"]]],
    ["n-deadlock", "f-os", "highlight", "Which algorithm avoids deadlock by keeping the system in a safe state?", "The Banker's algorithm", [[-6, "good"], [-5, "easy"]]],
    ["n-sched", "f-os", "manual", "What happens if the Round Robin time quantum is very large?", "It behaves like FCFS (first come, first served)", [[-3, "good"]]],
    ["n-sched", "f-os", "manual", "Which scheduling algorithm minimises average waiting time?", "Shortest Job First (SJF)", [[-3, "again"], [-3, "good"], [-1, "good"]]],
    ["n-norm", "f-dbms", "highlight", "Define Second Normal Form (2NF).", "In 1NF with no partial dependency on a composite key", [[-5, "good"], [-4, "good"]]],
    ["n-norm", "f-dbms", "highlight", "Define Third Normal Form (3NF).", "In 2NF with no transitive dependency", [[-5, "hard"], [-4, "good"], [-1, "good"]]],
    ["n-norm", "f-dbms", "manual", "When is a relation in BCNF?", "When for every functional dependency X → Y, X is a super key", []],
    ["n-sql", "f-dbms", "highlight", "What does a LEFT JOIN return?", "Every row of the left table, with NULLs where the right table has no match", [[-4, "good"]]],
    ["n-sql", "f-dbms", "manual", "WHERE vs HAVING?", "WHERE filters rows; HAVING filters groups after GROUP BY", []],
    ["n-tcp", "f-cn", "highlight", "List the steps of the TCP three-way handshake.", "SYN, SYN-ACK, ACK", [[-4, "good"], [-3, "good"]]],
    ["n-tcp", "f-cn", "manual", "Name two applications that commonly use UDP.", "DNS and live video streaming", [[-4, "easy"]]],
    ["n-tcp", "f-cn", "manual", "Is TCP connection-oriented or connectionless?", "Connection-oriented", []],
    ["n-osi", "f-cn", "highlight", "At which OSI layer do routers work?", "The Network layer (layer 3)", [[-2, "good"]]],
    ["n-star", "f-hr", "highlight", "What does STAR stand for?", "Situation, Task, Action, Result", [[-6, "good"], [-5, "good"], [-2, "good"]]],
    ["n-star", "f-hr", "manual", "Which part of a STAR answer deserves the most time?", "The Action", [[-6, "hard"], [-1, "good"]]],
  ];

  const cards: Record<string, unknown>[] = [];
  const reviews: Record<string, unknown>[] = [];
  cardDefs.forEach(([noteId, folderId, source, front, back, history], i) => {
    let s: SchedulingState = NEW_CARD_STATE;
    let due = day(-1);
    let last: number | undefined;
    history.forEach(([off, rating], j) => {
      const at = day(off, 9 + ((i + j) % 10));
      const next = schedule(s, rating, at);
      reviews.push({ id: `r-${i}-${j}`, cardId: `c-${i}`, rating, reviewedAt: at, intervalBefore: s.interval, intervalAfter: next.interval });
      s = next;
      due = next.due;
      last = at;
    });
    cards.push({ id: `c-${i}`, front, back, noteId, folderId, source, createdAt: day(-7, 8), updatedAt: day(-7, 8), due, ...s, lastReviewedAt: last });
  });

  const quizAttempts = [
    { id: "q-1", title: "Flashcard quiz: Operating Systems", total: 5, correct: 3, at: day(-4, 19), mins: 5 },
    { id: "q-2", title: "Flashcard quiz: All subjects", total: 10, correct: 7, at: day(-2, 20), mins: 9 },
    { id: "q-3", title: "Flashcard quiz: DBMS", total: 5, correct: 4, at: day(-1, 21), mins: 4 },
  ].map(({ at, mins, ...q }) => ({ ...q, source: "flashcards" as const, noteIds: [], answers: [], startedAt: at, finishedAt: at + mins * 60_000 }));

  return backupSchema.parse({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, notes, folders, cards, reviews, quizAttempts });
}

/** Notes from the sample set that are shown as already published to the community feed. */
const PUBLISHED = [
  { title: "Operating Systems – Deadlocks", author: "Shri Ram R", likes: 12 },
  { title: "Computer Networks – TCP vs UDP", author: "N S Thilak Chowdhry", likes: 8 },
  { title: "DBMS – SQL Joins", author: "R Mukesh", likes: 5 },
];

let running: Promise<boolean> | null = null;

/** Loads the sample set once per browser (added alongside any existing notes); `force` loads it again. */
export function loadSampleData({ force = false } = {}) {
  // Two components (or React's dev double-effect) may ask at once; share one run.
  running ??= seed(force).finally(() => (running = null));
  return running;
}

async function seed(force: boolean) {
  if (!force && (await getSetting("sampleSeeded", false))) return false;
  await setSetting("sampleSeeded", true);
  await importBackup(buildSampleBackup());
  await ensureCommunitySeeded();
  for (const { title, author, likes } of PUBLISHED) {
    const note = await db.notes.where("updatedAt").above(0).filter((n) => n.title === title && !n.shareId).last();
    if (!note) continue;
    const id = await publishNote(note, author);
    await db.community.update(id, { likes, publishedAt: note.updatedAt + 60 * 60_000 });
  }
  return true;
}
