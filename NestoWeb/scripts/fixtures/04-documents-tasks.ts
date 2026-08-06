import type { FixtureContext } from "./context";
import { ensureProjectFolders, createDocumentRecord, setRequiredReading, createCollection, addDocumentToCollection } from "@/server/documents-module";
import { toggleTaskWatch, addTaskLink, setTaskRecurrence, createSavedView } from "@/server/tasks-module";

export async function seedDocumentsAndTasks(ctx: FixtureContext) {
  const { db, tenantId, owner, users, projects } = ctx;
  console.log("Documents Passport module + Tasks gap-fill…");

  // --- Documents module (Folder/Document Passport/Collections) --------------
  if (!(await db.document.findFirst({ where: { tenantId } }))) {
    const projectFolder = await ensureProjectFolders(tenantId, projects.riverside.id, projects.riverside.name);
    const reportsFolder = await db.folder.findFirst({ where: { tenantId, parentId: projectFolder.id, name: "05. Reports" } });
    const drawingsFolder = await db.folder.findFirst({ where: { tenantId, parentId: projectFolder.id, name: "02. Drawings" } });

    const doc1 = await createDocumentRecord(tenantId, {
      title: "Riverside Towers — Monthly Progress Report (July)",
      docType: "REPORT",
      category: "Progress Reporting",
      folderId: (reportsFolder ?? projectFolder).id,
      ownerId: users.gentian.id,
      status: "APPROVED",
    });
    const doc2 = await createDocumentRecord(tenantId, {
      title: "Riverside Towers — Facade Elevation Set",
      docType: "DRAWING",
      category: "Architecture",
      folderId: (drawingsFolder ?? projectFolder).id,
      ownerId: users.elira.id,
      status: "AWAITING_APPROVAL",
    });
    console.log("  + Document Passport records (Progress Report, Facade Elevation Set)");

    await setRequiredReading(tenantId, doc1.id, owner.id, true, [users.besnik.id, users.gentian.id]);
    console.log("  + Required reading assigned on the progress report");

    const collection = await createCollection(tenantId, owner.id, { name: "Riverside Towers — Handover Pack", shared: true });
    await addDocumentToCollection(tenantId, collection.id, owner.id, doc1.id);
    await addDocumentToCollection(tenantId, collection.id, owner.id, doc2.id);
    console.log("  + Shared Collection: Riverside Towers — Handover Pack");
  }

  // --- Tasks gap-fill (Watcher/Link/Recurrence/SavedView) --------------------
  const anyTask = await db.task.findFirst({ where: { tenantId } });
  if (anyTask && !(await db.taskWatcher.findFirst({ where: { tenantId } }))) {
    await toggleTaskWatch(tenantId, anyTask.id, owner.id);
    console.log(`  + TaskWatcher: Arben watching "${anyTask.title}"`);

    await addTaskLink(tenantId, owner.id, anyTask.id, "PROJECT", anyTask.projectId ?? projects.riverside.id, "relates to");
    console.log("  + TaskLink to its project");

    await setTaskRecurrence(tenantId, owner.id, anyTask.id, { frequency: "WEEKLY", interval: 1 });
    console.log("  + TaskRecurrence: weekly");

    await createSavedView(tenantId, owner.id, { name: "My High-Priority Work", layout: "BOARD", filtersJson: "status=IN_PROGRESS", isDefault: true });
    await createSavedView(tenantId, owner.id, { name: "This Week", layout: "TIMELINE" });
    console.log("  + TaskSavedViews: My High-Priority Work, This Week");
  }
}
