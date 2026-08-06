import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getCollection, listModuleDocuments } from "@/server/documents-module";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AddToCollectionForm, RemoveFromCollectionButton } from "@/components/documents/collection-dialogs";
import { getT } from "@/lib/i18n/server";

export default async function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "READ")) redirect("/dashboard/executive");

  const detail = await getCollection(tenantId, id, user.id).catch(() => null);
  if (!detail) notFound();
  const { collection, items } = detail;
  const canManage = !collection.ownerId || collection.ownerId === user.id;

  const documents = canManage ? await listModuleDocuments(tenantId, user.id, { take: 200 }) : [];
  const existingIds = new Set(items.map((i) => i.documentId));
  const pickerDocuments = documents.filter((d) => !existingIds.has(d.id)).map((d) => ({ id: d.id, title: d.title, code: d.code ?? "" }));
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink flex items-center gap-2">
          {collection.name}
          <Badge tone={collection.ownerId ? "neutral" : "info"}>{collection.ownerId ? t("documents.collectionPrivate") : t("documents.collectionSharedBadge")}</Badge>
        </h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("documents.documentTitle")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("documents.pinnedRevision")}</TH>
                <TH></TH>
              </TRow>
            </THead>
            <TBody>
              {items.map((item) => (
                <TRow key={item.id}>
                  <TD className="text-ink font-medium">
                    <Link href={`/documents/${item.document.id}`} className="hover:text-gold">{item.document.code} — {item.document.title}</Link>
                  </TD>
                  <TD className="text-ink-muted">{item.document.status}</TD>
                  <TD className="text-ink-muted">{item.revision?.revisionCode ?? t("documents.currentRevision")}</TD>
                  <TD>{canManage && <RemoveFromCollectionButton itemId={item.id} collectionId={collection.id} />}</TD>
                </TRow>
              ))}
              {items.length === 0 && <TRow><TD colSpan={4} className="py-8 text-center text-ink-faint">{t("documents.emptyCollection")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardContent className="py-4">
            <AddToCollectionForm collectionId={collection.id} documents={pickerDocuments} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
