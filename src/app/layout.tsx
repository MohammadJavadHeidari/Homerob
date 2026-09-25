import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
});

const TITLE = "هومراب — جستجوی هوشمند اجاره خانه در مشهد";
const DESCRIPTION =
  "نیازت رو به زبان خودت بنویس؛ هومراب با هوش مصنوعی آگهی‌های رهن و اجارهٔ مشهد رو می‌فهمه، قیمت‌ها رو هم‌تراز می‌کنه، رتبه‌بندی می‌کنه و می‌گه چرا.";

export const metadata: Metadata = {
  metadataBase: new URL("https://homerob.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "هومراب",
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: "هومراب",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "هومراب — جستجوی هوشمند رهن و اجاره در مشهد" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og.png"] },
};

export const viewport: Viewport = {
  themeColor: "#c8372d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={cn("h-full antialiased", vazirmatn.variable)}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
