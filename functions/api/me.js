const ADMIN_EMAIL = "ankit@digijabber.com";

export async function onRequest(context) {
  const email =
    context.request.headers.get("Cf-Access-Authenticated-User-Email") ||
    context.request.headers.get("cf-access-authenticated-user-email") ||
    "";

  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(JSON.stringify({ email }), {
    headers: { "content-type": "application/json" },
  });
}
