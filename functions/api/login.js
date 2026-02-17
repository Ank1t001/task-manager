export async function onRequest({ request }) {
  const url = new URL(request.url);

  // Where user should land after login
  const returnTo = url.searchParams.get("returnTo") || (url.origin + "/");

  // If user is NOT authenticated, Access will intercept this request automatically
  // If user IS authenticated, we redirect them to the app root
  return Response.redirect(returnTo, 302);
}
loginWithRedirect({
  organization: "org_VzWrWJWhWcOChctX"
});