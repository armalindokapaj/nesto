import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listCollections } from "@/server/documents-module";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateCollectionDialog, DeleteCollectionButton } from "@/components/documents/collection-dialogs";
import { getT } from "@/lib/i18n/server";

export default async function DocumentCollectionsPage() {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "READ")) redirect("/dashboard/executive");

  const collections = await listCollections(tenantId, user.id);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("documents.collectionsTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("documents.collectionsSubtitle")}</p>
        </div>
        <CreateCollectionDialog />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {collections.map((c) => (
          <Card key={c.id}>
            <CardContent className="py-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/documents/collections/${c.id}`} className="font-medium text-ink hover:text-gold">{c.name}</Link>
                <Badge tone={c.ownerId ? "neutral" : "info"}>{c.ownerId ? t("documents.collectionPrivate") : t("documents.collectionSharedBadge")}</Badge>
              </div>
              <p className="text-xs text-ink-muted">{c._count.items} {t("documents.collectionItemsCount")}</p>
              {c.ownerId === user.id && (
                <div className="pt-1">
                  <DeleteCollectionButton collectionId={c.id} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {collections.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-8 text-center text-ink-faint">{t("documents.noCollections")}</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
