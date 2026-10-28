import type { HighlightTag } from "@/lib/db";
import { HIGHLIGHTS, HIGHLIGHT_STYLES } from "@/lib/highlights";
import { cn } from "@/lib/utils";

export function TagChips({ tags }: { tags: HighlightTag[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", HIGHLIGHT_STYLES[t].chip)}>
          {HIGHLIGHTS[t].icon} {HIGHLIGHTS[t].short}
        </span>
      ))}
    </div>
  );
}
