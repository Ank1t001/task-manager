// functions/api/me.js
import { requireAuth, json } from "./_auth";

export const onRequestGet = async (context) => {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth.res;

  const u = auth.user;
  return json({
    userId: u.userId,
    email: u.email,
    name: u.name,
    orgId: u.orgId,
    tenantId: u.tenantId,
    role: u.role,
  });
};