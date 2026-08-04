"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { DEPARTMENT_ROLES, TASK_VISIBILITIES } from "@/lib/constants";
import * as projectsRepo from "@/server/projects";
import { createDocument } from "@/server/documents";

const CreateProjectSchema = z.object({
  name: z.string().min(2, "Enter a project name"),
  clientName: z.string().optional(),
  location: z.string().optional(),
  budget: z.coerce.number().optional(),
});

export type CreateProjectState = { error: string } | undefined;

export async function createProjectAction(_prev: CreateProjectState, formData: FormData): Promise<CreateProjectState> {
  const { tenantId, role, company, user } = await getCurrentUser();
  if (!can(role, "PROJECTS", "WRITE")) {
    return { error: "You do not have permission to create projects." };
  }
  if (!company) {
    return { error: "No company found for this workspace." };
  }

  const parsed = CreateProjectSchema.safeParse({
    name: formData.get("name"),
    clientName: formData.get("clientName") || undefined,
    location: formData.get("location") || undefined,
    budget: formData.get("budget") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const project = await projectsRepo.createProject(tenantId, company.id, parsed.data);

  const documentNames = formData.getAll("documentName").map(String);
  const documentCategories = formData.getAll("documentCategory").map(String);
  for (let i = 0; i < documentNames.length; i++) {
    const name = documentNames[i].trim();
    if (!name) continue;
    await createDocument(tenantId, {
      name,
      category: documentCategories[i]?.trim() || undefined,
      projectId: project.id,
      uploadedById: user.id,
    });
  }

  revalidatePath("/projects");
  return undefined;
}

const CreateTaskSchema = z.object({
  title: z.string().min(2, "Enter a task title"),
  projectId: z.string().optional(),
  clientId: z.string().optional(),
  mainResponsibleId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  visibility: z.enum(TASK_VISIBILITIES).optional(),
  departmentRole: z.enum(DEPARTMENT_ROLES).optional(),
  documentName: z.string().optional(),
  documentCategory: z.string().optional(),
});

export type CreateTaskState = { error: string } | undefined;

export async function createTaskAction(_prev: CreateTaskState, formData: FormData): Promise<CreateTaskState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "TASKS", "WRITE")) {
    return { error: "You do not have permission to create tasks." };
  }

  const parsed = CreateTaskSchema.safeParse({
    title: formData.get("title"),
    projectId: formData.get("projectId") || undefined,
    clientId: formData.get("clientId") || undefined,
    mainResponsibleId: formData.get("mainResponsibleId") || undefined,
    priority: formData.get("priority") || undefined,
    visibility: formData.get("visibility") || undefined,
    departmentRole: formData.get("visibility") === "DEPARTMENT_PUBLIC" ? formData.get("departmentRole") || undefined : undefined,
    documentName: formData.get("documentName") || undefined,
    documentCategory: formData.get("documentCategory") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { documentName, documentCategory, mainResponsibleId, ...taskInput } = parsed.data;
  const task = await projectsRepo.createTask(tenantId, {
    ...taskInput,
    createdById: user.id,
    mainResponsibleId: mainResponsibleId || user.id,
  });

  if (documentName) {
    await createDocument(tenantId, {
      name: documentName,
      category: documentCategory,
      projectId: taskInput.projectId,
      clientId: taskInput.clientId,
      taskId: task.id,
      uploadedById: user.id,
    });
  }

  revalidatePath("/tasks");
  if (taskInput.projectId) revalidatePath(`/projects/${taskInput.projectId}`);
  if (taskInput.clientId) revalidatePath(`/clients/${taskInput.clientId}`);
  return undefined;
}

export async function updateTaskStatusAction(
  taskId: string,
  projectId: string | undefined,
  status: string,
  clientId?: string
) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "TASKS", "WRITE")) {
    throw new Error("You do not have permission to update tasks.");
  }
  await projectsRepo.updateTaskStatus(tenantId, taskId, status);
  revalidatePath("/tasks");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

export async function deleteTaskAction(taskId: string, projectId: string | undefined, clientId?: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "TASKS", "WRITE")) {
    throw new Error("You do not have permission to delete tasks.");
  }
  await projectsRepo.deleteTask(tenantId, taskId, user.id);
  revalidatePath("/tasks");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

export async function toggleProjectPinAction(projectId: string) {
  const { tenantId, user } = await getCurrentUser();
  const pinned = await projectsRepo.toggleProjectPin(tenantId, user.id, projectId);
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return pinned;
}

const BrandKitSchema = z.object({
  projectId: z.string().min(1),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
  logoDataUrl: z
    .string()
    .refine((v) => v.startsWith("data:image/"), "Logo must be an image.")
    .refine((v) => v.length < 1_000_000, "Logo image is too large.")
    .optional()
    .or(z.literal("")),
});

export type BrandKitState = { error: string } | undefined;

export async function updateProjectBrandKitAction(_prev: BrandKitState, formData: FormData): Promise<BrandKitState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "WRITE")) {
    return { error: "You do not have permission to edit this project's brand kit." };
  }

  const parsed = BrandKitSchema.safeParse({
    projectId: formData.get("projectId"),
    accentColor: formData.get("accentColor") || undefined,
    logoDataUrl: formData.get("logoDataUrl") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { projectId, accentColor, logoDataUrl } = parsed.data;
  await projectsRepo.updateProjectBrandKit(tenantId, projectId, {
    accentColor: accentColor || undefined,
    logoDataUrl: logoDataUrl || undefined,
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return undefined;
}
