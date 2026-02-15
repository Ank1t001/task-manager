// functions/api/_activity.js

export function uid() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

/**
 * Generic audit writer used by tenant bootstrap + admin features.
 * Table: activity_log
 */
export async function writeAudit(db, entry) {
  // entry: { tenantId, projectName, taskId, actorEmail, actorName, action, summary, meta }
  const id = uid();
  const createdAt = nowIso();
  const metaStr = entry.meta ? JSON.stringify(entry.meta) : "";

  await db
    .prepare(
      `INSERT INTO activity_log (
        id, tenantId, projectName, taskId,
        actorEmail, actorName, action, summary,
        meta, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      entry.tenantId || "",
      entry.projectName || "",
      entry.taskId || "",
      entry.actorEmail || "",
      entry.actorName || "",
      entry.action || "",
      entry.summary || "",
      metaStr,
      createdAt
    )
    .run();

  return { id, createdAt };
}

/**
 * Backward-compatible name (your tasks API currently imports this)
 */
export async function logActivity(db, entry) {
  return writeAudit(db, entry);
}