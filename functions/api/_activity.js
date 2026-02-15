// functions/api/_activity.js
import { json } from "./_auth";

export function nowIso() {
  return new Date().toISOString();
}

export function uid() {
  // Works in Workers runtime
  return crypto.randomUUID();
}

export async function writeAudit(ctx, {
  tenantId,
  projectName = "",
  taskId = "",
  actorEmail = "",
  actorName = "",
  action = "",
  summary = "",
  meta = {},
}) {
  const createdAt = nowIso();
  const id = uid();

  await ctx.env.DB.prepare(
    `INSERT INTO activity_log
      (id, tenantId, projectName, taskId, actorEmail, actorName, action, summary, meta, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    tenantId,
    projectName,
    taskId,
    actorEmail,
    actorName,
    action,
    summary,
    JSON.stringify(meta || {}),
    createdAt
  ).run();

  return { id, createdAt };
}

export async function logActivity(ctx, user, action, summary, meta = {}) {
  const tenantId = user?.tenantId || "";
  await writeAudit(ctx, {
    tenantId,
    projectName: meta.projectName || "",
    taskId: meta.taskId || "",
    actorEmail: user?.email || "",
    actorName: user?.name || "",
    action,
    summary,
    meta,
  });
}

export async function listAudit(ctx, tenantId, limit = 200) {
  const rows = await ctx.env.DB.prepare(
    `SELECT * FROM activity_log
     WHERE tenantId = ?
     ORDER BY createdAt DESC
     LIMIT ?`
  ).bind(tenantId, limit).all();

  return rows.results || [];
}

export function ok(req, message = "ok") {
  return json(req, { ok: true, message });
}