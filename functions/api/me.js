import { getUser, json, unauthorized } from "./_auth";

export async function onRequestGet(context) {
  const user = await getUser(context.request, context.env);
  if (!user) return unauthorized();
  return json({ email: user.email, name: user.name, sub: user.sub });
}