"use client";

import { CircleAlert, CircleCheck, ClipboardPaste, Download, FileSpreadsheet, FileUp, PencilLine, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AdForm } from "@/components/account/ad-form";
import { AiFill } from "@/components/account/ai-fill";
import { useAgency } from "@/components/agency/use-agency";
import { Button } from "@/components/ui/button";
import { adToDraft, draftToAd, EMPTY_DRAFT, type AdDraft, type PostedAd } from "@/lib/account/ads";
import { addAds, readPostedAds, updateAd } from "@/lib/account/ads-store";
import { importTable, templateCsv, type ImportResult } from "@/lib/account/import-file";
import { CATEGORIES } from "@/lib/categories";
import { priceLineFa } from "@/lib/format";
import { toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

type Tab = "file" | "ai" | "form";

const TABS: { key: Tab; label: string; icon: typeof FileUp }[] = [
  { key: "file", label: "فایل اکسل", icon: FileSpreadsheet },
  { key: "ai", label: "متن آگهی", icon: Sparkles },
  { key: "form", label: "فرم تکی", icon: PencilLine },
];

/** «آپلود فایل»: many files at once from Excel/CSV, one from pasted text (AI), or one by hand. */
export function UploadFiles() {
  const { session } = useAgency();
  const agency = session!.agency!;
  const owner = { role: "agency" as const, phone: session!.phone, name: agency.name };
  const [tab, setTab] = useState<Tab>("file");
  const [draft, setDraft] = useState<AdDraft>({ ...EMPTY_DRAFT, city: agency.city });
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<PostedAd | null>(null);
  const [published, setPublished] = useState<PostedAd[] | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    const ad = id ? readPostedAds().find((a) => a.id === id && a.ownerPhone === session!.phone) : undefined;
    if (ad) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- load the file being edited once, from the URL
      setEditing(ad);
      setDraft(adToDraft(ad));
      setTab("form");
    }
  }, [session]);

  const publish = (ads: PostedAd[]) => {
    addAds(ads);
    setPublished(ads);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openInForm = (d: AdDraft) => {
    setDraft(d);
    setFormKey((k) => k + 1);
    setTab("form");
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{editing ? "ویرایش فایل" : "آپلود فایل"}</h1>
        <p className="text-muted-foreground text-sm">فایل‌هات به اسم «{agency.name}» منتشر می‌شن و تو جستجوی هوشمند ترب دیده می‌شن.</p>
      </div>

      {published && (
        <div className="bg-success/10 text-success flex flex-wrap items-center gap-3 rounded-lg p-3 text-sm">
          <CircleCheck className="size-5" />
          <span className="flex-1 font-medium">{toFaDigits(published.length)} فایل منتشر شد.</span>
          <Link href="/agency/files" className="font-bold underline-offset-4 hover:underline">
            دیدن فایل‌ها
          </Link>
          <Link href="/agency" className="font-bold underline-offset-4 hover:underline">
            داشبورد
          </Link>
        </div>
      )}

      {!editing && (
        <div className="bg-card flex gap-1 rounded-2xl p-1.5 sm:w-fit sm:rounded-lg">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors sm:flex-none",
                tab === key ? "bg-foreground text-background font-medium" : "hover:bg-muted",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "file" && !editing && (
        <FileImport
          city={agency.city}
          onPublish={(drafts) => publish(drafts.map((d) => draftToAd(d, owner, "file")))}
          onEditRow={openInForm}
        />
      )}

      {tab === "ai" && !editing && (
        <AiFill
          city={agency.city}
          onDraft={(d) => {
            openInForm(d);
          }}
        />
      )}

      {tab === "form" && (
        <div className="bg-card rounded-2xl p-4 sm:rounded-lg sm:p-6">
          <AdForm
            key={formKey}
            value={draft}
            onChange={setDraft}
            submitLabel={editing ? "ذخیرهٔ تغییرات" : "انتشار فایل"}
            onSubmit={(d) => {
              if (editing) {
                updateAd(draftToAd(d, owner, editing.via, editing));
                setPublished([editing]);
                window.scrollTo({ top: 0, behavior: "smooth" });
                return;
              }
              publish([draftToAd(d, owner, "form")]);
              setDraft({ ...EMPTY_DRAFT, city: agency.city });
              setFormKey((k) => k + 1);
            }}
          />
        </div>
      )}
    </>
  );
}

function FileImport({ city, onPublish, onEditRow }: { city: string; onPublish: (d: AdDraft[]) => void; onEditRow: (d: AdDraft) => void }) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const read = async (file: File | undefined) => {
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      setFileName(file.name);
      setResult({ rows: [], found: [], unknown: ["xlsx"] });
      return;
    }
    setFileName(file.name);
    setResult(importTable(await file.text(), { city }));
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([templateCsv()], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "torob-amlak-template.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };

  const xlsx = result?.unknown[0] === "xlsx" && !result.found.length;
  const valid = result?.rows.filter((r) => !Object.keys(r.errors).length) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void read(e.dataTransfer.files[0]);
          }}
          className={cn(
            "bg-card border-input hover:border-foreground/40 flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:rounded-lg",
            dragging && "border-primary bg-brand-soft",
          )}
        >
          <FileUp className="text-muted-foreground size-8" />
          <span className="text-sm font-bold">فایل CSV رو اینجا بکش یا بزن تا انتخاب کنی</span>
          <span className="text-muted-foreground text-xs leading-5">از اکسل: File ← Save As ← CSV UTF-8. هر ردیف یه فایل.</span>
          {fileName && <span className="bg-muted mt-1 rounded px-2 py-0.5 text-xs">{fileName}</span>}
        </button>
        <div className="bg-card flex flex-col gap-2 rounded-2xl p-4 sm:rounded-lg">
          <span className="flex items-center gap-1.5 text-sm font-bold">
            <ClipboardPaste className="text-muted-foreground size-4" />
            یا از اکسل کپی کن و اینجا بچسبون
          </span>
          <textarea
            value={paste}
            onChange={(e) => {
              setPaste(e.target.value);
              setFileName(null);
              setResult(e.target.value.trim() ? importTable(e.target.value, { city }) : null);
            }}
            rows={5}
            dir="auto"
            placeholder="ردیف اول: سرستون‌ها (عنوان، محله، متراژ، رهن، اجاره، …)"
            aria-label="خانه‌های کپی‌شده از اکسل"
            className="border-input bg-secondary focus-visible:border-ring focus-visible:ring-ring/40 min-h-28 w-full flex-1 rounded-lg border px-3 py-2 font-mono text-xs leading-6 outline-none focus-visible:ring-3"
          />
        </div>
      </div>
      <input ref={input} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv" hidden onChange={(e) => void read(e.target.files?.[0])} />

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <button type="button" onClick={downloadTemplate} className="text-primary flex items-center gap-1 font-medium">
          <Download className="size-3.5" />
          دانلود فایل نمونه (فقط سرستون‌ها)
        </button>
        <span>ستون‌ها با اسم پیدا می‌شن، ترتیب مهم نیست. «۵۰۰» یعنی ۵۰۰ میلیون.</span>
      </div>

      {xlsx && (
        <p className="bg-warning/10 text-warning flex items-start gap-2 rounded-lg p-3 text-sm leading-6">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          فایل اکسل (xlsx) رو مستقیم نمی‌خونیم. تو اکسل «Save As ← CSV UTF-8» بزن، یا خونه‌ها رو کپی کن و بالا بچسبون.
        </p>
      )}

      {result && !xlsx && (
        <section className="bg-card flex flex-col rounded-2xl sm:rounded-lg">
          <div className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
            <div className="flex flex-1 flex-col gap-0.5">
              <h2 className="text-sm font-bold">
                {toFaDigits(result.rows.length)} ردیف خونده شد، {toFaDigits(valid.length)} تا آماده‌ی انتشار
              </h2>
              <p className="text-muted-foreground text-xs">
                ستون‌های پیداشده: {result.found.length ? result.found.join("، ") : "هیچ‌کدوم"}
                {result.unknown.length > 0 && ` · نادیده: ${result.unknown.join("، ")}`}
              </p>
            </div>
            <Button size="lg" className="h-10 px-5 font-bold" disabled={!valid.length} onClick={() => onPublish(valid.map((r) => r.draft))}>
              <CircleCheck />
              انتشار {toFaDigits(valid.length)} فایل
            </Button>
          </div>
          <ul className="flex flex-col">
            {result.rows.map((r) => {
              const errs = Object.values(r.errors);
              const preview = draftToAd(r.draft, { role: "agency", phone: "", name: "" }, "file");
              return (
                <li key={r.line} className="flex items-start gap-3 border-t px-4 py-3 text-sm sm:px-5">
                  {errs.length ? <CircleAlert className="text-warning mt-0.5 size-4 shrink-0" /> : <CircleCheck className="text-success mt-0.5 size-4 shrink-0" />}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-bold">{r.draft.title || <span className="text-muted-foreground">بدون عنوان</span>}</span>
                    <span className="text-muted-foreground text-xs">
                      ردیف {toFaDigits(r.line)} · {CATEGORIES[r.draft.category].label} · {r.draft.neighborhood || "محله؟"}، {r.draft.city}
                      {r.draft.areaM2 ? ` · ${toFaDigits(r.draft.areaM2)} متر` : ""}
                      {!errs.length && ` · ${priceLineFa(preview)}`}
                    </span>
                    {errs.length > 0 && <span className="text-warning text-xs">{errs.join(" ")}</span>}
                  </div>
                  <button type="button" onClick={() => onEditRow(r.draft)} className="text-primary shrink-0 text-xs font-medium">
                    {errs.length ? "اصلاح" : "ویرایش"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!result && (
        <p className="text-muted-foreground text-xs leading-6">
          فایل نداری؟ از تب «متن آگهی» متن یه فایل رو بچسبون، یا «فرم تکی» رو پر کن.
        </p>
      )}
    </div>
  );
}
