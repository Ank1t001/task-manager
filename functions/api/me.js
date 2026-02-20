// functions/api/me.js
import { requireAuth, json } from "./_auth";

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { user, tenant } = auth;

  return json({
    user: {
      sub:   user.sub,
      email: user.email,
      name:  user.name,
    },
    tenant: {
      tenantId:   tenant.tenantId,
      tenantName: tenant.tenantName,
      role:       tenant.role,
      memberName: tenant.memberName,
      memberEmail: tenant.memberEmail,
    },
  });
}