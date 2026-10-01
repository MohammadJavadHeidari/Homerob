"use client";

import { ArrowRight, LoaderCircle, MessageSquareText, Smartphone } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { formatMobile, newOtp, normalizeMobile, signIn, type Role } from "@/lib/account/session";
import { toEnDigits, toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

const RESEND_SECONDS = 60;

/**
 * Torob/Divar sign-in: mobile number → 5-digit code. No SMS provider in the prototype, so the code arrives as an
 * on-screen "SMS" (clearly labeled) that fills itself in on tap. Copy follows torob.com's own login dialog.
 */
export function OtpLogin({ role, onDone, className }: { role: Role; onDone?: () => void; className?: string }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneText, setPhoneText] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const send = (to: string) => {
    setBusy(true);
    setError(null);
    // a short pause, like a real SMS gateway, so the step change reads as "sent"
    setTimeout(() => {
      setSent(newOtp());
      setPhone(to);
      setStep("code");
      setCode("");
      setLeft(RESEND_SECONDS);
      setBusy(false);
      requestAnimationFrame(() => codeRef.current?.focus());
    }, 600);
  };

  const submitPhone = () => {
    const p = normalizeMobile(phoneText);
    if (!p) return setError("شماره موبایل درست نیست. مثل ۰۹۱۲۳۴۵۶۷۸۹ بنویس.");
    send(p);
  };

  const verify = (value: string) => {
    if (value.length < 5) return;
    if (value !== sent) {
      setError("کد درست نیست. دوباره نگاه کن.");
      return;
    }
    setBusy(true);
    setTimeout(() => {
      signIn(role, phone);
      setSent("");
      onDone?.();
    }, 350);
  };

  const title = role === "agency" ? "ورود به پنل املاک ترب" : "ورود به ترب";

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <SmsToast code={step === "code" ? sent : ""} onUse={() => {
        setCode(sent);
        verify(sent);
      }} />
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-muted-foreground text-sm leading-6">
          {step === "phone" ? "شماره موبایل خود را وارد کنید" : <>کد ۵ رقمی فرستاده‌شده به {formatMobile(phone)} رو بنویس</>}
        </p>
      </div>

      {step === "phone" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitPhone();
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">شماره موبایل</span>
            <span className="relative">
              <Smartphone className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
              <input
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                value={phoneText}
                onChange={(e) => {
                  setPhoneText(e.target.value);
                  setError(null);
                }}
                placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
                aria-invalid={!!error}
                className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 aria-invalid:border-destructive h-12 w-full rounded-lg border ps-10 pe-3 text-end text-base tracking-wider outline-none focus-visible:ring-3"
              />
            </span>
          </label>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <Button type="submit" size="lg" className="h-11 text-sm font-bold" disabled={busy}>
            {busy && <LoaderCircle className="animate-spin" />}
            دریافت کد ورود پیامکی
          </Button>
          <p className="text-muted-foreground text-xs leading-5">
            با ورود، <span className="text-foreground">قوانین و حریم خصوصی ترب</span> رو می‌پذیری.
          </p>
        </form>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            verify(code);
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">کد تأیید</span>
            <input
              ref={codeRef}
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={5}
              value={toFaDigits(code)}
              onChange={(e) => {
                const v = toEnDigits(e.target.value).replace(/\D/g, "").slice(0, 5);
                setCode(v);
                setError(null);
                if (v.length === 5) verify(v);
              }}
              placeholder="- - - - -"
              aria-invalid={!!error}
              className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 aria-invalid:border-destructive h-12 w-full rounded-lg border px-3 text-center text-xl font-bold tracking-[0.6em] outline-none focus-visible:ring-3"
            />
          </label>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <Button type="submit" size="lg" className="h-11 text-sm font-bold" disabled={busy || code.length < 5}>
            {busy && <LoaderCircle className="animate-spin" />}
            ورود
          </Button>
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <button type="button" className="hover:text-foreground flex items-center gap-1" onClick={() => setStep("phone")}>
              <ArrowRight className="size-3.5" />
              تغییر شماره
            </button>
            {left > 0 ? (
              <span>ارسال دوباره تا {toFaDigits(left)} ثانیه</span>
            ) : (
              <button type="button" className="text-primary font-medium" onClick={() => send(phone)}>
                ارسال دوبارهٔ کد
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

/** The simulated SMS: slides in from the top like a phone notification; tap fills the code. */
function SmsToast({ code, onUse }: { code: string; onUse: () => void }) {
  const reduce = useReducedMotion();
  // portal: a transformed parent (the login dialog) would otherwise trap `position: fixed`
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {code && (
        <motion.button
          type="button"
          onClick={onUse}
          initial={reduce ? false : { y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="bg-popover text-popover-foreground fixed inset-x-3 top-3 z-[60] mx-auto flex max-w-sm items-start gap-3 rounded-2xl p-3 text-start shadow-[0_12px_40px_-12px_rgb(15_23_43/0.35)] ring-1 ring-foreground/10"
        >
          <span className="bg-success/10 text-success grid size-9 shrink-0 place-items-center rounded-xl">
            <MessageSquareText className="size-5" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-muted-foreground flex items-center gap-2 text-[11px]">
              پیامک · ترب
              <span className="bg-muted rounded px-1.5 py-px">نمایشی</span>
            </span>
            <span className="text-sm leading-6">
              کد ورود شما به ترب: <b className="tracking-widest">{toFaDigits(code)}</b>
            </span>
            <span className="text-muted-foreground text-[11px]">پیامک واقعی فرستاده نمی‌شه. بزن تا کد پر بشه.</span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>,
    document.body,
  );
}
