import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Archive, ArchiveRestore } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getContractDetail } from "@/server/contracts";
import { archiveContractAction, restoreContractAction } from "@/app/actions/contracts-module";
import { listAllMembers } from "@/server/admin";
import { listModuleDocuments } from "@/server/documents-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ContractStarButton } from "@/components/contracts/contract-star-button";
import { ContractActions } from "@/components/contracts/contract-actions";
import { ContractPartyManager } from "@/components/contracts/contract-party-manager";
import { ContractObligations } from "@/components/contracts/contract-obligations";
import { ContractMilestones } from "@/components/contracts/contract-milestones";
import { ContractDetailsForm } from "@/components/contracts/contract-details-form";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const TIMELINE_LABELS: Record<string, string> = {
  PARTY_ADDED: "Party added",
  PARTY_REMOVED: "Party removed",
  OBLIGATION_ADDED: "Obligation added",
  OBLIGATION_STATUS_CHANGED: "Obligation status changed",
  MILESTONE_ADDED: "Milestone added",
  MILESTONE_STATUS_CHANGED: "Milestone status changed",
  ARCHIVED: "Archived",
  RESTORED: "Restored",
};

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "CONTRACTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "CONTRACTS", "WRITE");
  const canApprove = can(role, "CONTRACTS", "FULL");

  const [contract, members, documents] = await Promise.all([
    getContractDetail(tenantId, id, user.id),
    listAllMembers(tenantId),
    listModuleDocuments(tenantId, user.id, { linkEntityType: "CONTRACT", linkEntityId: id }),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/contracts" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("contracts.title")}
      </Link>

      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-start gap-2">
            <ContractStarButton contractId={contract.id} starred={contract.isStarred} size={17} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{contract.title}</CardTitle>
                <span className="font-mono text-xs text-ink-faint">{contract.number}</span>
                <Badge status={contract.status}>{t(`contracts.${contract.status.toLowerCase()}`)}</Badge>
                {contract.contractType && <Badge tone="neutral">{contract.contractType}</Badge>}
              </div>
              <CardDescription>
                {formatCurrency(contract.value, contract.currency)}
                {contract.project && (
                  <>
                    {" · "}
                    <Link href={`/projects/${contract.project.id}`} className="hover:text-gold hover:underline">
                      {contract.project.name}
                    </Link>
                  </>
                )}
                {contract.responsibleUser && (
                  <>
                    {" · "}
                    {t("contractsModule.responsibleUser")}: {contract.responsibleUser.displayName}
                  </>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canApprove && <ContractActions contractId={contract.id} status={contract.status} />}
          </div>
        </CardHeader>
        {canApprove && (
          <CardContent>
            <form action={contract.archivedAt ? restoreContractAction.bind(null, contract.id) : archiveContractAction.bind(null, contract.id)}>
              <Button size="sm" variant="secondary" type="submit">
                {contract.archivedAt ? (
                  <>
                    <ArchiveRestore size={14} /> {t("teamsModule.restore")}
                  </>
                ) : (
                  <>
                    <Archive size={14} /> {t("teamsModule.archive")}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("contractsModule.partiesTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ContractPartyManager contractId={contract.id} parties={contract.parties} canWrite={canWrite} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("contractsModule.obligationsTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ContractObligations contractId={contract.id} obligations={contract.obligations} canWrite={canWrite} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("contractsModule.milestonesTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ContractMilestones contractId={contract.id} milestones={contract.milestones} canWrite={canWrite} />
            </CardContent>
          </Card>

          {documents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("nav.documents")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {documents.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    className="block rounded-lg border border-border px-3 py-2 text-sm text-ink hover:text-gold hover:underline"
                  >
                    {doc.title}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {canWrite && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("contractsModule.contractDetails")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ContractDetailsForm
                  key={`${contract.contractType}-${contract.responsibleUserId}`}
                  contractId={contract.id}
                  contractType={contract.contractType}
                  responsibleUserId={contract.responsibleUserId}
                  members={members.map((m) => ({ id: m.user.id, displayName: m.user.displayName }))}
                />
              </CardContent>
            </Card>
          )}

          {contract.activity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("documents.activity")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5 text-xs text-ink-muted">
                  {contract.activity.map((event) => (
                    <li key={event.id} className="flex items-start gap-2">
                      {event.actor && <Avatar name={event.actor.displayName} color={event.actor.avatarColor ?? undefined} size={20} />}
                      <div className="min-w-0 flex-1">
                        <p className="text-ink">{TIMELINE_LABELS[event.eventType] ?? event.eventType}</p>
                        <p className="text-ink-faint">{event.summary}</p>
                        <p className="text-ink-faint">{formatDate(event.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
