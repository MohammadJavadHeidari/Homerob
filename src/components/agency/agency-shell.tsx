"use client";

import { BarChart3, Building2, ExternalLink, FileUp, Files, LayoutDashboard, LogOut, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { inputCls } from "@/components/account/ad-form";
import { OtpLogin } from "@/components/account/otp-login";
import { TorobLogo } from "@/components/torob-logo";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/account/local-store";
import { formatMobile, saveAgencyProfile, signOut, useSession, type Session } from "@/lib/account/session";
import { canonicalCity, CITIES } from "@/lib/places";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/agency", label: "داشبورد", icon: LayoutDashboard },
  { href: "/agency/files", label: "فایل‌ها", icon: Files },
  { href: "/agency/upload", label: "آپلود فایل", icon: Upload },
] as const;

/** «پنل املاک ترب»: sign-in → agency profile (first time) → sidebar layout around the panel pages. */
export function AgencyShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const session = useSession("agency");
  if (!hydrated) return <Frame><div className="bg-muted m-6 h-96 animate-pulse rounded-2xl" /></Frame>;
  if (!session) return <Frame><Welcome /></Frame>;
  if (!session.agency) return <Frame><Onboarding session={session} /></Frame>;
  return <Panel session={session}>{children}</Panel>;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="bg-card border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Brand />
          <Link href="/" className="text-muted-foreground hover:text-foreground ms-auto text-xs">
            رفتن به ترب
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/agency" className="flex items-center gap-1.5">
      <TorobLogo className="size-8" />
      <span className="text-xl font-bold text-(--logo-color-1)">ترب</span>
      <span className="bg-foreground text-background rounded px-1.5 py-0.5 text-xs font-medium">املاک</span>
    </Link>
  );
}

const POINTS = [
  { icon: FileUp, title: "همهٔ فایل‌ها با یه آپلود", text: "فایل اکسلت رو بده یا متن آگهی رو بچسبون؛ ترب خودش فرم رو پر می‌کنه." },
  { icon: BarChart3, title: "ببین کی آگهی‌هات رو دیده", text: "بازدید، تماس و نشان‌شدن هر فایل، روزبه‌روز." },
  { icon: Sparkles, title: "قیمتت رو با بازار بسنج", text: "هر فایل کنار میانهٔ قیمت آگهی‌های واقعی همون محله." },
];

function Welcome() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:pt-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl leading-[1.4] font-bold md:text-4xl">پنل مشاورین املاک ترب</h1>
          <p className="text-muted-foreground max-w-[52ch] text-base leading-8">
            فایل‌هات جلوی کسایی می‌ره که دقیقاً دنبالشن. مشتری با زبان خودش می‌گرده، هوش مصنوعی ترب فایل مناسب رو نشونش می‌ده.
          </p>
        </div>
        <ul className="flex flex-col gap-4">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="bg-card grid size-10 shrink-0 place-items-center rounded-lg">
                <Icon className="text-primary size-5" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold">{title}</span>
                <span className="text-muted-foreground text-sm leading-6">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-card rounded-2xl p-5 sm:p-7">
        <OtpLogin role="agency" />
      </div>
    </div>
  );
}

function Onboarding({ session }: { session: Session }) {
  const [name, setName] = useState("");
  const [manager, setManager] = useState("");
  const [city, setCity] = useState("مشهد");
  const [license, setLicense] = useState("");
  const [tried, setTried] = useState(false);
  const errors = {
    name: name.trim().length < 2 ? "اسم املاک رو بنویس." : null,
    manager: manager.trim().length < 2 ? "اسم مدیر یا مشاور رو بنویس." : null,
    city: canonicalCity(city) ? null : "شهر رو از فهرست انتخاب کن.",
  };
  const ok = !errors.name && !errors.manager && !errors.city;
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">ثبت‌نام املاک</h1>
        <p className="text-muted-foreground text-sm">یه بار؛ اسم املاک روی فایل‌هات نشون داده می‌شه. شماره: {formatMobile(session.phone)}</p>
      </div>
      <form
        className="bg-card flex flex-col gap-4 rounded-2xl p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (ok) saveAgencyProfile({ name: name.trim(), manager: manager.trim(), city: canonicalCity(city)!, license: license.trim() || undefined });
        }}
      >
        <OnbField label="نام املاک" error={tried ? errors.name : null}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً املاک فلان" className={inputCls} aria-invalid={tried && !!errors.name} autoFocus />
        </OnbField>
        <OnbField label="نام مدیر / مشاور" error={tried ? errors.manager : null}>
          <input value={manager} onChange={(e) => setManager(e.target.value)} className={inputCls} aria-invalid={tried && !!errors.manager} />
        </OnbField>
        <div className="grid gap-4 sm:grid-cols-2">
          <OnbField label="شهر" error={tried ? errors.city : null}>
            <input list="agency-cities" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} aria-invalid={tried && !!errors.city} />
            <datalist id="agency-cities">
              {CITIES.map((c) => (
                <option key={c.fa} value={c.fa} />
              ))}
            </datalist>
          </OnbField>
          <OnbField label="شمارهٔ پروانهٔ کسب (اختیاری)">
            <input value={license} onChange={(e) => setLicense(e.target.value)} inputMode="numeric" className={inputCls} />
          </OnbField>
        </div>
        <Button type="submit" size="lg" className="h-11 text-sm font-bold">
          <Building2 />
          ورود به پنل
        </Button>
      </form>
    </div>
  );
}

function OnbField({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
      {error && <span className="text-destructive text-xs">{error}</span>}
    </label>
  );
}

function Panel({ session, children }: { session: Session; children: React.ReactNode }) {
  const path = usePathname();
  const agency = session.agency!;
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="bg-card sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Brand />
          <span className="text-muted-foreground hidden truncate text-sm sm:inline">· {agency.name}</span>
          <Link href="/ads" className="text-muted-foreground hover:text-foreground ms-auto flex items-center gap-1 text-xs">
            <ExternalLink className="size-3.5" />
            دیدن سایت
          </Link>
          <button type="button" onClick={() => signOut("agency")} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs">
            <LogOut className="size-3.5" />
            خروج
          </button>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="flex flex-col gap-3 md:sticky md:top-20 md:self-start">
          <div className="bg-card hidden flex-col gap-0.5 rounded-lg p-4 md:flex">
            <span className="text-sm font-bold">{agency.name}</span>
            <span className="text-muted-foreground text-xs">
              {agency.manager} · {agency.city}
            </span>
          </div>
          <nav className="bg-card no-scrollbar flex gap-1 overflow-x-auto rounded-2xl p-1.5 sm:rounded-lg md:flex-col">
            {NAV.map(({ href, label, icon: Icon }) => {
              const on = href === "/agency" ? path === href : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    on ? "bg-foreground text-background font-medium" : "hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex min-w-0 flex-col gap-5">{children}</main>
      </div>
    </div>
  );
}
