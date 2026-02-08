export async function onRequest() {
  // This endpoint is protected by Access because it is under /api/*
  // After successful login, redirect user back to the homepage.
  return Response.redirect("/", 302);
}
