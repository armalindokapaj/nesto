import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, ImageOff } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getBimModel, getViewableRevisionForBimVersion } from "@/server/bim";
import { getConfigResolver } from "@/server/platform-config";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddBimVersionDialog, CreateBimLinkDialog, BimModelStatusActions } from "@/components/bim/bim-dialogs";
import { BimViewer } from "@/components/bim/bim-viewer";
import { removeBimObjectLinkAction } from "@/app/actions/bim";
import { formatDate } from "@/lib/utils";

export default async function BimModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("bim.page.model_detail")) redirect("/dashboard/bim");
  const canWrite = can(role, "PROJECTS", "WRITE");

  let model;
  try { model = await getBimModel(tenantId, id); } catch { return notFound(); }

  const latestVersion = model.versions[0];
  const viewable = latestVersion ? await getViewableRevisionForBimVersion(tenantId, latestVersion.documentId ?? null) : null;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/bim" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold"><ArrowLeft size={14} /> BIM Model Registry</Link>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-xl font-semibold text-ink">{model.name}</h1><Badge status={model.status}>{model.status}</Badge></div>
          <p className="mt-1 text-sm text-ink-muted">{model.discipline.replaceAll("_", " ")}{model.description ? ` · ${model.description}` : ""}</p>
        </div>
        {canWrite && <BimModelStatusActions modelId={model.id} status={model.status} />}
      </div>

      {viewable ? (
        <Card>
          <CardHeader><CardTitle>3D Preview — {viewable.name}</CardTitle></CardHeader>
          <CardContent>
            <BimViewer fileUrl={`/api/documents/${viewable.revisionId}/file`} />
            <p className="mt-2 text-xs text-ink-faint">glTF/GLB viewer only — full IFC parsing and object-identity matching remain a separate engineering track.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ImageOff className="text-ink-faint" size={28} />
            <p className="text-sm font-medium text-ink">No live 3D preview available</p>
            <p className="max-w-md text-xs text-ink-faint">
              A live preview renders glTF/GLB files directly in the browser. This model&apos;s latest version is either not linked to a Documents file yet, or its source format (IFC, RVT, DWG, ...) has no in-browser parser in this build — download it from its Documents module reference to view it in native CAD/BIM software.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Versions</CardTitle>
          {canWrite && <AddBimVersionDialog modelId={model.id} />}
        </CardHeader>
        <CardContent className="space-y-3">
          {model.versions.map((v) => (
            <div key={v.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink">v{v.versionNumber} {v.fileName ? `· ${v.fileName}` : ""}</span>
                <Badge status={v.status}>{v.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-ink-faint">{v.uploadedBy.displayName} · {formatDate(v.createdAt)}{v.documentId ? ` · Document ${v.documentId}` : ""}</p>
              {v.notes && <p className="mt-1 text-xs text-ink-muted">{v.notes}</p>}
            </div>
          ))}
          {!model.versions.length && <p className="py-6 text-center text-sm text-ink-faint">No versions registered yet.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Linked records</CardTitle>
          {canWrite && <CreateBimLinkDialog modelId={model.id} />}
        </CardHeader>
        <CardContent className="space-y-2">
          {model.links.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <div>
                <span className="font-medium text-ink">{l.entityType.replaceAll("_", " ")}</span> <span className="text-ink-faint">{l.entityId}</span>
                {l.objectRef && <span className="ml-2 rounded-full bg-surface-sunken px-2 py-0.5 text-[0.65rem] text-ink-faint">{l.objectRef}</span>}
                <p className="text-xs text-ink-faint">{l.relation.replaceAll("_", " ")} · linked by {l.createdBy.displayName}</p>
              </div>
              {canWrite && <form action={removeBimObjectLinkAction.bind(null, l.id, model.id)}><button className="text-xs text-danger hover:underline">Remove</button></form>}
            </div>
          ))}
          {!model.links.length && <p className="py-6 text-center text-sm text-ink-faint">Not linked to any records yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
