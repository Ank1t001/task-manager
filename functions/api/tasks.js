import { getUser, json, badRequest, unauthorized, forbidden } from "./_auth";
import { nowIso, uid, writeAudit } from "./_activity";

function isOverdue(task) {
  const s = (task.status || "").toLowerCase();
  const due = (task.dueDate || "").trim();
  if (!due) return false;
  const dueDate = new Date(`${due}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    dueDate < today &&
    (s === "to do" || s === "todo" || s === "in progress" || s === "blocked")
  );
}

function canEditTask(auth, task) {
  // You can extend this later (stage owner, etc). For now:
  // owner can edit their tasks, tenant owner can edit all
  if (auth.role === "owner") return true;
  return (task.ownerEmail || "").toLowerCase() === (auth.user.email || "").toLowerCase();
}

export const onRequestGet = async ({ request, env }) => {
  const auth = await getUser(request, env);
  if (!auth.ok) return json(auth.body, auth.status);

  const rows = await env.DB.prepare(
    `SELECT * FROM tasks
     WHERE tenantId = ?
     ORDER BY status ASC, sortOrder ASC, updatedAt DESC`
  )
    .bind(auth.tenantId)
    .all();

  return json(rows.results || []);
};

export const onRequestPost = async ({ request, env }) => {
  const auth = await getUser(request, env);
  if (!auth.ok) return json(auth.body, auth.status);

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON");

  const t = {
    id: uid(),
    tenantId: auth.tenantId,
    taskName: (body.taskName || "").trim(),
    description: (body.description || "").toString(),
    owner: (body.owner || auth.user.name || "").toString(),
    ownerEmail: (body.ownerEmail || auth.user.email || "").toString(),
    type: (body.type || "Other").toString(),
    priority: (body.priority || "Medium").toString(),
    status: (body.status || "To Do").toString(),
    dueDate: (body.dueDate || "").toString(),
    externalStakeholders: (body.externalStakeholders || "").toString(),
    projectName: (body.projectName || "").toString(),
    stage: (body.stage || "").toString(),
    completedAt: "",
    sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  if (!t.taskName) return badRequest("Task name required");

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

  await writeAudit(env, {
    tenantId: auth.tenantId,
    actorUserId: auth.user.userId,
    actorEmail: auth.user.email,
    actorName: auth.user.name,
    action: "TASK_CREATED",
    entityType: "task",
    entityId: t.id,
    summary: `Created task: ${t.taskName}`,
  });

  return json(t, 201);
};

export const onRequestPut = async ({ request, env }) => {
  const auth = await getUser(request, env);
  if (!auth.ok) return json(auth.body, auth.status);

  const body = await request.json().catch(() => null);
  if (!body?.id) return badRequest("Task id required");

  const existing = await env.DB.prepare(
    `SELECT * FROM tasks WHERE id = ? AND tenantId = ? LIMIT 1`
  )
    .bind(body.id, auth.tenantId)
    .first();

  if (!existing) return json({ error: "Not found" }, 404);
  if (!canEditTask(auth, existing)) return forbidden("Read-only");

  const updated = {
    taskName: (body.taskName ?? existing.taskName).toString(),
    description: (body.description ?? existing.description).toString(),
    owner: (body.owner ?? existing.owner).toString(),
    ownerEmail: (body.ownerEmail ?? existing.ownerEmail).toString(),
    type: (body.type ?? existing.type).toString(),
    priority: (body.priority ?? existing.priority).toString(),
    status: (body.status ?? existing.status).toString(),
    dueDate: (body.dueDate ?? existing.dueDate).toString(),
    externalStakeholders: (body.externalStakeholders ?? existing.externalStakeholders).toString(),
    projectName: (body.projectName ?? existing.projectName).toString(),
    stage: (body.stage ?? existing.stage).toString(),
    sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : existing.sortOrder,
    updatedAt: nowIso(),
    completedAt:
      (body.status || existing.status) === "Done"
        ? existing.completedAt || nowIso()
        : "",
  };

  await env.DB.prepare(
    `UPDATE tasks SET
      taskName=?, description=?, owner=?, ownerEmail=?, type=?, priority=?, status=?, dueDate=?, externalStakeholders=?,
      projectName=?, stage=?, completedAt=?, sortOrder=?, updatedAt=?
     WHERE id=? AND tenantId=?`
  )
    .bind(
      updated.taskName,
      updated.description,
      updated.owner,
      updated.ownerEmail,
      updated.type,
      updated.priority,
      updated.status,
      updated.dueDate,
      updated.externalStakeholders,
      updated.projectName,
      updated.stage,
      updated.completedAt,
      updated.sortOrder,
      updated.updatedAt,
      body.id,
      auth.tenantId
    )
    .run();

  await writeAudit(env, {
    tenantId: auth.tenantId,
    actorUserId: auth.user.userId,
    actorEmail: auth.user.email,
    actorName: auth.user.name,
    action: "TASK_UPDATED",
    entityType: "task",
    entityId: body.id,
    summary: `Updated task: ${updated.taskName}`,
  });

  return json({ ok: true });
};

export const onRequestDelete = async ({ request, env }) => {
  const auth = await getUser(request, env);
  if (!auth.ok) return json(auth.body, auth.status);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return badRequest("id required");

  const existing = await env.DB.prepare(
    `SELECT * FROM tasks WHERE id=? AND tenantId=? LIMIT 1`
  )
    .bind(id, auth.tenantId)
    .first();

  if (!existing) return json({ error: "Not found" }, 404);
  if (!canEditTask(auth, existing)) return forbidden("Read-only");

  await env.DB.prepare(`DELETE FROM tasks WHERE id=? AND tenantId=?`)
    .bind(id, auth.tenantId)
    .run();

  await writeAudit(env, {
    tenantId: auth.tenantId,
    actorUserId: auth.user.userId,
    actorEmail: auth.user.email,
    actorName: auth.user.name,
    action: "TASK_DELETED",
    entityType: "task",
    entityId: id,
    summary: `Deleted task: ${existing.taskName}`,
  });

  return json({ ok: true });
};