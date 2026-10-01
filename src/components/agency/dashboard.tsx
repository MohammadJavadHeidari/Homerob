"use client";

import { ArrowLeft, Eye, FileUp, Lightbulb, MousePointerClick, Phone, TriangleAlert, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { ViewsChart, Sparkline, StatTile } from "@/components/agency/charts";
import { useAgency, useMarket } from "@/components/agency/use-agency";
import { buttonVariants } from "@/components/ui/button";
import { adInsights, contactRate, deltaFa, type Insight } from "@/lib/account/stats";
import { timeAgoFa } from "@/lib/format";
import { toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

const pct = (r: number | null) => (r === null ? "-" : `${toFaDigits(Math.round(r * 100))}٪`);

/**
 * Agency overview, 5 headline numbers then detail (product-analytics: executive layer first): views with a
 * week-over-week delta, contacts + contact rate, saves, times shown in results, active files. Then daily views,
 * the shown → opened → contacted funnel, per-file table with a sparkline and one concrete suggestion each.
 */
export function Dashboard() {
  const { session, ads, stats } = useAgency();
  const market = useMarket();
  const active = ads.filter((a) => a.status === "published");
  const rows = useMemo(
    () =>
      ads
        .map((a) => ({ ad: a, s: stats.byAd[a.id], insights: adInsights(a, stats.byAd[a.id], market(a)) }))
        .sort((x, y) => y.s.view - x.s.view || y.s.impression - x.s.impression),
    [ads, stats, market],
  );
  const tips = rows.flatMap((r) => r.insights.filter((i) => i.tone !== "info").map((i) => ({ ...i, ad: r.ad }))).slice(0, 4);
  const t = stats.totals;
  const name = session?.agency?.name ?? "";

  if (!ads.length)
    return (
      <>
        <Title name={name} />
        <div className="bg-card flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center sm:rounded-lg">
          <FileUp className="text-muted-foreground size-10" />
          <h2 className="font-bold">هنوز فایلی آپلود نکردی</h2>
          <p className="text-muted-foreground max-w-sm text-sm leading-6">
            فایل اکسلت رو آپلود کن یا متن یه آگهی رو بچسبون. بعد از انتشار، بازدید و تماس هر فایل اینجا میاد.
          </p>
          <Link href="/agency/upload" className={buttonVariants({ size: "lg", className: "h-10 px-5 font-bold" })}>
            <FileUp />
            آپلود فایل‌ها
          </Link>
        </div>
      </>
    );

  return (
    <>
      <Title name={name} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="بازدید ۷ روز اخیر" value={stats.last7.view} delta={deltaFa(stats.last7.view, stats.prev7.view)} sub={`کل: ${toFaDigits(t.view)}`} />
        <StatTile label="تماس" value={t.contact} sub={`نرخ تماس ${pct(contactRate(t))}`} />
        <StatTile label="نشان‌شده" value={t.save} />
        <StatTile label="دیده‌شدن در نتایج" value={t.impression} sub="در فهرست و جستجو" />
        <StatTile label="فایل فعال" value={active.length} sub={`از ${toFaDigits(ads.length)} فایل`} className="col-span-2 lg:col-span-1" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section className="bg-card flex flex-col gap-3 rounded-2xl p-4 sm:rounded-lg sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold">بازدید روزانه</h2>
            <span className="text-muted-foreground text-xs">۱۴ روز اخیر</span>
          </div>
          <ViewsChart days={stats.days} views={stats.dailyViews} contacts={stats.dailyContacts} />
        </section>

        <section className="bg-card flex flex-col gap-4 rounded-2xl p-4 sm:rounded-lg sm:p-5">
          <h2 className="text-sm font-bold">از دیده‌شدن تا تماس</h2>
          <Funnel steps={[
            { icon: MousePointerClick, label: "دیده‌شدن در نتایج", value: t.impression },
            { icon: Eye, label: "باز کردن آگهی", value: t.view },
            { icon: Phone, label: "اطلاعات تماس", value: t.contact },
          ]} />
        </section>
      </div>

      {tips.length > 0 && (
        <section className="bg-card flex flex-col gap-3 rounded-2xl p-4 sm:rounded-lg sm:p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-bold">
            <Lightbulb className="text-primary size-4" />
            پیشنهادهای ترب
          </h2>
          <ul className="flex flex-col gap-2">
            {tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm leading-7">
                <InsightIcon tone={tip.tone} />
                <span>
                  <Link href={`/ads/${tip.ad.id}`} className="font-bold hover:underline">
                    {tip.ad.title}
                  </Link>
                  : {tip.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-card flex flex-col rounded-2xl sm:rounded-lg">
        <div className="flex items-baseline justify-between gap-2 p-4 pb-2 sm:px-5">
          <h2 className="text-sm font-bold">عملکرد فایل‌ها</h2>
          <Link href="/agency/files" className="text-primary flex items-center gap-1 text-xs font-medium">
            همهٔ فایل‌ها
            <ArrowLeft className="size-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-start [&>th]:font-medium">
                <th className="ps-5!">فایل</th>
                <th>۱۴ روز</th>
                <th>بازدید</th>
                <th>تماس</th>
                <th>نرخ تماس</th>
                <th>نشان</th>
                <th className="pe-5!">آخرین بازدید</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.slice(0, 8).map(({ ad, s, insights }) => (
                <tr key={ad.id} className="border-t align-top [&>td]:px-3 [&>td]:py-3">
                  <td className="ps-5! max-w-72">
                    <Link href={`/ads/${ad.id}`} className="line-clamp-1 font-bold hover:underline">
                      {ad.title}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {ad.neighborhood}، {ad.city}
                      {ad.status === "archived" && " · غیرفعال"}
                    </span>
                    {insights[0] && (
                      <span className={cn("mt-1 flex items-start gap-1 text-xs leading-5", toneText(insights[0].tone))}>
                        <InsightIcon tone={insights[0].tone} small />
                        {insights[0].text}
                      </span>
                    )}
                  </td>
                  <td>
                    <Sparkline values={s.daily} />
                  </td>
                  <td className="font-bold">{toFaDigits(s.view)}</td>
                  <td>{toFaDigits(s.contact)}</td>
                  <td>{pct(contactRate(s))}</td>
                  <td>{toFaDigits(s.save)}</td>
                  <td className="text-muted-foreground pe-5! text-xs whitespace-nowrap">{s.lastViewAt ? timeAgoFa(new Date(s.lastViewAt).toISOString()) : "هنوز نه"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground border-t px-5 py-3 text-xs leading-5">
          آمار از رفتار واقعی بازدیدکننده‌ها ثبت می‌شه (در این نسخهٔ نمایشی، روی همین دستگاه). مقایسهٔ قیمت با میانهٔ آگهی‌های واقعی همون محله‌ست.
        </p>
      </section>
    </>
  );
}

function Title({ name }: { name: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">داشبورد {name}</h1>
        <p className="text-muted-foreground text-sm">مشتری‌ها فایل‌هات رو چقدر دیدن و چند نفر تماس گرفتن.</p>
      </div>
      <Link href="/agency/upload" className={buttonVariants({ className: "h-9 px-4 font-bold" })}>
        <FileUp />
        آپلود فایل
      </Link>
    </div>
  );
}

function Funnel({ steps }: { steps: { icon: typeof Eye; label: string; value: number }[] }) {
  const top = Math.max(1, steps[0].value, ...steps.map((s) => s.value));
  return (
    <ol className="flex flex-col gap-3">
      {steps.map(({ icon: Icon, label, value }, i) => {
        const prev = i ? steps[i - 1].value : null;
        const rate = prev ? Math.min(1, value / prev) : null;
        return (
          <li key={label} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-sm">
              <Icon className="text-muted-foreground size-4" />
              <span className="flex-1">{label}</span>
              <b className="tabular-nums">{toFaDigits(value)}</b>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 rounded-full bg-slate-400 transition-[width] duration-500 dark:bg-slate-500" style={{ width: `${Math.max(2, (value / top) * 100)}%` }} />
              {rate !== null && <span className="text-muted-foreground shrink-0 text-[11px]">{pct(rate)} مرحلهٔ قبل</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const toneText = (tone: Insight["tone"]) => (tone === "warn" ? "text-warning" : tone === "good" ? "text-success" : "text-muted-foreground");

function InsightIcon({ tone, small }: { tone: Insight["tone"]; small?: boolean }) {
  const cls = cn(small ? "mt-0.5 size-3.5" : "mt-1.5 size-4", "shrink-0", toneText(tone));
  if (tone === "warn") return <TriangleAlert className={cls} />;
  if (tone === "good") return <TrendingDown className={cls} />;
  return <Lightbulb className={cls} />;
}
