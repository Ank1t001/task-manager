export async function onRequest(context) {
  const url = new URL(context.request.url);
  const returnTo = url.searchParams.get("returnTo") || "/";

  // After Access login succeeds, redirect user back to app
  return Response.redirect(returnTo, 302);
}
