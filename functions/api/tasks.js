import { requireAuth, json, badRequest, unauthorized, forbidden } from "./_auth";
import { nowIso, uid, writeAudit } from "./_activity";

async function getTenantForUser(env, userId) {
  const row = await env.DB.prepare(
    `SELECT tenantId, role FROM tenant_members WHERE userId = ? LIMIT 1`
  )
    .bind(userId)
    .first();

  return row || null;
}

function canEditAny(role) {
  return role === "owner" || role === "admin";
}

export const onRequestGet = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json(auth.body, auth.status);

  const tm = await getTenantForUser(env, auth.user.userId);
  if (!tm?.tenantId) return unauthorized("No tenant membership. Call /api/tenants/bootstrap first.");

  const rows = await env.DB.prepare(
    `SELECT * FROM tasks WHERE tenantId = ? ORDER BY status ASC, sortOrder ASC, updatedAt DESC`
  )
    .bind(tm.tenantId)
    .all();

  return json(rows.results || []);
};

export const onRequestPost = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json(auth.body, auth.status);

  const tm = await getTenantForUser(env, auth.user.userId);
  if (!tm?.tenantId) return unauthorized("No tenant membership. Call /api/tenants/bootstrap first.");

  const body = await request.json().catch(() => null);
  if (!body?.taskName) return badRequest("taskName is required");

  const t = {
    id: uid(),
    tenantId: tm.tenantId,
    taskName: body.taskName,
    description: body.description || "",
    owner: body.owner || auth.user.name || "",
    ownerEmail: body.ownerEmail || auth.user.email || "",
    type: body.type || "Other",
    priority: body.priority || "Medium",
    status: body.status || "To Do",
    dueDate: body.dueDate || "",
    externalStakeholders: body.externalStakeholders || "",
    projectName: body.projectName || "",
    stage: body.stage || "",
    completedAt: "",
    sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : 0,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  await env.DB.prepare(
    `INSERT INTO tasks
     (id, tenantId, taskName, description, owner, ownerEmail, type, priority, status, dueDate, externalStakeholders, createdAt, updatedAt, projectName, stage, completedAt, sortOrder)
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

  await writeAudit(env, {
    tenantId: tm.tenantId,
    actorUserId: auth.user.userId,
    actorEmail: auth.user.email,
    actorName: auth.user.name,
    action: "TASK_CREATED",
    entityType: "task",
    entityId: t.id,
    summary: `Created task: ${t.taskName}`
  });

  return json(t, 201);
};

export const onRequestPut = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json(auth.body, auth.status);

  const tm = await getTenantForUser(env, auth.user.userId);
  if (!tm?.tenantId) return unauthorized("No tenant membership. Call /api/tenants/bootstrap first.");

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return badRequest("Missing id");

  const existing = await env.DB.prepare(
    `SELECT * FROM tasks WHERE id = ? AND tenantId = ? LIMIT 1`
  )
    .bind(id, tm.tenantId)
    .first();

  if (!existing) return json({ error: "Not found" }, 404);

  const role = tm.role || "member";
  const canEdit =
    canEditAny(role) || (auth.user.email && existing.ownerEmail && auth.user.email.toLowerCase() === existing.ownerEmail.toLowerCase());

  if (!canEdit) return forbidden("You cannot edit this task");

  const body = await request.json().catch(() => ({}));
  const updatedAt = nowIso();

  const next = {
    ...existing,
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
    sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : existing.sortOrder,
    completedAt: body.completedAt ?? existing.completedAt,
    updatedAt
  };

  await env.DB.prepare(
    `UPDATE tasks SET
      taskName=?,
      description=?,
      owner=?,
      ownerEmail=?,
      type=?,
      priority=?,
      status=?,
      dueDate=?,
      externalStakeholders=?,
      projectName=?,
      stage=?,
      completedAt=?,
      sortOrder=?,
      updatedAt=?
     WHERE id=? AND tenantId=?`
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
      next.completedAt,
      next.sortOrder,
      next.updatedAt,
      id,
      tm.tenantId
    )
    .run();

  await writeAudit(env, {
    tenantId: tm.tenantId,
    actorUserId: auth.user.userId,
    actorEmail: auth.user.email,
    actorName: auth.user.name,
    action: "TASK_UPDATED",
    entityType: "task",
    entityId: id,
    summary: `Updated task: ${next.taskName}`
  });

  return json(next);
};

export const onRequestDelete = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json(auth.body, auth.status);

  const tm = await getTenantForUser(env, auth.user.userId);
  if (!tm?.tenantId) return unauthorized("No tenant membership. Call /api/tenants/bootstrap first.");

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return badRequest("Missing id");

  const existing = await env.DB.prepare(
    `SELECT * FROM tasks WHERE id = ? AND tenantId = ? LIMIT 1`
  )
    .bind(id, tm.tenantId)
    .first();

  if (!existing) return json({ ok: true });

  const role = tm.role || "member";
  const canDelete = canEditAny(role);

  if (!canDelete) return forbidden("Only owner/admin can delete tasks");

  await env.DB.prepare(`DELETE FROM tasks WHERE id=? AND tenantId=?`).bind(id, tm.tenantId).run();

  await writeAudit(env, {
    tenantId: tm.tenantId,
    actorUserId: auth.user.userId,
    actorEmail: auth.user.email,
    actorName: auth.user.name,
    action: "TASK_DELETED",
    entityType: "task",
    entityId: id,
    summary: `Deleted task: ${existing.taskName}`
  });

  return json({ ok: true });
};