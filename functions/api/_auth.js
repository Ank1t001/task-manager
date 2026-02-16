cat > functions/api/_auth.js <<'EOF'
import { jwtVerify, createRemoteJWKSet } from "jose";

/** Extract Bearer token from Authorization header */
export function getAuthHeader(request) {
  const h =
    request.headers.get("Authorization") ||
    request.headers.get("authorization") ||
    "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** JSON response helper */
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data ?? null), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export function badRequest(message = "Bad Request") {
  return json({ error: message }, 400);
}

export function unauthorized(message = "Unauthorized") {
  return json({ error: message }, 401, { "www-authenticate": "Bearer" });
}

export function forbidden(message = "Forbidden") {
  return json({ error: message }, 403);
}

/**
 * Verify JWT + attach tenant membership (tenantId/role) from D1 tenant_members.
 * Returns null if not logged in / token invalid.
 */
export async function getUser(request, env) {
  try {
    const token = getAuthHeader(request);
    if (!token) return null;

    const domain = env.AUTH0_DOMAIN;
    const audience = env.AUTH0_AUDIENCE;
    const issuer = env.AUTH0_ISSUER || (domain ? `https://${domain}/` : null);

    if (!domain || !audience || !issuer) {
      throw new Error("Missing AUTH0_DOMAIN / AUTH0_AUDIENCE / AUTH0_ISSUER");
    }

    const jwks = createRemoteJWKSet(
      new URL(`https://${domain}/.well-known/jwks.json`)
    );

    const { payload } = await jwtVerify(token, jwks, { issuer, audience });

    const email = (payload.email || "").toString();
    const name = (payload.name || payload.nickname || email || "User").toString();
    const sub = (payload.sub || "").toString();

    let tenantId = null;
    let role = null;

    if (env.DB && (email || sub)) {
      const emailLower = email.trim().toLowerCase();

      const member = await env.DB
        .prepare(
          `SELECT tenantId, role
           FROM tenant_members
           WHERE lower(email) = ? OR userId = ?
           LIMIT 1`
        )
        .bind(emailLower, sub)
        .first();

      if (member) {
        tenantId = member.tenantId;
        role = member.role;
      }
    }

    return { sub, email, name, tenantId, role, claims: payload };
  } catch (err) {
    console.log("getUser() error:", err?.message || err);
    return null;
  }
}
EOF
