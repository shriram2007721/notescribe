import type { HighlightTag } from "@/lib/db";
import { tagFill, tagInfo } from "@/lib/highlights";

export function TagChips({ tags }: { tags: HighlightTag[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: tagFill(t, 0.45) }}>
          {tagInfo(t).icon} {tagInfo(t).short}
        </span>
      ))}
    </div>
  );
}
