import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getPipelineBoard } from "@/server/crm-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PipelineBoard } from "@/components/clients/pipeline-board";
import { getT } from "@/lib/i18n/server";

export default async function PipelinePage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "CLIENTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "CLIENTS", "WRITE");

  const { stages } = await getPipelineBoard(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("clients.title")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("crm.pipelineTitle")}</CardTitle>
            <CardDescription>{t("crm.pipelineSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <PipelineBoard stages={stages} canWrite={canWrite} />
        </CardContent>
      </Card>
    </div>
  );
}
