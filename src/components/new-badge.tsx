import { cn } from "@/lib/utils";

/** «جدید» pill for ads posted within a day of the newest one (SearchResult.isNew). Map pins use the CSS twin `.hr-pin__new`. */
export function NewBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "hr-new-badge bg-brand-soft text-brand-ink ring-primary/15 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] leading-none font-extrabold ring-1",
        className,
      )}
    >
      <span className="bg-primary relative flex size-1.5 rounded-full">
        <span className="hr-new-badge__ping bg-primary absolute inset-0 rounded-full" />
      </span>
      جدید
    </span>
  );
}
