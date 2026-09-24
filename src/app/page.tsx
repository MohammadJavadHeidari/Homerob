import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";

const examples = [
  "یه آپارتمان دوخوابه نزدیک وکیل‌آباد با ۵۰۰ میلیون رهن",
  "سوئیت یا یک‌خوابه تو سجاد، ماهی حداکثر ۸ میلیون",
  "خونه پارکینگ‌دار در احمدآباد برای خانواده سه نفره",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="space-y-3 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          هومراب
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg">
          ترب، ولی برای خونه — آگهی‌های رهن و اجاره مشهد، با جستجوی هوشمند
        </p>
      </div>

      <form className="flex w-full flex-col gap-2 sm:flex-row">
        <input
          type="text"
          placeholder="نیازت رو به زبان خودت بنویس…"
          className="border-input focus-visible:ring-ring/50 h-12 w-full rounded-lg border bg-transparent px-4 text-base outline-none focus-visible:ring-3 sm:flex-1"
        />
        <Button type="button" size="lg" className="h-12 px-6">
          <Search />
          جستجو
        </Button>
      </form>

      <ul className="flex flex-wrap justify-center gap-2">
        {examples.map((q) => (
          <li
            key={q}
            className="bg-muted text-muted-foreground rounded-full px-3 py-1.5 text-sm"
          >
            {q}
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-xs">
        نسخه نمایشی — به‌زودی
      </p>
    </main>
  );
}
