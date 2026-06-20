import type { LucideIcon } from "lucide-react";

export function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDayLabel(ts: string) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function MessageStatus({
  readAt,
  Check,
  CheckCheck,
}: {
  readAt: string | null;
  Check: LucideIcon;
  CheckCheck: LucideIcon;
}) {
  if (readAt) {
    return (
      <span className="inline-flex items-center gap-0.5" title={`Read ${new Date(readAt).toLocaleString()}`}>
        <CheckCheck className="h-3 w-3" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5" title="Delivered">
      <Check className="h-3 w-3" />
    </span>
  );
}
