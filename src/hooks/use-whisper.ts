"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkerResponse } from "@/workers/whisper.worker";

export type VoiceStatus = "idle" | "loading" | "ready" | "recording" | "transcribing" | "error";

const SAMPLE_RATE = 16_000; // what Whisper expects

/** Records from the mic and transcribes locally with Whisper in a Web Worker. */
export function useWhisper(onText: (text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const readyRef = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("../workers/whisper.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      switch (msg.type) {
        case "progress":
          setProgress(msg.progress);
          break;
        case "ready":
          readyRef.current = true;
          setProgress(null);
          setStatus((s) => (s === "loading" ? "ready" : s));
          break;
        case "result":
          setStatus("ready");
          if (msg.text) onTextRef.current(msg.text);
          break;
        case "error":
          setProgress(null);
          setError(msg.message);
          setStatus("error");
          break;
      }
    };
    workerRef.current = worker;
    return worker;
  }, []);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  /** Downloads/warms the model without recording (e.g. "prepare for offline"). */
  const preload = useCallback(() => {
    if (readyRef.current) return;
    setError(null);
    setStatus("loading");
    getWorker().postMessage({ type: "load" });
  }, [getWorker]);

  const start = useCallback(async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was blocked. Allow it in your browser settings.");
      setStatus("error");
      return;
    }

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
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
    recorder.start();
    setStatus("recording");
    // Load the model in parallel with recording so it's ready when the user stops.
    if (!readyRef.current) getWorker().postMessage({ type: "load" });
  }, [getWorker]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  return { status, progress, error, start, stop, preload };
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
