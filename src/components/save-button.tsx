"use client";

import { Heart } from "lucide-react";

import { toggleSave, useTaste } from "@/lib/taste-store";
import { cn } from "@/lib/utils";

/** ♥ — saves a listing on this phone; the home's «پیشنهاد برای تو» rail is built from these. */
export function SaveButton({ id, variant = "inline", className }: { id: string; variant?: "overlay" | "inline"; className?: string }) {
  const saved = useTaste().saved.includes(id);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "حذف از ذخیره‌شده‌ها" : "ذخیره"}
      onClick={(e) => {
        e.stopPropagation();
        toggleSave(id);
      }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full transition-[color,transform] active:scale-90",
        variant === "overlay" ? "bg-card/90 size-8 shadow-xs" : "hover:bg-muted size-8 border",
        saved ? "text-primary" : "text-muted-foreground hover:text-primary",
        className,
      )}
    >
      <Heart className={cn("size-4", saved && "fill-current")} />
    </button>
  );
}
