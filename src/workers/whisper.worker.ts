/// <reference lib="webworker" />
import type * as Transformers from "@huggingface/transformers";
import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

// Runs Whisper entirely in the browser. Model weights are fetched from Hugging Face once,
// then served from the browser Cache API ("transformers-cache"), so dictation works offline.
export const MODEL_ID = "Xenova/whisper-tiny.en";

// Prebuilt bundle copied to public/ by scripts/copy-transformers.mjs (kept out of webpack on purpose).
const VENDOR = "/vendor/transformers/";

async function loadLibrary(): Promise<typeof Transformers> {
  const lib: typeof Transformers = await import(/* webpackIgnore: true */ `${VENDOR}transformers.min.js`);
  lib.env.allowLocalModels = false;
  lib.env.useBrowserCache = true;
  if (lib.env.backends.onnx.wasm) lib.env.backends.onnx.wasm.wasmPaths = VENDOR;
  return lib;
}

export type WorkerRequest = { type: "load" } | { type: "transcribe"; audio: Float32Array };
export type WorkerResponse =
  | { type: "progress"; progress: number }
  | { type: "ready" }
  | { type: "result"; text: string }
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

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  try {
    if (e.data.type === "load") {
      await load();
      post({ type: "ready" });
      return;
    }
    const transcriber = await load();
    post({ type: "ready" });
    const out = await transcriber(e.data.audio, { chunk_length_s: 30, stride_length_s: 5 });
    const text = (Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text)
      .replace(/\[(BLANK_AUDIO|MUSIC|NOISE)\]|\((?:[^)]*)\)/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    post({ type: "result", text });
  } catch (err) {
    post({ type: "error", message: describe(err) });
  }
};
