// functions/api/tasks/[id].js  — handles PUT /api/tasks/:id and DELETE /api/tasks/:id
import { requireAuth, json, badRequest, forbidden } from "../_auth";

export async function onRequestPut(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { env, request, params } = context;
  const { tenant } = auth;
  const id = params.id;
  if (!id) return badRequest("id is required");

  let body;
  try { body = await request.json(); }
  catch { return badRequest("Invalid JSON body"); }

  const existing = await env.DB.prepare(`SELECT id, tenantId FROM tasks WHERE id = ? LIMIT 1`).bind(id).first();
  if (!existing) return badRequest("Task not found");
  if (existing.tenantId !== tenant.tenantId) return forbidden("Wrong tenant");

  const now = new Date().toISOString();

  // Map any field name variant → actual DB column
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
    sortOrder:            "sortOrder",
  };

  const fields = [];
  const values = [];
  const seen = new Set();

  for (const [k, dbCol] of Object.entries(fieldMap)) {
    if (k in body && !seen.has(dbCol)) {
      seen.add(dbCol);
      fields.push(`${dbCol} = ?`);
      values.push(body[k]);
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

  const { env, params } = context;
  const { tenant } = auth;
  const id = params.id;
  if (!id) return badRequest("id is required");

  const existing = await env.DB.prepare(`SELECT id, tenantId FROM tasks WHERE id = ? LIMIT 1`).bind(id).first();
  if (!existing) return json({ ok: true }); // idempotent
  if (existing.tenantId !== tenant.tenantId) return forbidden("Wrong tenant");

  await env.DB.prepare(`DELETE FROM tasks WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}