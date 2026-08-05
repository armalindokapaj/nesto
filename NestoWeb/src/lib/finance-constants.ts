// PRD_Finance_Module — shared between server (src/server/finance-module.ts)
// and client components; deliberately carries no "server-only" import.

export const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// §7 — an account's normal balance side follows its type by accounting
// convention; used as the default when creating an account of a given type.
export const NORMAL_BALANCE_BY_TYPE: Record<AccountType, "DEBIT" | "CREDIT"> = {
  ASSET: "DEBIT",
  EXPENSE: "DEBIT",
  LIABILITY: "CREDIT",
  EQUITY: "CREDIT",
  REVENUE: "CREDIT",
};

export const JOURNAL_STATUSES = ["DRAFT", "APPROVED", "POSTED", "REVERSED"] as const;
export const FISCAL_PERIOD_STATUSES = ["OPEN", "SOFT_CLOSED", "CLOSED", "LOCKED"] as const;
