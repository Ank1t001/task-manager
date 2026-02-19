import { requireAuth, json, badRequest, forbidden } from "./_auth";

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { env } = context;
  const { tenant } = auth;

  const url = new URL(context.request.url);
  const projectName = (url.searchParams.get("projectName") || "").trim();

  const sql = projectName
    ? `SELECT * FROM tasks WHERE tenantId = ? AND projectName = ? ORDER BY sortOrder ASC, createdAt DESC`
    : `SELECT * FROM tasks WHERE tenantId = ? ORDER BY sortOrder ASC, createdAt DESC`;

  const rows = projectName
    ? await env.DB.prepare(sql).bind(tenant.tenantId, projectName).all()
    : await env.DB.prepare(sql).bind(tenant.tenantId).all();

  return json({ tasks: rows.results || [] });
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { env, request } = context;
  const { user, tenant } = auth;

  let body;
  try { body = await request.json(); }
  catch { return badRequest("Invalid JSON body"); }

  const {
    id,
    title,
    taskName,
    description = "",
    status = "To Do",
    priority = "Medium",
    owner = "",
    ownerEmail = "",
    dueDate = null,
    project = "",
    projectName = "",
    stage = "",
    type = "Other",
    section = "",
    stakeholder = "",
    externalStakeholders = "",
    assignedTo = "",
    assignedToEmail = "",
  } = body || {};

  // Accept either field name
  const resolvedTaskName = (taskName || title || "").trim();
  const resolvedProject  = (projectName || project || "").trim();
  const resolvedType     = (type || section || "Other").trim();
  const resolvedStakeholder = (externalStakeholders || stakeholder || "").trim();
  const resolvedOwnerEmail = (ownerEmail || user.email || "").trim().toLowerCase();

  if (!resolvedTaskName) return badRequest("taskName is required");

  const taskId = id || crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO tasks (
      id, tenantId, taskName, description, status, priority,
      owner, ownerEmail, dueDate, projectName, stage, type, externalStakeholders,
      assignedTo, assignedToEmail,
      sortOrder, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    taskId, tenant.tenantId,
    resolvedTaskName, description, status, priority,
    owner, resolvedOwnerEmail,
    dueDate || null, resolvedProject, stage,
    resolvedType, resolvedStakeholder,
    assignedTo.trim(), assignedToEmail.trim().toLowerCase(),
    0, now, now
  ).run();

  return json({ ok: true, id: taskId });
}

export async function onRequestPut(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { env, request } = context;
  const { tenant } = auth;

  let body;
  try { body = await request.json(); }
  catch { return badRequest("Invalid JSON body"); }

  const { id, ...patch } = body || {};
  if (!id) return badRequest("id is required");

  const existing = await env.DB.prepare(`SELECT id, tenantId FROM tasks WHERE id = ? LIMIT 1`).bind(id).first();
  if (!existing) return badRequest("Task not found");
  if (existing.tenantId !== tenant.tenantId) return forbidden("Wrong tenant");

  const now = new Date().toISOString();

  // Map any legacy field names to actual DB column names
  const fieldMap = {
    title:                "taskName",
    taskName:             "taskName",
    description:          "description",
    status:               "status",
    priority:             "priority",
    owner:                "owner",
    ownerEmail:           "ownerEmail",
    dueDate:              "dueDate",
    project:              "projectName",
    projectName:          "projectName",
    stage:                "stage",
    type:                 "type",
    section:              "type",
    stakeholder:          "externalStakeholders",
    externalStakeholders: "externalStakeholders",
    assignedTo:           "assignedTo",
    assignedToEmail:      "assignedToEmail",
    sortOrder:            "sortOrder",
  };

  const fields = [];
  const values = [];
  const seen = new Set();

  for (const [k, dbCol] of Object.entries(fieldMap)) {
    if (k in patch && !seen.has(dbCol)) {
      seen.add(dbCol);
      fields.push(`${dbCol} = ?`);
      values.push(patch[k]);
    }
  }

  if (fields.length === 0) return badRequest("No updatable fields provided");
  fields.push(`updatedAt = ?`);
  values.push(now);
  values.push(id);

  await env.DB.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
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

  const existing = await env.DB.prepare(`SELECT id, tenantId FROM tasks WHERE id = ? LIMIT 1`).bind(id).first();
  if (!existing) return json({ ok: true });
  if (existing.tenantId !== tenant.tenantId) return forbidden("Wrong tenant");

  await env.DB.prepare(`DELETE FROM tasks WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}