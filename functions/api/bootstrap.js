import { requireAuth, json, badRequest } from "./_auth";
import { nowIso, uid, writeAudit } from "./_activity";

export const onRequestPost = async (context) => {
  // ✅ allow users with no tenant (bootstrap is what creates it)
  const auth = await requireAuth(context, null, { allowNoTenant: true });
  if (!auth.ok) return auth.res;

  const { sub, email, name, orgId } = auth.user;

  // ✅ If using Auth0 Organizations, tenantId should be orgId
  // In that case, _auth.js already auto-upserts tenant + membership.
  if (orgId) {
    return json({ tenantId: orgId, created: false, mode: "org" });
  }

  // Non-org fallback: create a personal workspace tenant
  const body = await context.request.json().catch(() => ({}));
  const requestedName = (body?.name || "My Workspace").toString().trim();
  if (!requestedName) return badRequest("name is required");

  const tenantId = uid();
  const memberId = uid();
  const now = nowIso();

  await context.env.DB.batch([
    context.env.DB.prepare(`INSERT INTO tenants (id, name, createdAt) VALUES (?, ?, ?)`)
      .bind(tenantId, requestedName, now),

    context.env.DB.prepare(
      `INSERT INTO tenant_members (id, tenantId, userId, email, name, role, createdAt)
       VALUES (?, ?, ?, ?, ?, 'owner', ?)`
    )
      .bind(memberId, tenantId, sub, email || "", name || "", now),
  ]);

  await writeAudit(context.env, {
    tenantId,
    actorUserId: sub,
    actorEmail: email || "",
    actorName: name || "",
    action: "TENANT_CREATED",
    entityType: "tenant",
    entityId: tenantId,
    summary: `Tenant created: ${requestedName}`,
  });

  return json({ tenantId, created: true, mode: "personal" });
};