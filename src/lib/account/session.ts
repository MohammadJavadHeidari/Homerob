"use client";

import { createLocalStore } from "./local-store";

/**
 * Sign-in for the prototype panels. Divar/Torob-style: mobile number → one-time code. There is no SMS service
 * (paid, new account), so the code is shown on screen as a simulated SMS. Two independent sessions on one
 * device: a customer («کاربر») and an agency («املاک»), so the demo can switch sides without signing out.
 */
export type Role = "user" | "agency";

export interface AgencyProfile {
  /** «املاک …» */
  name: string;
  manager: string;
  city: string;
  /** Business licence number (پروانه کسب), optional. */
  license?: string;
}

export interface Session {
  phone: string;
  role: Role;
  since: number;
  /** Agencies only, filled in on first sign-in. */
  agency?: AgencyProfile;
}

interface SessionState {
  user: Session | null;
  agency: Session | null;
}

const store = createLocalStore<SessionState>("homerob:session:v1", { user: null, agency: null }, (raw) => {
  const r = (raw ?? {}) as Partial<SessionState>;
  return { user: r.user ?? null, agency: r.agency ?? null };
});

export const useSessions = store.use;
export const useSession = (role: Role) => store.use()[role];
export const readSession = (role: Role) => store.read()[role];

export function signIn(role: Role, phone: string) {
  store.update((s) => {
    const prev = s[role];
    // the same number signing in again keeps its agency profile
    const keep = prev?.phone === phone ? prev : null;
    return { ...s, [role]: { phone, role, since: keep?.since ?? Date.now(), agency: keep?.agency } };
  });
}

export function saveAgencyProfile(profile: AgencyProfile) {
  store.update((s) => (s.agency ? { ...s, agency: { ...s.agency, agency: profile } } : s));
}

export function signOut(role: Role) {
  store.update((s) => ({ ...s, [role]: null }));
}

// ---------- phone + one-time code (pure) ----------

/** Iranian mobile in any common form (۰۹۱۲…, +98912…, 912…) → "09121234567", else null. */
export function normalizeMobile(input: string): string | null {
  const digits = input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\D/g, "");
  const local = digits.replace(/^(0098|98)/, "").replace(/^0/, "");
  return /^9\d{9}$/.test(local) ? `0${local}` : null;
}

/** "09121234567" → "۰۹۱۲ ۱۲۳ ۴۵۶۷" for display. */
export function formatMobile(phone: string): string {
  const fa = phone.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  return `${fa.slice(0, 4)} ${fa.slice(4, 7)} ${fa.slice(7)}`;
}

/** A fresh 5-digit code (Divar/Torob send 5–6 digits). */
export function newOtp(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}
