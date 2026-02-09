export async function onRequest({ request }) {
  const email =
    request.headers.get("Cf-Access-Authenticated-User-Email") ||
    request.headers.get("cf-access-authenticated-user-email") ||
    "";

  // IMPORTANT: Do NOT redirect. Return 401 JSON instead (prevents fetch CORS redirect issues)
  if (!email) {
    return new Response(JSON.stringify({ email: "", authenticated: false }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  }

  return new Response(JSON.stringify({ email, authenticated: true }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}