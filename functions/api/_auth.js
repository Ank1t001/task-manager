// functions/api/_auth.js
import { createRemoteJWKSet, jwtVerify } from "jose";

const normalize = (v = "") => String(v || "").trim().toLowerCase();

let jwks = null;

function getJwks(domain) {
  if (!jwks) {
    const url = new URL(`https://${domain}/.well-known/jwks.json`);
    jwks = createRemoteJWKSet(url);
  }
  return jwks;
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

/**
 * ✅ Verifies Auth0 access token
 * Expects env:
 *  - AUTH0_DOMAIN (e.g. taskmanager.ca.auth0.com)
 *  - AUTH0_AUDIENCE (e.g. https://task-manager/api)
 *  - AUTH0_ISSUER (e.g. https://taskmanager.ca.auth0.com/)
 */
export async function requireAuth(context) {
  const domain = context.env.AUTH0_DOMAIN;
  const audience = context.env.AUTH0_AUDIENCE;
  const issuer = context.env.AUTH0_ISSUER;

  const auth = context.request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return { ok: false, res: unauthorized("Missing Bearer token") };

  try {
    const token = m[1];
    const { payload } = await jwtVerify(token, getJwks(domain), {
      audience,
      issuer,
    });

    const email = normalize(payload.email || "");
    const name = payload.name || (email ? email.split("@")[0] : "User");

    // ✅ tenantId: prefer Organizations
    const tenantId =
      payload.org_id ||
      payload["https://task-manager/tenantId"] ||
      (email ? email.split("@")[1] : payload.sub);

    const adminEmail = normalize(context.env.ADMIN_EMAIL || "ankit@digijabber.com");
    const isAdmin = email && email === adminEmail;

    return {
      ok: true,
      user: {
        sub: payload.sub,
        email,
        name,
        tenantId: String(tenantId || ""),
        isAdmin,
        raw: payload,
      },
    };
  } catch (e) {
    return { ok: false, res: unauthorized("Invalid token") };
  }
}

// Backward compatible helper used by some handlers
export async function getUser(context) {
  const out = await requireAuth(context);
  if (!out.ok) return { email: "", name: "Unknown", tenantId: "", isAdmin: false };
  return out.user;
}