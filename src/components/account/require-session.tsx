"use client";

import { OtpLogin } from "@/components/account/otp-login";
import { useHydrated } from "@/lib/account/local-store";
import { useSession, type Role, type Session } from "@/lib/account/session";

/** Shows the sign-in card until there is a session for `role`, then renders the page with it. */
export function RequireSession({
  role,
  intro,
  children,
}: {
  role: Role;
  /** A line above the sign-in card saying why («برای ثبت آگهی وارد شو»). */
  intro?: React.ReactNode;
  children: (session: Session) => React.ReactNode;
}) {
  const hydrated = useHydrated();
  const session = useSession(role);
  if (!hydrated) return <div className="bg-muted mx-auto h-80 w-full max-w-md animate-pulse rounded-2xl" />;
  if (!session)
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-6">
        {intro}
        <div className="bg-card rounded-2xl p-5 sm:p-6">
          <OtpLogin role={role} />
        </div>
      </div>
    );
  return <>{children(session)}</>;
}
