"use client";

import { Building2, CirclePlus, LayoutGrid, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { OtpLogin } from "@/components/account/otp-login";
import { TorobLogo } from "@/components/torob-logo";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useHydrated } from "@/lib/account/local-store";
import { formatMobile, useSession } from "@/lib/account/session";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/ads", label: "آگهی‌ها", icon: LayoutGrid },
  { href: "/new", label: "ثبت آگهی", icon: CirclePlus },
  { href: "/agency", label: "پنل املاک", icon: Building2 },
] as const;

/** torob.com's header band for the account pages: logo + «ترب» on the start side, «ورود / ثبت نام» on the end. */
export function SiteHeader({ className }: { className?: string }) {
  const path = usePathname();
  return (
    <header className={cn("bg-card sticky top-0 z-30 border-b", className)}>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-1.5" aria-label="صفحهٔ اول ترب">
          <TorobLogo className="size-8" />
          <span className="text-xl font-bold text-(--logo-color-1)">ترب</span>
        </Link>
        <nav className="no-scrollbar ms-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const on = path === href || path.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                  on ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="hidden size-4 sm:block" />
                {label}
              </Link>
            );
          })}
        </nav>
        <AccountButton />
      </div>
    </header>
  );
}

/** «ورود / ثبت نام» (torob.com: white, 1px #ccc border, 12px muted text) → login dialog; signed in → «حساب من». */
export function AccountButton({ className }: { className?: string }) {
  const hydrated = useHydrated();
  const user = useSession("user");
  const [open, setOpen] = useState(false);
  const base = "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors";
  if (hydrated && user)
    return (
      <Link href="/my" className={cn(base, "border-input bg-card text-foreground hover:bg-muted", className)}>
        <UserRound className="size-3.5" />
        <span className="hidden sm:inline">حساب من</span>
        <span dir="ltr" className="text-muted-foreground hidden md:inline">
          {formatMobile(user.phone)}
        </span>
      </Link>
    );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(base, "border-input bg-card text-muted-foreground hover:text-foreground", className)}>
        ورود / ثبت نام
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-5 sm:max-w-sm">
          <DialogTitle className="sr-only">ورود به ترب</DialogTitle>
          <OtpLogin role="user" onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
