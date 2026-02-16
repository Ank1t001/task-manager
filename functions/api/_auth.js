// functions/api/_auth.js
import { createRemoteJWKSet, jwtVerify } from "jose";

const text = (data, status = 200, headers = {}) =>
  new Response(data, { status, headers });

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

export const badRequest = (message = "Bad Request", extra = {}) =>
  json({ error: message, ...extra }, 400);

export const unauthorized = (message = "Unauthorized", extra = {}) =>
  json({ error: message, ...extra }, 401);

export const forbidden = (message = "Forbidden", extra = {}) =>
  json({ error: message, ...extra }, 403);

function getBearerToken(request) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function requiredEnv(env, key) {
  const v = env?.[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

async function verifyAccessToken(token, env) {
  const issuer = requiredEnv(env, "AUTH0_ISSUER"); // e.g. https://taskmanager.ca.auth0.com/
  const audience = requiredEnv(env, "AUTH0_AUDIENCE"); // e.g. https://task-manager-user/api
  const jwks = createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`));

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience,
  });

  return payload;
}

/**
 * Returns:
 * {
 *   sub, email, name, tenantId, role, userId
 * }
 */
export async function getUser(request, env, ctx = {}) {
  const token = getBearerToken(request);
  if (!token) return null;

  let payload;
  try {
    payload = await verifyAccessToken(token, env);
  } catch (e) {
    // Invalid token
    return null;
  }

  const sub = payload.sub;
  const email =
    payload.email ||
    payload["https://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"];

  const name = payload.name || payload.nickname || email || "User";

  if (!email) {
    // Token valid but no email claim
    return { sub, email: null, name, tenantId: null, role: null, userId: sub };
  }

  // Lookup membership in D1
  const row = await env.DB.prepare(
    `SELECT tenantId, role, userId, name, email
     FROM tenant_members
     WHERE lower(email)=lower(?)
     LIMIT 1`
  )
    .bind(email)
    .first();

  if (!row) {
    return { sub, email, name, tenantId: null, role: null, userId: sub };
  }

  return {
    sub,
    email: row.email || email,
    name: row.name || name,
    tenantId: row.tenantId,
    role: row.role,
    userId: row.userId || sub,
  };
}

/**
 * For endpoints that must be logged in (and tenant membership must exist).
 */
export async function requireAuth(request, env) {
  const user = await getUser(request, env);
  if (!user) return { ok: false, response: unauthorized() };

  if (!user.tenantId) {
    return {
      ok: false,
      response: forbidden("No tenant assigned to this user yet."),
    };
  }

  return { ok: true, user };
}