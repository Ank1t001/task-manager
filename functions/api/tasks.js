// functions/api/tasks.js
import { requireAuth, json, badRequest } from "./_auth";

/**
 * Expected schema fields (typical):
 * - tasks(id, tenantId, title, description, status, priority, owner, due, project, stage, stakeholders, createdAt, updatedAt)
 */

export const onRequestGet = async (context) => {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth.res;

  const { tenantId } = auth.user;

  const rows = await context.env.DB.prepare(
    `SELECT *
     FROM tasks
     WHERE tenantId = ?
     ORDER BY
       CASE status
         WHEN 'Overdue' THEN 1
         WHEN 'In Progress' THEN 2
         WHEN 'Done' THEN 3
         ELSE 4
       END,
       due IS NULL,
       due ASC,
       updatedAt DESC`
  )
    .bind(tenantId)
    .all();

  return json({ tasks: rows.results || [] });
};

export const onRequestPost = async (context) => {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth.res;

  const { tenantId, email } = auth.user;
  const body = await context.request.json().catch(() => null);
  if (!body?.title) return badRequest("Missing title");

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const task = {
    id,
    tenantId,
    title: String(body.title || "").trim(),
    description: String(body.description || "").trim(),
    status: body.status || "In Progress",
    priority: body.priority || "Medium",
    owner: body.owner || email || "",
    due: body.due || null,
    project: body.project || "",
    stage: body.stage || "",
    stakeholders: body.stakeholders || "",
    createdAt: now,
    updatedAt: now,
    type: body.type || "",
  };

  await context.env.DB.prepare(
    `INSERT INTO tasks
      (id, tenantId, title, description, status, priority, owner, due, project, stage, stakeholders, createdAt, updatedAt, type)
     VALUES
      (?,  ?,       ?,     ?,          ?,      ?,        ?,     ?,   ?,       ?,     ?,            ?,         ?,        ?)`
  )
    .bind(
      task.id,
      task.tenantId,
      task.title,
      task.description,
      task.status,
      task.priority,
      task.owner,
      task.due,
      task.project,
      task.stage,
      task.stakeholders,
      task.createdAt,
      task.updatedAt,
      task.type
    )
    .run();

  return json({ task });
};

export const onRequestPatch = async (context) => {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth.res;

  const { tenantId } = auth.user;
  const id = context.params?.id;
  if (!id) return badRequest("Missing task id");

  const body = await context.request.json().catch(() => null);
  if (!body) return badRequest("Missing body");

  const now = new Date().toISOString();

  // Only update known fields
  const fields = [
    "title",
    "description",
    "status",
    "priority",
    "owner",
    "due",
    "project",
    "stage",
    "stakeholders",
    "type",
  ];

  const updates = [];
  const values = [];

  for (const f of fields) {
    if (f in body) {
      updates.push(`${f} = ?`);
      values.push(body[f]);
    }
  }

  updates.push(`updatedAt = ?`);
  values.push(now);

  if (updates.length === 1) return badRequest("No valid fields to update");

  await context.env.DB.prepare(
    `UPDATE tasks
     SET ${updates.join(", ")}
     WHERE id = ? AND tenantId = ?`
  )
    .bind(...values, id, tenantId)
    .run();

  const updated = await context.env.DB.prepare(`SELECT * FROM tasks WHERE id = ? AND tenantId = ?`)
    .bind(id, tenantId)
    .first();

  return json({ task: updated });
};

export const onRequestDelete = async (context) => {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth.res;

  const { tenantId } = auth.user;
  const id = context.params?.id;
  if (!id) return badRequest("Missing task id");

  await context.env.DB.prepare(`DELETE FROM tasks WHERE id = ? AND tenantId = ?`).bind(id, tenantId).run();

  return json({ ok: true });
};