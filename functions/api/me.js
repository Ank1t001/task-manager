export async function onRequest(context) {
  const email =
    context.request.headers.get("Cf-Access-Authenticated-User-Email") ||
    context.request.headers.get("cf-access-authenticated-user-email") ||
    "";

  // If not authenticated, Access will usually block before this.
  // But if Access is misconfigured, return empty string safely.
  return new Response(JSON.stringify({ email }), {
    headers: { "content-type": "application/json" },
  });
}
