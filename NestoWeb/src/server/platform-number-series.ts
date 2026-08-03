import { db } from "@/lib/db";

const SERIES_CONFIG: Record<string, { prefix: string; seqLength: number; includeYear: boolean }> = {
  APPLICATION: { prefix: "APP", seqLength: 6, includeYear: true },
  PROFILE: { prefix: "PRO", seqLength: 6, includeYear: false },
};

// Same atomic allocate-and-increment pattern as server/number-series.ts, just
// without a tenantId — PRD_6 public accounts have no tenant to scope under.
export async function allocatePlatformNumber(entityType: keyof typeof SERIES_CONFIG): Promise<string> {
  const config = SERIES_CONFIG[entityType];

  return db.$transaction(async (tx) => {
    const existing = await tx.platformNumberSeries.findUnique({ where: { entityType } });
    const sequence = existing ? existing.nextValue : 1;

    if (existing) {
      await tx.platformNumberSeries.update({ where: { id: existing.id }, data: { nextValue: { increment: 1 } } });
    } else {
      await tx.platformNumberSeries.create({ data: { entityType, prefix: config.prefix, nextValue: 2 } });
    }

    const seq = String(sequence).padStart(config.seqLength, "0");
    return config.includeYear ? `${config.prefix}-${new Date().getFullYear()}-${seq}` : `${config.prefix}-${seq}`;
  });
}
