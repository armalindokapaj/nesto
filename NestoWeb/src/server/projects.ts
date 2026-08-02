import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import { allocateNumber } from "@/server/number-series";

export async function listProjects(tenantId: string) {
  return db.project.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { tasks: true } } },
  });
}

export async function getProject(tenantId: string, projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: {
        orderBy: { createdAt: "desc" },
        include: { mainResponsible: true, contributions: { include: { user: true } }, _count: { select: { documents: true } } },
      },
      members: { include: { user: true } },
    },
  });
  return assertTenant(project, tenantId, "Project");
}

export async function createProject(
  tenantId: string,
  companyId: string,
  input: { name: string; clientName?: string; location?: string; budget?: number }
) {
  const code = await allocateNumber(tenantId, "PROJECT");
  return db.project.create({
    data: {
      tenantId,
      companyId,
      code,
      name: input.name,
      clientName: input.clientName,
      location: input.location,
      budget: input.budget,
      status: "ON_TRACK",
    },
  });
}

export async function createTask(
  tenantId: string,
  input: {
    title: string;
    projectId?: string;
    clientId?: string;
    createdById: string;
    mainResponsibleId?: string;
    priority?: string;
    dueDate?: Date;
  }
) {
  const code = await allocateNumber(tenantId, "TASK");
  return db.task.create({
    data: {
      tenantId,
      code,
      title: input.title,
      projectId: input.projectId,
      clientId: input.clientId,
      createdById: input.createdById,
      mainResponsibleId: input.mainResponsibleId,
      priority: input.priority ?? "MEDIUM",
      dueDate: input.dueDate,
    },
  });
}

export async function updateTaskStatus(tenantId: string, taskId: string, status: string) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  assertTenant(task, tenantId, "Task");
  return db.task.update({ where: { id: taskId }, data: { status } });
}

export async function listTasks(tenantId: string, projectId?: string) {
  return db.task.findMany({
    where: { tenantId, ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: "desc" },
    include: { mainResponsible: true, project: true, _count: { select: { documents: true } } },
  });
}

// Only the task's creator may delete it — enforced here, not just in the UI,
// since `can(role, "TASKS", "WRITE")` alone would let any writer delete any
// task, which is broader than "you can delete what you created."
export async function deleteTask(tenantId: string, taskId: string, requestingUserId: string) {
  const task = assertTenant(await db.task.findUnique({ where: { id: taskId } }), tenantId, "Task");
  if (task.createdById !== requestingUserId) {
    throw new Error("Only the task's creator can delete it.");
  }
  return db.task.delete({ where: { id: taskId } });
}
