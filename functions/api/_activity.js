import { json } from "./_auth";

export const nowIso = () => new Date().toISOString();

export const uid = () => {
  // Works in Workers runtime
  return (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).toString();
};

// Writes to audit_log table (you already have it in D1)
export async function writeAudit(env, {
  tenantId,
  actorEmail,
  actorName,
  action,
  summary,
  meta = ""
}) {
  if (!env?.DB) return;

  const id = uid();
  const createdAt = nowIso();
  await env.DB.prepare(
    `INSERT INTO audit_log (id, tenantId, actorEmail, actorName, action, summary, meta, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, tenantId, actorEmail, actorName, action, summary, meta, createdAt).run();
}

// Backwards-compatible name used by some files
export async function logActivity(env, entry) {
  return writeAudit(env, entry);
}

// Optional endpoint helper if you use it in an API route
export const ok = (data) => json(data, { status: 200 });