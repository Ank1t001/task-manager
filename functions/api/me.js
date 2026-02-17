import { getUser, unauthorized } from "./_auth";

export async function onRequest(context) {
  const user = await getUser(context.request, context.env);
  if (!user) return unauthorized();
  return Response.json({ ok: true, user });
}
