export async function onRequest(context) {
  const email =
    context.request.headers.get("Cf-Access-Authenticated-User-Email") ||
    context.request.headers.get("cf-access-authenticated-user-email") ||
    "";

  return new Response(JSON.stringify({ email }), {
    headers: { "content-type": "application/json" },
  });
}

git add .
git commit -m "Add /api/me for Access email role detection"
git push


git add .
git commit -m "Add /api/me for Access email role detection"
git push

git add .
git commit -m "Add /api/me for Access email role detection"
git push


