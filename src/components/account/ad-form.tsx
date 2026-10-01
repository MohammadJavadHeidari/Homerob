"use client";

import { Check, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PHOTO_MAX, TAG_OPTIONS, validateDraft, type AdDraft, type DraftErrors } from "@/lib/account/ads";
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/categories";
import { formatToman, toEnDigits, toFaDigits } from "@/lib/persian";
import { CITIES, hoodsIn } from "@/lib/places";
import { cn } from "@/lib/utils";

/**
 * The ad form, shared by the customer's «ثبت آگهی» and the agency's single-file upload. Divar's field order:
 * category, photos, title, place, size, price, features, description. Labels above inputs, errors below.
 */
export function AdForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  busy,
  className,
}: {
  value: AdDraft;
  onChange: (d: AdDraft) => void;
  onSubmit: (d: AdDraft) => void;
  submitLabel: string;
  busy?: boolean;
  className?: string;
}) {
  const [errors, setErrors] = useState<DraftErrors>({});
  const [tried, setTried] = useState(false);
  const d = value;
  const info = CATEGORIES[d.category];
  const set = <K extends keyof AdDraft>(k: K, v: AdDraft[K]) => {
    const next = { ...d, [k]: v };
    onChange(next);
    if (tried) setErrors(validateDraft(next));
  };
  const hoodList = useId();
  const cityList = useId();

  return (
    <form
      noValidate
      className={cn("flex flex-col gap-6", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const errs = validateDraft(d);
        setErrors(errs);
        setTried(true);
        if (Object.keys(errs).length) {
          // bring the first problem into view
          requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
          return;
        }
        onSubmit(d);
      }}
    >
      <Section title="دسته‌بندی">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={d.category === k}
              onClick={() => set("category", k)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm transition-colors active:scale-[0.98]",
                d.category === k ? "bg-foreground text-background border-foreground font-medium" : "bg-secondary border-input hover:bg-muted",
              )}
            >
              {CATEGORIES[k].label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="عکس‌ها" hint={`تا ${toFaDigits(PHOTO_MAX)} عکس. عکس اول، عکس اصلی آگهیه.`}>
        <PhotoPicker images={d.images} onChange={(imgs) => set("images", imgs)} />
      </Section>

      <Section title="مشخصات">
        <Field label="عنوان آگهی" error={errors.title}>
          <input
            value={d.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={80}
            placeholder={`مثلاً «${info.types[0]} ۸۵ متری دوخوابه»`}
            aria-invalid={!!errors.title}
            className={inputCls}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="شهر" error={errors.city}>
            <input list={cityList} value={d.city} onChange={(e) => set("city", e.target.value)} aria-invalid={!!errors.city} className={inputCls} />
            <datalist id={cityList}>
              {CITIES.map((c) => (
                <option key={c.fa} value={c.fa} />
              ))}
            </datalist>
          </Field>
          <Field label="محله" error={errors.neighborhood}>
            <input
              list={hoodList}
              value={d.neighborhood}
              onChange={(e) => set("neighborhood", e.target.value)}
              placeholder="مثلاً وکیل‌آباد"
              aria-invalid={!!errors.neighborhood}
              className={inputCls}
            />
            <datalist id={hoodList}>
              {hoodsIn(d.city).map((h) => (
                <option key={h.name} value={h.name} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="آدرس تقریبی" hint="فقط خیابان یا نشانی کلی؛ پلاک لازم نیست.">
          <input value={d.street} onChange={(e) => set("street", e.target.value)} maxLength={80} placeholder="مثلاً وکیل‌آباد ۱۲" className={inputCls} />
        </Field>
        <div className={cn("grid gap-4", info.residential ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
          <Field label="متراژ (متر)" error={errors.areaM2}>
            <NumberInput value={d.areaM2} onChange={(v) => set("areaM2", v)} invalid={!!errors.areaM2} />
          </Field>
          {info.residential && (
            <Field label="اتاق خواب">
              <NumberInput value={d.rooms} onChange={(v) => set("rooms", v)} max={20} placeholder="۰ = سوئیت" />
            </Field>
          )}
          <Field label="طبقه">
            <NumberInput value={d.floor} onChange={(v) => set("floor", v)} max={99} placeholder="۰ = همکف" />
          </Field>
          <Field label="سن بنا (سال)">
            <NumberInput value={d.buildingAge} onChange={(v) => set("buildingAge", v)} max={99} placeholder="۰ = نوساز" />
          </Field>
        </div>
      </Section>

      <Section title="قیمت" hint="به تومان.">
        {info.priceModel === "rent" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="رهن (ودیعه)" error={errors.deposit}>
                <MoneyInput value={d.deposit} onChange={(v) => set("deposit", v)} invalid={!!errors.deposit} />
              </Field>
              <Field label="اجارهٔ ماهانه" hint="رهن کامل؟ خالی بذار.">
                <MoneyInput value={d.monthlyRent} onChange={(v) => set("monthlyRent", v)} />
              </Field>
            </div>
            <Toggle checked={d.convertible} onChange={(v) => set("convertible", v)} label="رهن و اجاره قابل تبدیله" />
          </>
        )}
        {info.priceModel === "sale" && (
          <Field label="قیمت کل" error={errors.price}>
            <MoneyInput value={d.price} onChange={(v) => set("price", v)} invalid={!!errors.price} />
          </Field>
        )}
        {info.priceModel === "nightly" && (
          <Field label="قیمت هر شب" error={errors.nightlyPrice}>
            <MoneyInput value={d.nightlyPrice} onChange={(v) => set("nightlyPrice", v)} invalid={!!errors.nightlyPrice} />
          </Field>
        )}
      </Section>

      <Section title="امکانات">
        <div className="flex flex-wrap gap-2">
          <Toggle chip checked={d.elevator} onChange={(v) => set("elevator", v)} label="آسانسور" />
          <Toggle chip checked={d.parking} onChange={(v) => set("parking", v)} label="پارکینگ" />
          <Toggle chip checked={d.storage} onChange={(v) => set("storage", v)} label="انباری" />
          {TAG_OPTIONS.map((t) => (
            <Toggle
              key={t}
              chip
              checked={d.tags.includes(t)}
              onChange={(on) => set("tags", on ? [...d.tags, t] : d.tags.filter((x) => x !== t))}
              label={t}
            />
          ))}
        </div>
      </Section>

      <Section title="توضیحات">
        <textarea
          value={d.description}
          onChange={(e) => set("description", e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="جزئیاتی که خریدار یا مستأجر باید بدونه: نورگیری، وضعیت کابینت و کف، شرایط قرارداد…"
          className={cn(inputCls, "h-auto py-3 leading-7")}
        />
      </Section>

      <div className="bg-card/95 sticky bottom-0 -mx-4 flex items-center gap-3 border-t px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        {tried && Object.keys(errors).length > 0 && (
          <p className="text-destructive flex-1 text-xs">{toFaDigits(Object.keys(errors).length)} مورد نیاز به اصلاح داره.</p>
        )}
        <Button type="submit" size="lg" className="ms-auto h-11 min-w-40 px-6 text-sm font-bold" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Check />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export const inputCls =
  "border-input bg-secondary focus-visible:border-ring focus-visible:ring-ring/40 aria-invalid:border-destructive h-11 w-full rounded-lg border px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-bold">{title}</h3>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
      {error ? <span className="text-destructive text-xs">{error}</span> : hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
    </label>
  );
}

const parseDigits = (s: string) => {
  const t = toEnDigits(s).replace(/\D/g, "");
  return t ? Number(t) : null;
};

function NumberInput({
  value,
  onChange,
  invalid,
  max = 100_000,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  invalid?: boolean;
  max?: number;
  placeholder?: string;
}) {
  return (
    <input
      inputMode="numeric"
      value={value === null ? "" : toFaDigits(value)}
      onChange={(e) => {
        const n = parseDigits(e.target.value);
        onChange(n === null ? null : Math.min(n, max));
      }}
      placeholder={placeholder}
      aria-invalid={invalid}
      className={inputCls}
    />
  );
}

/** Toman with live thousands separators, and the short reading under it («۵۰۰ میلیون»). */
function MoneyInput({ value, onChange, invalid }: { value: number | null; onChange: (v: number | null) => void; invalid?: boolean }) {
  return (
    <span className="flex flex-col gap-1">
      <span className="relative">
        <input
          inputMode="numeric"
          dir="ltr"
          value={value === null ? "" : new Intl.NumberFormat("fa-IR").format(value)}
          onChange={(e) => {
            const n = parseDigits(e.target.value);
            onChange(n === null ? null : Math.min(n, 1e13));
          }}
          placeholder="۰"
          aria-invalid={invalid}
          className={cn(inputCls, "pe-14 text-end")}
        />
        <span className="text-muted-foreground pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs">تومان</span>
      </span>
      {value ? <span className="text-foreground text-xs font-medium">{formatToman(value)} تومان</span> : null}
    </span>
  );
}

function Toggle({ checked, onChange, label, chip }: { checked: boolean; onChange: (v: boolean) => void; label: string; chip?: boolean }) {
  if (chip)
    return (
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors active:scale-[0.98]",
          checked ? "bg-foreground text-background border-foreground" : "bg-secondary border-input hover:bg-muted",
        )}
      >
        {checked && <Check className="size-3.5" />}
        {label}
      </button>
    );
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-foreground size-4" />
      {label}
    </label>
  );
}

// ---------- photos ----------

/** Resize to ≤ 960px and re-encode as JPEG (~60–120 KB) so a few ads fit in localStorage. */
async function compress(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 960 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PhotoPicker({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const room = PHOTO_MAX - images.length;
      const picked = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
      const out = await Promise.all(picked.map(compress));
      onChange([...images, ...out]);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div
      className="grid grid-cols-3 gap-2 sm:grid-cols-5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void add(e.dataTransfer.files);
      }}
    >
      {images.map((src, i) => (
        <div key={i} className="group bg-muted relative aspect-square overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          <img src={src} alt={`عکس ${toFaDigits(i + 1)}`} className="size-full object-cover" />
          {i === 0 && <span className="bg-foreground/80 text-background absolute start-1.5 bottom-1.5 rounded px-1.5 py-0.5 text-[10px]">عکس اصلی</span>}
          <button
            type="button"
            aria-label="حذف عکس"
            onClick={() => onChange(images.filter((_, j) => j !== i))}
            className="bg-card/90 absolute end-1.5 top-1.5 grid size-7 place-items-center rounded-full shadow-xs"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {images.length < PHOTO_MAX && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="border-input text-muted-foreground hover:border-foreground/40 hover:text-foreground flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs transition-colors"
        >
          {busy ? <LoaderCircle className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          افزودن عکس
        </button>
      )}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void add(e.target.files)} />
    </div>
  );
}
