import { requireAuth, json } from "./_auth";
import { nowIso, uid, writeAudit } from "./_activity";

export const onRequestPost = async (context) => {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth.res;

  const { userId, email, name } = auth.user;

  const body = await context.request.json().catch(() => ({}));
  const requestedName = (body?.name || "My Workspace").toString().trim();

  // 1) Already member?
  const existing = await context.env.DB.prepare(
    `SELECT tenantId, role FROM tenant_members WHERE userId = ? LIMIT 1`
  )
    .bind(userId)
    .first();

  if (existing?.tenantId) {
    return json({ tenantId: existing.tenantId, role: existing.role, created: false });
  }

  // 2) Create tenant + membership (owner)
  const tenantId = uid();
  const memberId = uid();

  await context.env.DB.batch([
    context.env.DB.prepare(`INSERT INTO tenants (id, name, createdAt) VALUES (?, ?, ?)`).bind(
      tenantId,
      requestedName,
      nowIso()
    ),
    context.env.DB.prepare(
      `INSERT INTO tenant_members (id, tenantId, userId, email, name, role, createdAt)
       VALUES (?, ?, ?, ?, ?, 'owner', ?)`
    ).bind(memberId, tenantId, userId, email || "", name || "", nowIso()),
  ]);

  await writeAudit(context.env, {
    tenantId,
    actorUserId: userId,
    actorEmail: email || "",
    actorName: name || "",
    action: "TENANT_CREATED",
    entityType: "tenant",
    entityId: tenantId,
    summary: `Tenant created: ${requestedName}`,
  });

  return json({ tenantId, role: "owner", created: true });
};