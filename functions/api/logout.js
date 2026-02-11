export async function onRequest({ request }) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || (url.origin + "/");

  // ✅ Use your Access TEAM domain logout (works reliably on pages.dev)
  const accessLogout =
    `https://equiton.cloudflareaccess.com/cdn-cgi/access/logout?returnTo=${encodeURIComponent(returnTo)}`;

  return Response.redirect(accessLogout, 302);
}