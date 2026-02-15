import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * JSON response helper
 */
export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export const badRequest = (msg = "Bad Request") => json({ error: msg }, 400);
export const unauthorized = (msg = "Unauthorized") => json({ error: msg }, 401);
export const forbidden = (msg = "Forbidden") => json({ error: msg }, 403);

function getBearer(request) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

async function verifyAccessToken(request, env) {
  const token = getBearer(request);
  if (!token) return { ok: false, status: 401, body: { error: "Unauthorized" } };

  const domain = env.AUTH0_DOMAIN;
  const issuer = env.AUTH0_ISSUER;
  const audience = env.AUTH0_AUDIENCE;

  if (!domain || !issuer || !audience) {
    return {
      ok: false,
      status: 500,
      body: { error: "Auth0 env vars missing on backend" },
    };
  }

  const jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
    });

    const userId = payload.sub || "";
    const email = payload.email || "";
    const name = payload.name || payload.nickname || email || "User";

    return { ok: true, payload, user: { userId, email, name } };
  } catch (e) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
}

/**
 * requireAuth:
 * - Valid token required
 * - tenant membership optional (bootstrap can create it)
 */
export async function requireAuth(request, env) {
  const v = await verifyAccessToken(request, env);
  if (!v.ok) return v;

  const { userId, email, name } = v.user;

  // membership optional
  const member = await env.DB.prepare(
    `SELECT tenantId, role FROM tenant_members WHERE userId = ? LIMIT 1`
  )
    .bind(userId)
    .first();

  return {
    ok: true,
    user: { userId, email, name },
    tenantId: member?.tenantId || null,
    role: member?.role || "member",
  };
}

/**
 * getUser:
 * - Valid token required
 * - tenant membership required (most endpoints)
 */
export async function getUser(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth;

  if (!auth.tenantId) {
    return {
      ok: false,
      status: 403,
      body: { error: "No tenant yet. Call POST /api/tenants/bootstrap first." },
    };
  }

  return auth;
}