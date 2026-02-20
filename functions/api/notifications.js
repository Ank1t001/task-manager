// functions/api/notifications.js
import { requireAuth, json, badRequest, forbidden } from "./_auth";

const isoNow = () => new Date().toISOString();

// GET /api/notifications — get mine (unread first)
export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { user, tenant } = auth;

  const email = user.email || tenant.memberEmail || "";
  if (!email) return badRequest("No email on token");

  const rows = await context.env.DB
    .prepare(`SELECT * FROM notifications WHERE tenantId = ? AND recipientEmail = ? ORDER BY createdAt DESC LIMIT 50`)
    .bind(tenant.tenantId, email).all();

  const all     = rows.results || [];
  const unread  = all.filter(n => !n.read).length;
  return json({ notifications: all, unreadCount: unread });
}

// PUT /api/notifications — mark read
export async function onRequestPut(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { user, tenant } = auth;

  const body  = await context.request.json().catch(() => ({}));
  const email = user.email || tenant.memberEmail || "";
  const db    = context.env.DB;

  if (body.markAllRead) {
    await db.prepare(`UPDATE notifications SET read = 1 WHERE tenantId = ? AND recipientEmail = ?`)
      .bind(tenant.tenantId, email).run();
    return json({ ok: true });
  }

  const id = String(body.id || "").trim();
  if (!id) return badRequest("id or markAllRead required");

  const row = await db.prepare(`SELECT * FROM notifications WHERE id = ? LIMIT 1`).bind(id).first();
  if (!row) return json({ ok: true });
  if (row.tenantId !== tenant.tenantId || row.recipientEmail !== email) return forbidden("Not yours");

  await db.prepare(`UPDATE notifications SET read = 1 WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}