// functions/api/comments.js
import { requireAuth, json, badRequest, forbidden } from "./_auth";

const isoNow = () => new Date().toISOString();

// GET /api/comments?taskId=xxx
export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { tenant } = auth;

  const url = new URL(context.request.url);
  const taskId = (url.searchParams.get("taskId") || "").trim();
  if (!taskId) return badRequest("taskId is required");

  const rows = await context.env.DB
    .prepare(`SELECT * FROM task_comments WHERE taskId = ? AND tenantId = ? ORDER BY createdAt ASC`)
    .bind(taskId, tenant.tenantId).all();

  return json({ comments: rows.results || [] });
}

// POST /api/comments
export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { user, tenant } = auth;

  const body = await context.request.json().catch(() => null);
  const taskId = String(body?.taskId || "").trim();
  const text   = String(body?.body   || "").trim();
  if (!taskId) return badRequest("taskId is required");
  if (!text)   return badRequest("body is required");

  const db = context.env.DB;

  // Verify task belongs to tenant
  const task = await db.prepare(`SELECT id, tenantId, taskName, assignedToEmail, ownerEmail FROM tasks WHERE id = ? LIMIT 1`).bind(taskId).first();
  if (!task) return badRequest("Task not found");
  if (task.tenantId !== tenant.tenantId) return forbidden("Wrong tenant");

  const id  = crypto.randomUUID();
  const now = isoNow();
  const authorName  = user.name  || tenant.memberName  || "";
  const authorEmail = user.email || tenant.memberEmail || "";

  await db.prepare(`
    INSERT INTO task_comments (id, taskId, tenantId, authorName, authorEmail, body, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, taskId, tenant.tenantId, authorName, authorEmail, text, now).run();

  // Create notification for task owner/assignee (not self)
  const notifyEmails = new Set([task.assignedToEmail, task.ownerEmail].filter(Boolean));
  notifyEmails.delete(authorEmail);
  for (const recipientEmail of notifyEmails) {
    await db.prepare(`
      INSERT INTO notifications (id, tenantId, recipientEmail, type, message, taskId, read, createdAt)
      VALUES (?, ?, ?, 'comment', ?, ?, 0, ?)
    `).bind(crypto.randomUUID(), tenant.tenantId, recipientEmail,
      `${authorName || authorEmail} commented on "${task.taskName}"`, taskId, now).run();
  }

  return json({ ok: true, comment: { id, taskId, authorName, authorEmail, body: text, createdAt: now } });
}

// DELETE /api/comments?id=xxx
export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { user, tenant } = auth;

  const url = new URL(context.request.url);
  const id = (url.searchParams.get("id") || "").trim();
  if (!id) return badRequest("id is required");

  const db  = context.env.DB;
  const row = await db.prepare(`SELECT * FROM task_comments WHERE id = ? LIMIT 1`).bind(id).first();
  if (!row) return json({ ok: true });
  if (row.tenantId !== tenant.tenantId) return forbidden("Wrong tenant");

  const myEmail = user.email || tenant.memberEmail || "";
  const isAdmin = tenant.role === "admin";
  if (!isAdmin && row.authorEmail !== myEmail) return forbidden("Can only delete your own comments");

  await db.prepare(`DELETE FROM task_comments WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}