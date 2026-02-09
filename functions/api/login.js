export async function onRequest({ request }) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || "/";
  const origin = url.origin;

  // Send user to Access team login + redirect back
  const accessLogin =
    `https://equiton.cloudflareaccess.com/cdn-cgi/access/login/task-manager-7xv?redirect_url=${encodeURIComponent(origin + returnTo)}`;

  return Response.redirect(accessLogin, 302);
}