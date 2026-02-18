import { requireAuth, json } from "./_auth";

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { user, tenant } = auth;

  return json({
    user: {
      sub: user.sub,
      email: user.email,
      name: user.name,
      org_id: user.org_id,
      org_name: user.org_name,
    },
    tenant: {
      id: tenant.tenantId,
      name: tenant.tenantName,
      role: tenant.role,
    },
  });
}