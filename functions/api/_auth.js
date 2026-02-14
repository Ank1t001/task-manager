// functions/api/_auth.js
const ADMIN_EMAIL = "ankit@digijabber.com";

const TEAM_MAP = {
  "ankit@digijabber.com": "Ankit",
  "ankit@equiton.com": "Ankit",
  "sheel@equiton.com": "Sheel",
  "sheelp@equiton.com": "Sheel",
  "aditi@equiton.com": "Aditi",
  "jacob@equiton.com": "Jacob",
  "vanessa@equiton.com": "Vanessa",
  "mandeep@equiton.com": "Mandeep",
};

function normalizeEmail(v = "") {
  return String(v).trim().toLowerCase();
}

export function getUser(context) {
  const email =
    context.request.headers.get("Cf-Access-Authenticated-User-Email") ||
    context.request.headers.get("cf-access-authenticated-user-email") ||
    "";

  const norm = normalizeEmail(email);
  const isAdmin = norm === normalizeEmail(ADMIN_EMAIL);
  const name = TEAM_MAP[norm] || (norm ? norm.split("@")[0] : "Unknown");

  return { email: norm, name, isAdmin };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function badRequest(message) {
  return json({ error: message }, 400);
}

export function unauthorized(message = "Unauthorized") {
  return json({ error: message }, 401);
}

export function forbidden(message = "Forbidden") {
  return json({ error: message }, 403);
}