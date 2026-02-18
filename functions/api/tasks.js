import { requireAuth, json, badRequest, forbidden } from "./_auth";

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { env } = context;
  const { tenant } = auth;

  const rows = await env.DB.prepare(
    `SELECT *
     FROM tasks
     WHERE tenantId = ?
     ORDER BY sortOrder ASC, createdAt DESC`
  )
    .bind(tenant.tenantId)
    .all();

  return json({ tasks: rows.results || [] });
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { env, request } = context;
  const { tenant } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const {
    id,
    title,
    description = "",
    status = "todo",
    priority = "medium",
    owner = "",
    dueDate = null,
    project = "",
    stage = "",
    type = "",
    stakeholder = "",
  } = body || {};

  if (!title) return badRequest("title is required");

  const taskId = id || crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO tasks (
      id, tenantId, title, description, status, priority,
      owner, dueDate, project, stage, type, stakeholder,
      sortOrder, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      taskId,
      tenant.tenantId,
      title,
      description,
      status,
      priority,
      owner,
      dueDate,
      project,
      stage,
      type,
      stakeholder,
      0,
      now,
      now
    )
    .run();

  return json({ ok: true, id: taskId });
}

export async function onRequestPut(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { env, request } = context;
  const { tenant } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { id, ...patch } = body || {};
  if (!id) return badRequest("id is required");

  // Basic guard: ensure task belongs to tenant
  const existing = await env.DB.prepare(
    `SELECT id, tenantId FROM tasks WHERE id = ? LIMIT 1`
  )
    .bind(id)
    .first();

  if (!existing) return badRequest("Task not found");
  if (existing.tenantId !== tenant.tenantId) return forbidden("Wrong tenant");

  const now = new Date().toISOString();

  // Build dynamic update
  const allowed = [
    "title",
    "description",
    "status",
    "priority",
    "owner",
    "dueDate",
    "project",
    "stage",
    "type",
    "stakeholder",
    "sortOrder",
  ];

  const fields = [];
  const values = [];

  for (const k of allowed) {
    if (k in patch) {
      fields.push(`${k} = ?`);
      values.push(patch[k]);
    }
  }

  fields.push(`updatedAt = ?`);
  values.push(now);

  if (fields.length === 1) return badRequest("No updatable fields provided");

  values.push(id);

  await env.DB.prepare(
    `UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`
  )
    .bind(...values)
    .run();

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { env, request } = context;
  const { tenant } = auth;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return badRequest("id query param required");

  const existing = await env.DB.prepare(
    `SELECT id, tenantId FROM tasks WHERE id = ? LIMIT 1`
  )
    .bind(id)
    .first();

  if (!existing) return json({ ok: true }); // idempotent delete
  if (existing.tenantId !== tenant.tenantId) return forbidden("Wrong tenant");

  await env.DB.prepare(`DELETE FROM tasks WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}