import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const numberFormatter = new Intl.NumberFormat("de-DE"); // European format: 1.000,50

export function formatNumber(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatCurrency(value: number, currency = "EUR") {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

// Salary-specific format: EUR shows 2 decimals with a symbol prefix
// (€1,500.00), ALL shows no decimals with a suffix (73,000 ALL) — per the
// exact display spec for Salary History, distinct from formatCurrency's
// de-DE style used elsewhere (invoices, budgets) to avoid regressing those.
export function formatSalaryAmount(value: number, currency: "EUR" | "ALL") {
  const digits = currency === "EUR" ? 2 : 0;
  const n = value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return currency === "EUR" ? `€${n}` : `${n} ALL`;
}

export function formatDate(value: Date | string, opts?: Intl.DateTimeFormatOptions) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...opts,
  }).format(date);
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export { numberFormatter };
