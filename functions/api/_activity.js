import { json } from "./_auth";

export function nowIso() {
  return new Date().toISOString();
}

export function uid() {
  // good-enough id for D1 rows (no crypto dependency)
  return globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

/**
 * Writes to audit_log table (already in your DB list).
 * If your table schema differs, update the INSERT column list accordingly.
 */
export async function writeAudit(env, entry) {
  const {
    tenantId,
    actorUserId = "",
    actorEmail = "",
    actorName = "",
    action,
    entityType = "",
    entityId = "",
    summary,
    meta = "",
  } = entry;

  await env.DB.prepare(
    `INSERT INTO audit_log
     (id, tenantId, actorUserId, actorEmail, actorName, action, entityType, entityId, summary, meta, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      uid(),
      tenantId,
      actorUserId,
      actorEmail,
      actorName,
      action,
      entityType,
      entityId,
      summary,
      typeof meta === "string" ? meta : JSON.stringify(meta || {}),
      nowIso()
    )
    .run();
}

export async function logActivity(env, entry) {
  // alias so older code keeps working
  return writeAudit(env, entry);
}

/**
 * Optional endpoint helper if you expose /api/activity
 */
export function ok(body = { ok: true }) {
  return json(body, 200);
}