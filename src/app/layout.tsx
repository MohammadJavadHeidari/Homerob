import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "هومراب — جستجوی هوشمند اجاره خانه در مشهد",
  description:
    "نیازت رو به زبان خودت بنویس؛ هومراب آگهی‌های رهن و اجاره مشهد رو برات پیدا و مقایسه می‌کنه.",
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
