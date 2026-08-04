import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateDocumentDialog } from "@/components/documents/create-document-dialog";
import { formatDate } from "@/lib/utils";

type Doc = {
  id: string;
  name: string;
  category: string;
  status: string;
  version: number;
  uploadedBy: { displayName: string };
  createdAt: Date;
};

// PRD_Rework_1 §9/§10 — Technical Documents and Government & Legal are both
// just this same folder-grouped view over DocumentFile, filtered to a
// different category list. The revision badge (v{n}) and status come
// straight from DocumentFile's existing revision chain (PRD_18) — no new
// tracking needed to satisfy PROJ-011/012.
export function DocumentCategorySection({
  title,
  description,
  categories,
  documents,
  projectId,
  unitId,
  canUpload,
  uploadLabel,
  emptyLabel,
}: {
  title: string;
  description: string;
  categories: readonly string[];
  // Pre-filtered by the caller to this section's category list — a doc in
  // neither list (e.g. legacy "General") belongs to neither section, so
  // filtering lives at the call site rather than an "Other" catch-all here
  // that would otherwise duplicate docs across both sections.
  documents: Doc[];
  projectId: string;
  // PRD_Unit_Page §11 — when set, uploads attach to this unit instead of
  // the project directly (projectId is still passed through for the
  // create-action's revalidatePath).
  unitId?: string;
  canUpload: boolean;
  uploadLabel: string;
  emptyLabel: string;
}) {
  const groups = categories
    .map((category) => ({ category, docs: documents.filter((d) => d.category === category) }))
    .filter((g) => g.docs.length > 0);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {canUpload && <CreateDocumentDialog projectId={projectId} unitId={unitId} triggerLabel={uploadLabel} categoryOptions={categories} />}
      </CardHeader>
      <CardContent className="space-y-4">
        {documents.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">{emptyLabel}</p>
        ) : (
          groups.map((group) => (
            <div key={group.category}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{group.category}</p>
              <ul className="space-y-1.5">
                {group.docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-ink">{doc.name}</p>
                      <p className="text-xs text-ink-faint">
                        v{doc.version} · {doc.uploadedBy.displayName} · {formatDate(doc.createdAt)}
                      </p>
                    </div>
                    <Badge status={doc.status}>{doc.status}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
