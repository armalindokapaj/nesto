import Link from "next/link";
import { Paperclip } from "lucide-react";

export function TaskDocumentsBadge({ taskId, count }: { taskId: string; count: number }) {
  if (count === 0) return null;

  return (
    <Link
      href={`/documents?taskId=${taskId}`}
      className="inline-flex items-center gap-1 text-[0.65rem] text-ink-faint hover:text-gold"
    >
      <Paperclip size={11} /> {count}
    </Link>
  );
}
