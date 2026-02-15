export function nowIso() {
  return new Date().toISOString();
}

export function uid() {
  // Good enough unique id for D1 rows
  return crypto.randomUUID();
}

export async function writeAudit(env, entry) {
  // audit_log table is already in your D1 list
  const id = uid();
  const createdAt = nowIso();

  const {
    tenantId,
    actorUserId = "",
    actorEmail = "",
    actorName = "",
    action,
    entityType = "",
    entityId = "",
    summary = "",
    meta = ""
  } = entry;

  await env.DB.prepare(
    `INSERT INTO audit_log (id, tenantId, actorUserId, actorEmail, actorName, action, entityType, entityId, summary, meta, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, tenantId, actorUserId, actorEmail, actorName, action, entityType, entityId, summary, meta, createdAt)
    .run();

  return { id, createdAt };
}

// Backwards compat with your older code
export async function logActivity(env, entry) {
  return writeAudit(env, entry);
}