"use client";

import { EditorContent, type JSONContent } from "@tiptap/react";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { HighlightExtractor } from "@/components/editor/highlight-extractor";
import { useSmartEditor } from "@/components/editor/use-smart-editor";
import { Button } from "@/components/ui/button";
import { createNote, type HighlightTag } from "@/lib/db";
import { community, decodeSharePayload } from "@/lib/share";

interface Viewable {
  title: string;
  author?: string;
  content: unknown;
  plainText?: string;
  tags: HighlightTag[];
}

export default function SharedPage() {
  return (
    <Suspense>
      <SharedLoader />
    </Suspense>
  );
}

function SharedLoader() {
  const postId = useSearchParams().get("post");
  const [data, setData] = useState<Viewable | null | undefined>(undefined);

  useEffect(() => {
    if (postId) community.get(postId).then((p) => setData(p ?? null));
    else setData(decodeSharePayload(window.location.hash));
  }, [postId]);

  if (data === undefined) return null;
  if (data === null) {
    return (
      <main className="container py-16 text-center">
        <p className="font-medium">This shared note couldn&apos;t be opened.</p>
        <p className="text-sm text-muted-foreground">The link may be incomplete or corrupted.</p>
      </main>
    );
  }
  return <SharedView data={data} fromCommunity={!!postId} />;
}

function SharedView({ data, fromCommunity }: { data: Viewable; fromCommunity: boolean }) {
  const router = useRouter();
  const editor = useSmartEditor({ content: data.content as JSONContent, editable: false });

  const saveCopy = async () => {
    if (!editor) return;
    const note = await createNote({
      title: data.title,
      content: editor.getJSON(),
      plainText: editor.getText({ blockSeparator: "\n" }).trim(),
      tags: data.tags,
    });
    router.push(`/note?id=${note.id}`);
  };

  return (
    <main className="container py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {fromCommunity && (
          <Link href="/community" className="rounded-md p-2 hover:bg-accent" aria-label="Back to community">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{data.title || "Untitled note"}</h1>
          {data.author && <p className="text-sm text-muted-foreground">Shared by {data.author}</p>}
        </div>
        <Button onClick={saveCopy} disabled={!editor}>
          <Download className="h-4 w-4" /> Save to my notes
        </Button>
      </div>

      {editor && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 rounded-xl border px-5">
            <EditorContent editor={editor} />
          </section>
          <HighlightExtractor editor={editor} className="lg:sticky lg:top-4 lg:self-start" />
        </div>
      )}
    </main>
  );
}
