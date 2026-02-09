export async function onRequest({ request }) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || "/";
  return Response.redirect(returnTo, 302);
}