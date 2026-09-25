"use client";

import { Check, Minus } from "lucide-react";
import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SearchResult } from "@/lib/api-types";
import { ageFa, roomsFa } from "@/lib/format";
import { formatToman, toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

type Better = "low" | "high";

interface Row {
  label: string;
  /** Text shown in the cell. */
  show: (r: SearchResult) => React.ReactNode;
  /** Comparable key; rows where all keys are equal are "the same". */
  key: (r: SearchResult) => string | number;
  /** If set, the best numeric key in the row is highlighted. */
  better?: Better;
}

const yesNo = (v: boolean) =>
  v ? <Check className="text-success mx-auto size-4" /> : <Minus className="text-muted-foreground mx-auto size-4" />;

const ROWS: Row[] = [
  { label: "تطابق با نیازت", show: (r) => `${toFaDigits(r.score)}٪`, key: (r) => r.score, better: "high" },
  { label: "محله", show: (r) => r.listing.neighborhood, key: (r) => r.listing.neighborhood },
  { label: "رهن", show: (r) => formatToman(r.listing.deposit), key: (r) => r.listing.deposit, better: "low" },
  {
    label: "اجاره ماهانه",
    show: (r) => (r.listing.monthlyRent ? formatToman(r.listing.monthlyRent) : "رهن کامل"),
    key: (r) => r.listing.monthlyRent,
    better: "low",
  },
  {
    label: "با بودجهٔ تو",
    show: (r) =>
      r.budget.converted
        ? `${formatToman(Math.round(r.budget.deposit / 1e6) * 1e6)} + ${formatToman(Math.round(r.budget.monthlyRent / 5e5) * 5e5)}`
        : "همان قیمت آگهی",
    key: (r) => (r.budget.converted ? `${r.budget.deposit}/${r.budget.monthlyRent}` : "same"),
  },
  { label: "معادل رهن کامل", show: (r) => formatToman(r.fullDeposit), key: (r) => r.fullDeposit, better: "low" },
  {
    label: "قیمت هر متر",
    show: (r) => formatToman(Math.round(r.fullDeposit / r.listing.areaM2)),
    key: (r) => Math.round(r.fullDeposit / r.listing.areaM2),
    better: "low",
  },
  { label: "متراژ", show: (r) => `${toFaDigits(r.listing.areaM2)} متر`, key: (r) => r.listing.areaM2, better: "high" },
  { label: "خواب", show: (r) => roomsFa(r.listing.rooms), key: (r) => r.listing.rooms },
  {
    label: "طبقه",
    show: (r) => `${r.listing.floor === 0 ? "همکف" : toFaDigits(r.listing.floor)} از ${toFaDigits(r.listing.totalFloors)}`,
    key: (r) => `${r.listing.floor}/${r.listing.totalFloors}`,
  },
  { label: "سن بنا", show: (r) => ageFa(r.listing.buildingAge), key: (r) => r.listing.buildingAge, better: "low" },
  { label: "پارکینگ", show: (r) => yesNo(r.listing.parking), key: (r) => Number(r.listing.parking), better: "high" },
  { label: "آسانسور", show: (r) => yesNo(r.listing.elevator), key: (r) => Number(r.listing.elevator), better: "high" },
  { label: "انباری", show: (r) => yesNo(r.listing.storage), key: (r) => Number(r.listing.storage), better: "high" },
  {
    label: "بالکن",
    show: (r) => yesNo(r.listing.tags.includes("بالکن")),
    key: (r) => Number(r.listing.tags.includes("بالکن")),
    better: "high",
  },
  {
    label: "نزدیک قطار شهری",
    show: (r) => yesNo(r.listing.tags.includes("نزدیک قطار شهری")),
    key: (r) => Number(r.listing.tags.includes("نزدیک قطار شهری")),
    better: "high",
  },
  { label: "قابل تبدیل", show: (r) => yesNo(r.listing.convertible), key: (r) => Number(r.listing.convertible), better: "high" },
];

export function CompareDialog({
  items,
  open,
  onOpenChange,
}: {
  items: SearchResult[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [onlyDiff, setOnlyDiff] = useState(true);
  const rows = ROWS.map((row) => {
    const keys = items.map(row.key);
    const differs = new Set(keys).size > 1;
    let best: (string | number) | null = null;
    if (row.better && differs) {
      const nums = keys as number[];
      best = row.better === "low" ? Math.min(...nums) : Math.max(...nums);
    }
    return { row, keys, differs, best };
  });
  const visible = onlyDiff ? rows.filter((r) => r.differs) : rows;
  const same = rows.length - rows.filter((r) => r.differs).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg">مقایسهٔ {toFaDigits(items.length)} آگهی</DialogTitle>
          <DialogDescription>
            {onlyDiff
              ? `فقط چیزهایی که فرق دارن؛ ${toFaDigits(same)} مورد مشابه پنهان شده.`
              : "همهٔ مشخصات، کنار هم."}{" "}
            <button type="button" onClick={() => setOnlyDiff(!onlyDiff)} className="text-primary font-medium underline-offset-4 hover:underline">
              {onlyDiff ? "همه رو نشون بده" : "فقط تفاوت‌ها"}
            </button>
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[480px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="bg-popover sticky start-0 w-28 p-2" />
                {items.map((r) => (
                  <th key={r.listing.id} className="p-2 text-start align-top font-bold leading-6">
                    <span className="line-clamp-2">{r.listing.title}</span>
                    <span className="text-muted-foreground block text-xs font-normal">
                      {r.listing.source === "divar" ? "دیوار" : "شیپور"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(({ row, keys, best }) => (
                <tr key={row.label}>
                  <th className="bg-popover text-muted-foreground sticky start-0 border-t p-2 text-start text-xs font-medium">
                    {row.label}
                  </th>
                  {items.map((r, i) => (
                    <td
                      key={r.listing.id}
                      className={cn(
                        "border-t p-2 text-center",
                        best !== null && keys[i] === best && "bg-success/10 text-success font-bold",
                      )}
                    >
                      {row.show(r)}
                    </td>
                  ))}
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={items.length + 1} className="text-muted-foreground p-6 text-center">
                    این آگهی‌ها در همهٔ مشخصات یکسان‌اند.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground text-xs">سبز = بهترین مقدار در هر ردیف (قیمت کمتر، متراژ بیشتر، بنای نوتر، امکانات بیشتر).</p>
      </DialogContent>
    </Dialog>
  );
}
