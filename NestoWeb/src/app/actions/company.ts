"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { updateCompanyProfile } from "@/server/company";

export async function updateCompanyProfileAction(formData: FormData) {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "FULL") || !company) {
    throw new Error("You do not have permission to update the company profile.");
  }

  const legalName = String(formData.get("legalName") ?? "").trim() || undefined;
  const countryCode = String(formData.get("countryCode") ?? "").trim() || undefined;

  await updateCompanyProfile(tenantId, company.id, { legalName, countryCode });
  revalidatePath("/company");
}
