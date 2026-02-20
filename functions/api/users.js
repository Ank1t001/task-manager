// functions/api/users.js
import { requireAuth, json, badRequest, forbidden } from "./_auth";

const isoNow = () => new Date().toISOString();
const VALID_ROLES = ["admin", "manager", "member", "viewer"];

// GET /api/users — list all tenant members (admin only)
export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { tenant } = auth;

  if (tenant.role !== "admin") return forbidden("Admin only");

  const rows = await context.env.DB
    .prepare(`SELECT id, userId, name, email, role, createdAt FROM tenant_members WHERE tenantId = ? ORDER BY name ASC`)
    .bind(tenant.tenantId).all();

  return json({ users: rows.results || [] });
}

// PUT /api/users — update a member's role (admin only)
export async function onRequestPut(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { user, tenant } = auth;

  if (tenant.role !== "admin") return forbidden("Admin only");

  const body = await context.request.json().catch(() => null);
  const targetEmail = String(body?.email || "").trim().toLowerCase();
  const newRole     = String(body?.role  || "").trim().toLowerCase();

  if (!targetEmail) return badRequest("email is required");
  if (!VALID_ROLES.includes(newRole)) return badRequest(`role must be one of: ${VALID_ROLES.join(", ")}`);

  // Prevent admin from demoting themselves
  const myEmail = (user.email || tenant.memberEmail || "").toLowerCase();
  if (targetEmail === myEmail && newRole !== "admin") {
    return badRequest("You cannot change your own admin role");
  }

  const db = context.env.DB;
  const member = await db.prepare(`SELECT id FROM tenant_members WHERE tenantId = ? AND lower(email) = ? LIMIT 1`)
    .bind(tenant.tenantId, targetEmail).first();

  if (!member) return badRequest("User not found in this tenant");

  await db.prepare(`UPDATE tenant_members SET role = ? WHERE id = ?`)
    .bind(newRole, member.id).run();

  return json({ ok: true, email: targetEmail, role: newRole });
}

// POST /api/users — invite a new member (admin only)
export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { tenant } = auth;

  if (tenant.role !== "admin") return forbidden("Admin only");

  const body  = await context.request.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const name  = String(body?.name  || "").trim();
  const role  = String(body?.role  || "member").trim().toLowerCase();

  if (!email) return badRequest("email is required");
  if (!name)  return badRequest("name is required");
  if (!VALID_ROLES.includes(role)) return badRequest(`role must be one of: ${VALID_ROLES.join(", ")}`);

  const db = context.env.DB;

  // Check if already exists
  const existing = await db.prepare(`SELECT id FROM tenant_members WHERE tenantId = ? AND lower(email) = ? LIMIT 1`)
    .bind(tenant.tenantId, email).first();
  if (existing) return badRequest("User with this email already exists");

  await db.prepare(`INSERT INTO tenant_members (id, tenantId, userId, name, email, role, createdAt) VALUES (?, ?, '', ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), tenant.tenantId, name, email, role, isoNow()).run();

  return json({ ok: true, email, name, role });
}

// DELETE /api/users?email=xxx — remove a member (admin only)
export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { user, tenant } = auth;

  if (tenant.role !== "admin") return forbidden("Admin only");

  const url         = new URL(context.request.url);
  const targetEmail = (url.searchParams.get("email") || "").trim().toLowerCase();
  if (!targetEmail) return badRequest("email is required");

  const myEmail = (user.email || tenant.memberEmail || "").toLowerCase();
  if (targetEmail === myEmail) return badRequest("You cannot remove yourself");

  const db = context.env.DB;
  await db.prepare(`DELETE FROM tenant_members WHERE tenantId = ? AND lower(email) = ?`)
    .bind(tenant.tenantId, targetEmail).run();

  return json({ ok: true });
}