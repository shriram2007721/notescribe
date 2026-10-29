"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkerResponse } from "@/workers/whisper.worker";

export type VoiceStatus = "idle" | "recording" | "paused" | "transcribing" | "review" | "error";

const SAMPLE_RATE = 16_000; // what Whisper expects
export const MAX_RECORDING_MS = 30 * 60_000; // keeps memory and transcription time reasonable
const LIVE_INTERVAL_MS = 2_000; // how often the live preview refreshes
const SEGMENT_SAMPLES = 25 * SAMPLE_RATE; // live audio is committed in 25 s pieces (Whisper's window is 30 s)

export function voiceSupport(): string | null {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext) return "Recording needs a secure (https) connection.";
  if (!navigator.mediaDevices?.getUserMedia) return "This browser can't access a microphone.";
  if (typeof MediaRecorder === "undefined") return "This browser doesn't support audio recording (MediaRecorder).";
  if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") return "This browser can't run the on-device speech model.";
  return null;
}

function micError(err: unknown) {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access was blocked. Allow it from the address bar's site settings, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone was found. Connect one and try again.";
  if (name === "NotReadableError") return "The microphone is being used by another app. Close it and try again.";
  return "Couldn't start the microphone.";
}

/**
 * Records from the mic and transcribes locally with Whisper in a Web Worker.
 * Audio never leaves the device; the model is downloaded once and cached by the browser.
 * The transcript is exposed for review instead of being inserted automatically.
 */
export function useWhisper() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [liveText, setLiveText] = useState("");

  const workerRef = useRef<Worker | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Live preview state: text already committed, how many samples it covers, and whether a pass is running.
  const live = useRef({ active: false, busy: false, ready: false, text: "", samples: 0, timer: 0 as ReturnType<typeof setInterval> | 0 });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const discardRef = useRef(false);
  const clock = useRef({ startedAt: 0, accumulated: 0, timer: 0 as ReturnType<typeof setInterval> | 0 });

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  function tickStop() {
    if (clock.current.timer) clearInterval(clock.current.timer);
    clock.current.timer = 0;
  }

  function stopLive() {
    if (live.current.timer) clearInterval(live.current.timer);
    live.current.timer = 0;
    live.current.active = false;
  }

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("../workers/whisper.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === "progress") setModelProgress(msg.progress);
      else if (msg.type === "ready") {
        live.current.ready = true;
        setModelReady(true);
        setModelProgress(null);
      } else if (msg.type === "partial") {
        const l = live.current;
        l.busy = false;
        if (!l.active) return;
        if (msg.commit) {
          l.text = [l.text, msg.text].filter(Boolean).join(" ");
          l.samples += SEGMENT_SAMPLES;
          setLiveText(l.text);
        } else setLiveText([l.text, msg.text].filter(Boolean).join(" "));
      } else if (msg.type === "result") {
        setTranscript(msg.text);
        setStatus(msg.text ? "review" : "error");
        if (!msg.text) setError("No speech was detected in the recording.");
      } else if (msg.type === "error") {
        setModelProgress(null);
        setError(msg.message);
        setStatus("error");
      }
    };
    workerRef.current = worker;
    return worker;
  }, []);

  useEffect(
    () => () => {
      // Always release the microphone and worker when the component goes away.
      discardRef.current = true;
      tickStop();
      stopLive();
      if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
      stopTracks();
      workerRef.current?.terminate();
    },
    [],
  );

  // Clock helpers only touch refs and state setters, so they are stable for the hook's lifetime.
  const startClock = useCallback(() => {
    clock.current.startedAt = Date.now();
    tickStop();
    clock.current.timer = setInterval(() => {
      const ms = currentElapsed(clock.current);
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS && recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    }, 250);
  }, []);

  const pauseClock = useCallback(() => {
    clock.current.accumulated = currentElapsed(clock.current);
    clock.current.startedAt = 0;
    tickStop();
  }, []);

  const start = useCallback(async () => {
    const unsupported = voiceSupport();
    if (unsupported) {
      setError(unsupported);
      setStatus("error");
      return;
    }
    setError(null);
    setTranscript("");
    discardRef.current = false;
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(micError(err));
      setStatus("error");
      return;
    }

    const recorder = new MediaRecorder(streamRef.current);
    const chunks: Blob[] = [];
    chunksRef.current = chunks;
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = async () => {
      pauseClock();
      stopLive();
      stopTracks();
      if (discardRef.current) {
        setStatus("idle");
        return;
      }
      setStatus("transcribing");
      try {
        const audio = await decodeToMono16k(new Blob(chunks, { type: recorder.mimeType }));
        getWorker().postMessage({ type: "transcribe", audio }, [audio.buffer]);
      } catch {
        setError("Couldn't read the recording. Try again.");
        setStatus("error");
      }
    };

    recorderRef.current = recorder;
    clock.current.accumulated = 0;
    setElapsed(0);
    recorder.start(1000);
    startClock();
    setStatus("recording");
    // Load the model while the user is speaking so it's ready when they stop.
    getWorker().postMessage({ type: "load" });

    // Live preview: every few seconds transcribe the audio since the last committed segment.
    stopLive();
    live.current = { ...live.current, active: true, busy: false, text: "", samples: 0 };
    setLiveText("");
    live.current.timer = setInterval(async () => {
      const l = live.current;
      if (!l.active || l.busy || !l.ready || recorder.state !== "recording" || !chunks.length) return;
      l.busy = true;
      try {
        const audio = await decodeToMono16k(new Blob(chunks, { type: recorder.mimeType }));
        const pending = audio.length - l.samples;
        if (!l.active || pending < SAMPLE_RATE) {
          l.busy = false;
          return;
        }
        const commit = pending > SEGMENT_SAMPLES;
        const window = audio.slice(l.samples, commit ? l.samples + SEGMENT_SAMPLES : audio.length);
        getWorker().postMessage({ type: "partial", audio: window, commit }, [window.buffer]);
      } catch {
        l.busy = false; // a partly written chunk can fail to decode; the next tick retries
      }
    }, LIVE_INTERVAL_MS);
  }, [getWorker, pauseClock, startClock]);

  const stop = useCallback(() => {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") r.stop();
  }, []);

  const pause = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      pauseClock();
      setStatus("paused");
    }
  }, [pauseClock]);

  const resume = useCallback(() => {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      startClock();
      setStatus("recording");
    }
  }, [startClock]);

  /** Throws away the current recording (or reviewed transcript). */
  const discard = useCallback(() => {
    discardRef.current = true;
    const r = recorderRef.current;
    if (r && r.state !== "inactive") r.stop();
    else setStatus("idle");
    stopTracks();
    stopLive();
    setTranscript("");
    setLiveText("");
    setError(null);
    setElapsed(0);
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setTranscript("");
    setLiveText("");
    setError(null);
    setElapsed(0);
  }, []);

  /** Downloads/warms the model without recording ("prepare for offline"). */
  const preload = useCallback(() => {
    setError(null);
    getWorker().postMessage({ type: "load" });
  }, [getWorker]);

  return { status, modelProgress, modelReady, error, elapsed, transcript, liveText, setTranscript, start, stop, pause, resume, discard, reset, preload };
}

function currentElapsed(c: { accumulated: number; startedAt: number }) {
  return c.accumulated + (c.startedAt ? Date.now() - c.startedAt : 0);
}

async function decodeToMono16k(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    if (buf.numberOfChannels === 1) return buf.getChannelData(0).slice();
    const mono = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < data.length; i++) mono[i] += data[i] / buf.numberOfChannels;
    }
    return mono;
  } finally {
    await ctx.close();
  }
}
