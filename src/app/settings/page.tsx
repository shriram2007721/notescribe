"use client";

import { CheckCircle2, Download, HardDrive, Loader2, Mic, Monitor, Moon, Sparkles, Sun, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ImportPanel } from "@/components/settings/import-panel";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/input";
import { useWhisper } from "@/hooks/use-whisper";
import { isValidProxyUrl, setAIConsent, setAIUrl, useAIConfig } from "@/lib/ai/config";
import { createBackup } from "@/lib/backup";
import { db } from "@/lib/db";
import { downloadText } from "@/lib/download";
import { docToMarkdown } from "@/lib/markdown";
import { loadSampleData } from "@/lib/sample-data";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const stamp = () => new Date().toISOString().slice(0, 10);

function SampleData() {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try {
      await loadSampleData({ force: true });
      toast({ title: "Sample notes, flashcards and quizzes added", tone: "success" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={load} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Load sample notes
      </Button>
      <p className="text-xs text-muted-foreground">Added as new copies next to your own notes; nothing is replaced.</p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="mt-6 space-y-6">
        <Appearance />
        <AISettings />
        <Section id="backup" title="Backup & export" description="Your data lives only in this browser. Download a backup regularly.">
          <BackupExport />
        </Section>
        <Section id="import" title="Import" description="Restore a backup or bring in Markdown notes.">
          <ImportPanel />
        </Section>
        <Section id="samples" title="Sample study material" description="Example subjects, highlighted notes, flashcards, quiz results and community posts.">
          <SampleData />
        </Section>
        <Storage />
        <VoiceModel />
      </div>
    </div>
  );
}

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-h`} className="scroll-mt-20 rounded-lg border bg-card p-5">
      <h2 id={`${id ?? title}-h`} className="font-semibold">
        {title}
      </h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Appearance() {
  const { preference, setTheme } = useTheme();
  const options: [ThemePreference, string, typeof Sun][] = [
    ["light", "Light", Sun],
    ["dark", "Dark", Moon],
    ["system", "System", Monitor],
  ];
  return (
    <Section id="appearance" title="Appearance">
      <div role="radiogroup" aria-label="Theme" className="inline-flex gap-1 rounded-lg bg-muted p-1">
        {options.map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={preference === value}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
              preference === value ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function AISettings() {
  const config = useAIConfig();
  const { toast } = useFeedback();
  const [url, setUrl] = useState("");
  const [test, setTest] = useState<{ state: "idle" | "testing" | "ok" | "fail"; message?: string }>({ state: "idle" });

  useEffect(() => {
    if (config) setUrl(config.url);
  }, [config]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (url && !isValidProxyUrl(url)) return setTest({ state: "fail", message: "Use an https:// URL (or http://localhost for development)." });
    await setAIUrl(url);
    toast({ title: url ? "AI proxy URL saved" : "AI disabled", tone: "success" });
  };

  const testConnection = async () => {
    if (!isValidProxyUrl(url)) return setTest({ state: "fail", message: "Enter a valid https:// URL first." });
    setTest({ state: "testing" });
    try {
      const res = await fetch(url.replace(/\/+$/, "") + "/health", { signal: AbortSignal.timeout(10_000) });
      const body = (await res.json()) as { ok?: boolean; configured?: boolean };
      if (!res.ok || !body.ok) throw new Error(`HTTP ${res.status}`);
      setTest(body.configured ? { state: "ok", message: "Connected. The proxy has an API key." } : { state: "fail", message: "Reached the proxy, but it has no GEMINI_API_KEY secret." });
    } catch (err) {
      setTest({ state: "fail", message: `Couldn't reach the proxy (${err instanceof Error ? err.message : "error"}). Check the URL and its ALLOWED_ORIGINS.` });
    }
  };

  return (
    <Section id="ai" title="AI assistant" description="Optional. Summaries, explanations, quizzes and flashcards generated from your notes.">
      <form onSubmit={save} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="ai-url">AI proxy URL</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="ai-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://notescribe-ai-proxy.<you>.workers.dev" inputMode="url" />
            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="outline" onClick={testConnection} disabled={!url || test.state === "testing"}>
                {test.state === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Test
              </Button>
            </div>
          </div>
          {test.message && (
            <p role="status" className={cn("flex items-center gap-1.5 text-sm", test.state === "ok" ? "text-green-700 dark:text-green-400" : "text-destructive")}>
              {test.state === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {test.message}
            </p>
          )}
        </div>
      </form>
      <div className="mt-4 space-y-2 rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">How it works:</span> NoteScribe never stores an AI provider key. It sends the text of the note(s) you choose, only when you
          click an AI action, to this proxy. The proxy holds the key and asks Google Gemini for the result. Deploy your own proxy from the <code>ai-proxy/</code> folder (see
          AI_SETUP.md).
        </p>
        {config?.consent ? (
          <p className="flex flex-wrap items-center gap-2">
            You&apos;ve agreed to the AI data notice.
            <button type="button" className="font-medium text-primary underline" onClick={() => setAIConsent(false)}>
              Withdraw consent
            </button>
          </p>
        ) : (
          <p>You&apos;ll be asked to agree before the first AI request.</p>
        )}
      </div>
    </Section>
  );
}

function BackupExport() {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);

  const backup = async () => {
    setBusy(true);
    try {
      const data = await createBackup();
      downloadText(`notescribe-backup-${stamp()}.json`, JSON.stringify(data, null, 2), "application/json");
      toast({ title: `Backup downloaded (${data.notes.length} notes, ${data.cards.length} cards)`, tone: "success" });
    } finally {
      setBusy(false);
    }
  };

  const markdown = async () => {
    const notes = (await db.notes.toArray()).filter((n) => n.deletedAt === undefined).sort((a, b) => a.createdAt - b.createdAt);
    const body = notes.map((n) => docToMarkdown(n.content, n.title || "Untitled note")).join("\n---\n\n");
    downloadText(`notescribe-notes-${stamp()}.md`, body || "# No notes\n", "text/markdown");
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={backup} disabled={busy}>
        <Download className="h-4 w-4" /> Download full backup (.json)
      </Button>
      <Button variant="outline" onClick={markdown}>
        <Download className="h-4 w-4" /> All notes as Markdown
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        The JSON backup includes notes, subjects, flashcards, review history and quiz results, and can be restored with Import. Individual notes can be exported as Markdown
        or printed to PDF from the note&apos;s ⋯ menu.
      </p>
    </div>
  );
}

function Storage() {
  const [info, setInfo] = useState<{ usage?: number; quota?: number; persisted?: boolean } | null>(null);
  const { toast } = useFeedback();

  const refresh = async () => {
    const est = await navigator.storage?.estimate?.().catch(() => undefined);
    const persisted = await navigator.storage?.persisted?.().catch(() => undefined);
    setInfo({ usage: est?.usage, quota: est?.quota, persisted });
  };
  useEffect(() => {
    refresh();
  }, []);

  const persist = async () => {
    const ok = await navigator.storage?.persist?.().catch(() => false);
    toast({ title: ok ? "Storage marked as persistent" : "The browser declined. Installing the app usually allows it.", tone: ok ? "success" : "default" });
    refresh();
  };

  const mb = (b?: number) => (b === undefined ? "?" : `${(b / 1024 / 1024).toFixed(1)} MB`);

  return (
    <Section id="storage" title="Storage on this device">
      <div className="flex items-start gap-3 text-sm">
        <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="space-y-2">
          <p>
            Using {mb(info?.usage)} of {mb(info?.quota)} available (includes the cached app and speech model).
          </p>
          <p className="text-muted-foreground">
            Notes are stored only in this browser. They&apos;re lost if you clear site data, and they don&apos;t sync to other devices. Keep a backup.
          </p>
          {info?.persisted === false && (
            <Button size="sm" variant="outline" onClick={persist}>
              Ask the browser to keep data persistently
            </Button>
          )}
          {info?.persisted && <p className="text-green-700 dark:text-green-400">Persistent storage is on; the browser won&apos;t evict your notes automatically.</p>}
        </div>
      </div>
    </Section>
  );
}

function VoiceModel() {
  const v = useWhisper();
  return (
    <Section id="voice" title="Offline voice transcription" description="Download the speech model now so dictation works without internet later (~40 MB, cached by the browser).">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button variant="outline" onClick={v.preload} disabled={v.modelProgress !== null || v.modelReady}>
          <Mic className="h-4 w-4" /> {v.modelReady ? "Model ready" : v.modelProgress !== null ? `Downloading ${v.modelProgress}%` : "Download speech model"}
        </Button>
        {v.modelReady && <span className="text-green-700 dark:text-green-400">Ready for offline use on this device.</span>}
        {v.error && <span className="text-destructive">{v.error}</span>}
      </div>
    </Section>
  );
}
