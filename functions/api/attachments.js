// functions/api/attachments.js
// GET  /api/attachments?taskId=xxx        → list attachments for a task
// POST /api/attachments                   → get presigned upload URL
// DELETE /api/attachments?id=xxx          → delete attachment record + R2 object

import { requireAuth, json, badRequest, forbidden } from "./_auth";

const isoNow = () => new Date().toISOString();

// GET — list attachments for a task
export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const url = new URL(context.request.url);
  const taskId = (url.searchParams.get("taskId") || "").trim();
  if (!taskId) return badRequest("taskId is required");

  const rows = await context.env.DB.prepare(
    `SELECT * FROM task_attachments WHERE taskId = ? ORDER BY createdAt ASC`
  ).bind(taskId).all();

  return json({ attachments: rows.results || [] });
}

// POST — request a presigned upload URL from R2
export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { user, tenant } = auth;

  const body = await context.request.json().catch(() => null);
  const taskId   = String(body?.taskId   || "").trim();
  const fileName = String(body?.fileName || "").trim();
  const fileSize = Number(body?.fileSize || 0);
  const fileType = String(body?.fileType || "application/octet-stream").trim();

  if (!taskId)   return badRequest("taskId is required");
  if (!fileName) return badRequest("fileName is required");
  if (fileSize > 25 * 1024 * 1024) return badRequest("File too large (max 25MB)");

  const attachmentId = crypto.randomUUID();
  const r2Key = `attachments/${tenant.tenantId}/${taskId}/${attachmentId}/${fileName}`;
  const now = isoNow();

  // Check R2 binding exists
  if (!context.env.ATTACHMENTS_BUCKET) {
    return json({ error: "R2 bucket not configured (ATTACHMENTS_BUCKET binding missing)" }, { status: 500 });
  }

  // Generate presigned URL using R2 createPresignedUrl
  let uploadUrl;
  try {
    uploadUrl = await context.env.ATTACHMENTS_BUCKET.createPresignedUrl("PUT", r2Key, {
      expiresIn: 300, // 5 minutes
      httpMetadata: { contentType: fileType },
    });
  } catch (e) {
    return json({ error: "Failed to create upload URL: " + String(e?.message || e) }, { status: 500 });
  }

  // Save attachment record in DB
  await context.env.DB.prepare(`
    INSERT INTO task_attachments (id, taskId, tenantId, fileName, fileSize, fileType, r2Key, uploadedBy, uploadedByEmail, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    attachmentId, taskId, tenant.tenantId,
    fileName, fileSize, fileType, r2Key,
    user.name || tenant.memberName || "",
    user.email || tenant.memberEmail || "",
    now
  ).run();

  return json({ ok: true, attachmentId, uploadUrl, r2Key });
}

// DELETE — remove attachment from DB and R2
export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { tenant } = auth;

  const url = new URL(context.request.url);
  const id = (url.searchParams.get("id") || "").trim();
  if (!id) return badRequest("id is required");

  const row = await context.env.DB.prepare(
    `SELECT * FROM task_attachments WHERE id = ? LIMIT 1`
  ).bind(id).first();

  if (!row) return json({ ok: true }); // idempotent
  if (row.tenantId !== tenant.tenantId) return forbidden("Wrong tenant");

  // Delete from R2
  if (context.env.ATTACHMENTS_BUCKET && row.r2Key) {
    try { await context.env.ATTACHMENTS_BUCKET.delete(row.r2Key); } catch {}
  }

  // Delete from DB
  await context.env.DB.prepare(`DELETE FROM task_attachments WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}