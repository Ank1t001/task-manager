import { requireAuth, json, badRequest, unauthorized, forbidden } from "./_auth";
import { logActivity } from "./_activity";

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  return crypto.randomUUID();
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.res;

  // Until tenant bootstrap is done, don’t allow data reads
  if (!auth.tenantId) return unauthorized("No tenant selected. Run tenant bootstrap.");

  const rows = await env.DB.prepare(
    "SELECT * FROM tasks WHERE tenantId = ? ORDER BY sortOrder ASC, updatedAt DESC"
  )
    .bind(auth.tenantId)
    .all();

  return json(rows.results || []);
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.res;
  if (!auth.tenantId) return unauthorized("No tenant selected. Run tenant bootstrap.");

  const body = await request.json().catch(() => null);
  if (!body?.taskName) return badRequest("taskName is required");

  const t = {
    id: uid(),
    tenantId: auth.tenantId,
    taskName: body.taskName,
    description: body.description || "",
    owner: body.owner || auth.user.name,
    ownerEmail: body.ownerEmail || auth.user.email || "",
    type: body.type || "Other",
    priority: body.priority || "Medium",
    status: body.status || "To Do",
    dueDate: body.dueDate || "",
    externalStakeholders: body.externalStakeholders || "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    projectName: body.projectName || "",
    stage: body.stage || "",
    completedAt: body.completedAt || "",
    sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : 0,
  };

  await env.DB.prepare(
    `INSERT INTO tasks
     (id, tenantId, taskName, description, owner, ownerEmail, type, priority, status, dueDate, externalStakeholders,
      createdAt, updatedAt, projectName, stage, completedAt, sortOrder)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      t.id,
      t.tenantId,
      t.taskName,
      t.description,
      t.owner,
      t.ownerEmail,
      t.type,
      t.priority,
      t.status,
      t.dueDate,
      t.externalStakeholders,
      t.createdAt,
      t.updatedAt,
      t.projectName,
      t.stage,
      t.completedAt,
      t.sortOrder
    )
    .run();

  await logActivity(env, {
    id: uid(),
    tenantId: auth.tenantId,
    actorSub: auth.user.sub,
    actorName: auth.user.name,
    actorEmail: auth.user.email || "",
    action: "task_created",
    summary: `Created task: ${t.taskName}`,
    meta: JSON.stringify({ taskId: t.id }),
    createdAt: nowIso(),
  });

  return json(t, 201);
}

export async function onRequestPut({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.res;
  if (!auth.tenantId) return unauthorized("No tenant selected. Run tenant bootstrap.");

  const body = await request.json().catch(() => null);
  if (!body?.id) return badRequest("id is required");

  // Basic permission rule (adjust later):
  // - admin can edit all
  // - member can edit only their tasks
  const existing = await env.DB.prepare(
    "SELECT * FROM tasks WHERE id = ? AND tenantId = ? LIMIT 1"
  )
    .bind(body.id, auth.tenantId)
    .first();

  if (!existing) return badRequest("Task not found");
  const isOwner = (existing.ownerEmail || "").toLowerCase() === (auth.user.email || "").toLowerCase();
  const canEdit = auth.role === "admin" || isOwner;
  if (!canEdit) return forbidden("You can only edit your own tasks");

  const updatedAt = nowIso();
  const patch = {
    taskName: body.taskName ?? existing.taskName,
    description: body.description ?? existing.description,
    owner: body.owner ?? existing.owner,
    ownerEmail: body.ownerEmail ?? existing.ownerEmail,
    type: body.type ?? existing.type,
    priority: body.priority ?? existing.priority,
    status: body.status ?? existing.status,
    dueDate: body.dueDate ?? existing.dueDate,
    externalStakeholders: body.externalStakeholders ?? existing.externalStakeholders,
    projectName: body.projectName ?? existing.projectName,
    stage: body.stage ?? existing.stage,
    completedAt: body.completedAt ?? existing.completedAt,
    sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : existing.sortOrder,
  };

  await env.DB.prepare(
    `UPDATE tasks SET
      taskName = ?, description = ?, owner = ?, ownerEmail = ?, type = ?, priority = ?, status = ?,
      dueDate = ?, externalStakeholders = ?, projectName = ?, stage = ?, completedAt = ?, sortOrder = ?, updatedAt = ?
     WHERE id = ? AND tenantId = ?`
  )
    .bind(
      patch.taskName,
      patch.description,
      patch.owner,
      patch.ownerEmail,
      patch.type,
      patch.priority,
      patch.status,
      patch.dueDate,
      patch.externalStakeholders,
      patch.projectName,
      patch.stage,
      patch.completedAt,
      patch.sortOrder,
      updatedAt,
      body.id,
      auth.tenantId
    )
    .run();

  await logActivity(env, {
    id: uid(),
    tenantId: auth.tenantId,
    actorSub: auth.user.sub,
    actorName: auth.user.name,
    actorEmail: auth.user.email || "",
    action: "task_updated",
    summary: `Updated task: ${patch.taskName}`,
    meta: JSON.stringify({ taskId: body.id }),
    createdAt: nowIso(),
  });

  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.res;
  if (!auth.tenantId) return unauthorized("No tenant selected. Run tenant bootstrap.");

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return badRequest("id is required");

  const existing = await env.DB.prepare(
    "SELECT * FROM tasks WHERE id = ? AND tenantId = ? LIMIT 1"
  )
    .bind(id, auth.tenantId)
    .first();

  if (!existing) return badRequest("Task not found");

  const isOwner = (existing.ownerEmail || "").toLowerCase() === (auth.user.email || "").toLowerCase();
  const canDelete = auth.role === "admin" || isOwner;
  if (!canDelete) return forbidden("You can only delete your own tasks");

  await env.DB.prepare("DELETE FROM tasks WHERE id = ? AND tenantId = ?")
    .bind(id, auth.tenantId)
    .run();

  await logActivity(env, {
    id: uid(),
    tenantId: auth.tenantId,
    actorSub: auth.user.sub,
    actorName: auth.user.name,
    actorEmail: auth.user.email || "",
    action: "task_deleted",
    summary: `Deleted task: ${existing.taskName}`,
    meta: JSON.stringify({ taskId: id }),
    createdAt: nowIso(),
  });

  return json({ ok: true });
}