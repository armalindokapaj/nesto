import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { UploadPhotoDialog } from "@/components/projects/upload-photo-dialog";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

type Photo = { id: string; caption: string | null; takenAt: Date; uploadedBy: { displayName: string } };

// PRD_Rework_1 §14 — chronological visual progress gallery, individual blob
// rows (ProjectPhoto), same pattern as the Brand Kit's ProjectRender gallery.
export async function PhotoGallery({ projectId, photos, canManage }: { projectId: string; photos: Photo[]; canManage: boolean }) {
  const { t } = await getT();

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("photoProgress.title")}</CardTitle>
          <CardDescription>{t("photoProgress.subtitle")}</CardDescription>
        </div>
        {canManage && <UploadPhotoDialog projectId={projectId} />}
      </CardHeader>
      <CardContent>
        {photos.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">{t("photoProgress.noPhotos")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg bg-surface-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element -- served from our own blob API route */}
                <img src={`/api/project-photos/${photo.id}/file`} alt={photo.caption ?? ""} className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="truncate text-xs text-white">{photo.caption ?? photo.uploadedBy.displayName}</p>
                  <p className="text-[0.65rem] text-white/80">{formatDate(photo.takenAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
