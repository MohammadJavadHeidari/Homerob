import type { Metadata } from "next";

import { AgencyShell } from "@/components/agency/agency-shell";

export const metadata: Metadata = { title: "پنل املاک | ترب" };

export default function AgencyLayout({ children }: LayoutProps<"/agency">) {
  return <AgencyShell>{children}</AgencyShell>;
}
