/// <reference lib="webworker" />
import type * as Transformers from "@huggingface/transformers";
import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

// Runs Whisper entirely in the browser. Model weights are fetched from Hugging Face once,
// then served from the browser Cache API ("transformers-cache"), so dictation works offline.
export const MODEL_ID = "Xenova/whisper-tiny.en";

// Prebuilt bundle copied to public/ by scripts/copy-transformers.mjs (kept out of webpack on purpose).
const VENDOR = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/vendor/transformers/`;

async function loadLibrary(): Promise<typeof Transformers> {
  const lib: typeof Transformers = await import(/* webpackIgnore: true */ `${VENDOR}transformers.min.js`);
  lib.env.allowLocalModels = false;
  lib.env.useBrowserCache = true;
  if (lib.env.backends.onnx.wasm) lib.env.backends.onnx.wasm.wasmPaths = VENDOR;
  return lib;
}

export type WorkerRequest =
  | { type: "load" }
  | { type: "transcribe"; audio: Float32Array }
  // Live preview while recording: a window of at most 30 s; `commit` marks a finished segment.
  | { type: "partial"; audio: Float32Array; commit: boolean };
export type WorkerResponse =
  | { type: "progress"; progress: number }
  | { type: "ready" }
  | { type: "result"; text: string }
  | { type: "partial"; text: string; commit: boolean }
  | { type: "error"; message: string };

const post = (msg: WorkerResponse) => self.postMessage(msg);

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
const fileProgress = new Map<string, { loaded: number; total: number }>();

function load() {
  asr ??= loadLibrary().then(({ pipeline }) =>
    pipeline("automatic-speech-recognition", MODEL_ID, {
      dtype: "q8",
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== "progress" || !p.file || !p.total) return;
        fileProgress.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
        let loaded = 0;
        let total = 0;
        fileProgress.forEach((f) => {
          loaded += f.loaded;
          total += f.total;
        });
        post({ type: "progress", progress: Math.round((loaded / total) * 100) });
      },
    }),
  ).catch((err) => {
    asr = null; // allow a retry once back online
    throw err;
  });
  return asr;
}

function describe(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (!navigator.onLine || /fetch|network/i.test(msg)) {
    return "Voice model isn't downloaded yet. Connect to the internet once to download it (~40 MB), then dictation works offline.";
  }
  return msg;
}

const clean = (out: { text: string } | { text: string }[]) =>
  (Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text)
    .replace(/\[(BLANK_AUDIO|MUSIC|NOISE)\]|\((?:[^)]*)\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

async function handle(req: WorkerRequest) {
  try {
    if (req.type === "load") {
      await load();
      post({ type: "ready" });
      return;
    }
    const transcriber = await load();
    post({ type: "ready" });
    if (req.type === "partial") {
      post({ type: "partial", text: clean(await transcriber(req.audio)), commit: req.commit });
      return;
    }
    post({ type: "result", text: clean(await transcriber(req.audio, { chunk_length_s: 30, stride_length_s: 5 })) });
  } catch (err) {
    post({ type: "error", message: describe(err) });
  }
}

// One request at a time: the pipeline isn't safe to call concurrently, and the final
// transcription must wait for any live-preview pass that is still running.
let queue = Promise.resolve();
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  queue = queue.then(() => handle(e.data));
};
