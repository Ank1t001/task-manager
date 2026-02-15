import { getUser, json } from "./_auth";

export const onRequestGet = async ({ request, env }) => {
  const auth = await getUser(request, env);
  if (!auth.ok) return json(auth.body, auth.status);

  return json({
    user: auth.user,
    tenantId: auth.tenantId,
    role: auth.role,
  });
};