"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkerResponse } from "@/workers/whisper.worker";

export type VoiceStatus = "idle" | "recording" | "paused" | "transcribing" | "review" | "error";

const SAMPLE_RATE = 16_000; // what Whisper expects
export const MAX_RECORDING_MS = 30 * 60_000; // keeps memory and transcription time reasonable

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

  const workerRef = useRef<Worker | null>(null);
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

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("../workers/whisper.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === "progress") setModelProgress(msg.progress);
      else if (msg.type === "ready") {
        setModelReady(true);
        setModelProgress(null);
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
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = async () => {
      pauseClock();
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
    setTranscript("");
    setError(null);
    setElapsed(0);
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setTranscript("");
    setError(null);
    setElapsed(0);
  }, []);

  /** Downloads/warms the model without recording ("prepare for offline"). */
  const preload = useCallback(() => {
    setError(null);
    getWorker().postMessage({ type: "load" });
  }, [getWorker]);

  return { status, modelProgress, modelReady, error, elapsed, transcript, setTranscript, start, stop, pause, resume, discard, reset, preload };
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
