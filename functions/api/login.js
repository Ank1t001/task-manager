export async function onRequest({ request }) {
  const url = new URL(request.url);

  // where to land after successful login
  const redirectTo = url.searchParams.get("redirectTo") || "/";

  // Once Access authenticates the user, they will be returned to this same URL
  // Then this function will run and redirect to your app.
  return Response.redirect(redirectTo, 302);
}