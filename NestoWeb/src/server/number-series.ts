import { db } from "@/lib/db";

// PRD_2 §6.2 — centralized, atomic, per-tenant identifier generation.
// Each entity type has a fixed prefix/sequence-length/year-inclusion config;
// allocation is a single upsert+increment so concurrent requests never
// receive the same human-readable number (AC-06).
const SERIES_CONFIG: Record<string, { prefix: string; seqLength: number; includeYear: boolean }> = {
  PROJECT: { prefix: "PRJ", seqLength: 6, includeYear: true },
  TASK: { prefix: "TSK", seqLength: 7, includeYear: false },
  CONTRACT: { prefix: "CON", seqLength: 5, includeYear: true },
  CONTRACTOR: { prefix: "CTR", seqLength: 6, includeYear: false },
  MEETING: { prefix: "MOM", seqLength: 5, includeYear: true },
  RFI: { prefix: "RFI", seqLength: 5, includeYear: true },
  EXPENSE: { prefix: "EXP", seqLength: 6, includeYear: true },
  DOCUMENT: { prefix: "DOC", seqLength: 6, includeYear: true },
  ASSET: { prefix: "AST", seqLength: 5, includeYear: false },
  ASSET_WORK_ORDER: { prefix: "AWO", seqLength: 6, includeYear: true },
  ASSET_TRANSFER: { prefix: "ATR", seqLength: 6, includeYear: true },
  SUPPLIER: { prefix: "SUP", seqLength: 6, includeYear: false },
  PURCHASE_REQUEST: { prefix: "PR", seqLength: 6, includeYear: true },
  PROCUREMENT_PACKAGE: { prefix: "PKG", seqLength: 5, includeYear: true },
  PROCUREMENT_RFQ: { prefix: "RFQ", seqLength: 5, includeYear: true },
  SUPPLIER_QUOTATION: { prefix: "QUO", seqLength: 5, includeYear: true },
  PURCHASE_ORDER: { prefix: "PO", seqLength: 5, includeYear: true },
  PROCUREMENT_DELIVERY: { prefix: "DEL", seqLength: 5, includeYear: true },
  WORK_PACKAGE: { prefix: "WP", seqLength: 6, includeYear: false },
  WORK_PROGRESS_UPDATE: { prefix: "WPU", seqLength: 6, includeYear: true },
  DAILY_SITE_REPORT: { prefix: "DSR", seqLength: 5, includeYear: true },
  WORK_CONSTRAINT: { prefix: "CNS", seqLength: 5, includeYear: true },
  WORK_DELAY: { prefix: "DLY", seqLength: 5, includeYear: true },
  MEASUREMENT_SHEET: { prefix: "MS", seqLength: 5, includeYear: true },
  PAYMENT: { prefix: "PAY", seqLength: 6, includeYear: true },
  HSE_INSPECTION: { prefix: "INS", seqLength: 5, includeYear: true },
  HSE_OBSERVATION: { prefix: "OBS", seqLength: 5, includeYear: true },
  HSE_INCIDENT: { prefix: "INC", seqLength: 5, includeYear: true },
  IT_TICKET: { prefix: "ITK", seqLength: 5, includeYear: true },
};

export async function allocateNumber(tenantId: string, entityType: keyof typeof SERIES_CONFIG): Promise<string> {
  const config = SERIES_CONFIG[entityType];
  if (!config) {
    throw new Error(`No NumberSeries config for entity type "${entityType}"`);
  }

  const sequence = await db.$transaction(async (tx) => {
    const existing = await tx.numberSeries.findUnique({
      where: { tenantId_entityType: { tenantId, entityType } },
    });

    if (!existing) {
      await tx.numberSeries.create({
        data: { tenantId, entityType, prefix: config.prefix, nextValue: 2 },
      });
      return 1;
    }

    await tx.numberSeries.update({
      where: { id: existing.id },
      data: { nextValue: { increment: 1 } },
    });
    return existing.nextValue;
  });

  const seq = String(sequence).padStart(config.seqLength, "0");
  return config.includeYear ? `${config.prefix}-${new Date().getFullYear()}-${seq}` : `${config.prefix}-${seq}`;
}
