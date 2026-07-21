import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function scoreTone(score?: number | null) {
  if (!score) return "text-slate-500 bg-slate-100 dark:bg-slate-800";
  if (score < 50) return "text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300";
  if (score < 70) return "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300";
  return "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300";
}
export const stages = ["saved", "applied", "phone_screen", "interview", "final", "offer", "rejected", "archived"] as const;
export type Stage = (typeof stages)[number];
export const stageLabel = (stage: string) => stage.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const formatMoney = (n?: number | null, currency = "GBP") => n ? new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n) : "—";
export const truncate = (value: string, max: number) => value.length > max ? `${value.slice(0, max)}…` : value;
