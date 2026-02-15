// functions/api/me.js
import { getUser, json, unauthorized } from "./_auth";

export async function onRequestGet(context) {
  const user = await getUser(context);
  if (!user.email) return unauthorized();

  return json({
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    tenantId: user.tenantId,
  });
}