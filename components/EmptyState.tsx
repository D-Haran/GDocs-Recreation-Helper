import { SearchX } from "lucide-react";

export function EmptyState({ title = "No matches", body = "Try a different search term or filter." }: { title?: string; body?: string }) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center rounded-3xl border border-dashed border-line-strong bg-surface p-8 text-center">
      <SearchX aria-hidden="true" className="mb-3 h-8 w-8 text-muted" />
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted">{body}</p>
    </div>
  );
}
