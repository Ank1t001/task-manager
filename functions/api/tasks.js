// functions/api/tasks.js
import { getUser, json, badRequest, unauthorized, forbidden } from "./_auth";
import { logActivity } from "./_activity";

async function getTaskById(db, tenantId, id) {
  const row = await db.prepare(`SELECT * FROM tasks WHERE tenantId = ? AND id = ?`).bind(tenantId, id).first();
  return row || null;
}

export async function onRequestGet(context) {
  const user = await getUser(context);
  if (!user.email) return unauthorized();

  const db = context.env.DB;

  const rows = await db
    .prepare(`SELECT * FROM tasks WHERE tenantId = ? ORDER BY updatedAt DESC, createdAt DESC`)
    .bind(user.tenantId)
    .all();

  return json(rows.results || []);
}

export async function onRequestPost(context) {
  const user = await getUser(context);
  if (!user.email) return unauthorized();

  const db = context.env.DB;
  const body = await context.request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const task = {
    id,
    tenantId: user.tenantId,
    taskName: body.taskName || "",
    description: body.description || "",
    owner: body.owner || user.name,
    ownerEmail: (body.ownerEmail || user.email || "").toLowerCase(),
    type: body.type || body.section || "Other",
    priority: body.priority || "Medium",
    status: body.status || "To Do",
    dueDate: body.dueDate || "",
    externalStakeholders: body.externalStakeholders || "",
    projectName: body.projectName || "",
    stage: body.stage || "",
    completedAt: body.completedAt || "",
    sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : 0,
    createdAt: now,
    updatedAt: now,
  };

  if (!task.taskName.trim()) return badRequest("taskName is required");

  await db
    .prepare(
      `INSERT INTO tasks (
        id, tenantId, taskName, description,
        owner, ownerEmail, type, priority, status,
        dueDate, externalStakeholders,
        projectName, stage, completedAt,
        sortOrder, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      task.id,
      task.tenantId,
      task.taskName,
      task.description,
      task.owner,
      task.ownerEmail,
      task.type,
      task.priority,
      task.status,
      task.dueDate,
      task.externalStakeholders,
      task.projectName,
      task.stage,
      task.completedAt,
      task.sortOrder,
      task.createdAt,
      task.updatedAt
    )
    .run();

  if (task.projectName) {
    await logActivity(db, {
      tenantId: user.tenantId,
      projectName: task.projectName,
      taskId: task.id,
      actorEmail: user.email,
      actorName: user.name,
      action: "TASK_CREATED",
      summary: `${user.name} created "${task.taskName}"`,
      meta: { taskName: task.taskName },
    });
  }

  return json({ ok: true, task }, 201);
}

export async function onRequestPut(context) {
  const user = await getUser(context);
  if (!user.email) return unauthorized();

  const url = new URL(context.request.url);
  const id = String(url.searchParams.get("id") || "").trim();
  if (!id) return badRequest("id is required");

  const db = context.env.DB;
  const existing = await getTaskById(db, user.tenantId, id);
  if (!existing) return badRequest("Task not found");

  // Member can edit only own tasks unless admin
  if (!user.isAdmin && String(existing.ownerEmail || "").toLowerCase() !== user.email) {
    return forbidden("You can only edit tasks assigned to you.");
  }

  const body = await context.request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const updatedAt = new Date().toISOString();
  const next = {
    ...existing,
    taskName: body.taskName ?? existing.taskName,
    description: body.description ?? existing.description,
    owner: body.owner ?? existing.owner,
    ownerEmail: (body.ownerEmail ?? existing.ownerEmail ?? "").toLowerCase(),
    type: body.type ?? body.section ?? existing.type,
    priority: body.priority ?? existing.priority,
    status: body.status ?? existing.status,
    dueDate: body.dueDate ?? existing.dueDate,
    externalStakeholders: body.externalStakeholders ?? existing.externalStakeholders,
    projectName: body.projectName ?? existing.projectName,
    stage: body.stage ?? existing.stage,
    sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : existing.sortOrder,
    completedAt: body.completedAt ?? existing.completedAt,
  };

  await db
    .prepare(
      `UPDATE tasks SET
        taskName = ?, description = ?,
        owner = ?, ownerEmail = ?,
        type = ?, priority = ?, status = ?,
        dueDate = ?, externalStakeholders = ?,
        projectName = ?, stage = ?, completedAt = ?,
        sortOrder = ?, updatedAt = ?
       WHERE tenantId = ? AND id = ?`
    )
    .bind(
      next.taskName,
      next.description,
      next.owner,
      next.ownerEmail,
      next.type,
      next.priority,
      next.status,
      next.dueDate,
      next.externalStakeholders,
      next.projectName,
      next.stage,
      next.completedAt || "",
      next.sortOrder,
      updatedAt,
      user.tenantId,
      id
    )
    .run();

  if (next.projectName) {
    await logActivity(db, {
      tenantId: user.tenantId,
      projectName: next.projectName,
      taskId: id,
      actorEmail: user.email,
      actorName: user.name,
      action: "TASK_UPDATED",
      summary: `${user.name} updated "${next.taskName}"`,
      meta: {},
    });
  }

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const user = await getUser(context);
  if (!user.email) return unauthorized();

  const url = new URL(context.request.url);
  const id = String(url.searchParams.get("id") || "").trim();
  if (!id) return badRequest("id is required");

  const db = context.env.DB;
  const existing = await getTaskById(db, user.tenantId, id);
  if (!existing) return badRequest("Task not found");

  if (!user.isAdmin && String(existing.ownerEmail || "").toLowerCase() !== user.email) {
    return forbidden("You can only delete tasks assigned to you.");
  }

  await db.prepare(`DELETE FROM tasks WHERE tenantId = ? AND id = ?`).bind(user.tenantId, id).run();

  if (existing.projectName) {
    await logActivity(db, {
      tenantId: user.tenantId,
      projectName: existing.projectName,
      taskId: id,
      actorEmail: user.email,
      actorName: user.name,
      action: "TASK_DELETED",
      summary: `${user.name} deleted "${existing.taskName}"`,
      meta: { taskName: existing.taskName },
    });
  }

  return json({ ok: true });
}