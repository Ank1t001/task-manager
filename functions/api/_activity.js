import { json } from "./_auth";

export function nowIso() {
  return new Date().toISOString();
}

export function uid() {
  // Cloudflare Workers supports crypto.randomUUID()
  return crypto.randomUUID();
}

/**
 * Write into D1 audit_log table.
 * Table: audit_log(id, tenantId, actorEmail, actorName, action, summary, meta, createdAt)
 */
export async function writeAudit(env, row) {
  const createdAt = row.createdAt || nowIso();
  await env.DB.prepare(
    `INSERT INTO audit_log (id, tenantId, actorEmail, actorName, action, summary, meta, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      row.id || uid(),
      row.tenantId || "",
      row.actorEmail || "",
      row.actorName || "",
      row.action || "",
      row.summary || "",
      row.meta || "",
      createdAt
    )
    .run();
}

export async function logActivity(env, { tenantId, actorEmail, actorName, action, summary, meta }) {
  await writeAudit(env, { tenantId, actorEmail, actorName, action, summary, meta });
}

export { json };