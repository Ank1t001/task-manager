// functions/api/_auth.js
import { createRemoteJWKSet, jwtVerify } from "jose";

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
  const issuer = requiredEnv(env, "AUTH0_ISSUER");     // https://xxxxx.auth0.com/
  const audience = requiredEnv(env, "AUTH0_AUDIENCE"); // https://task-manager-user/api
  const jwks = createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`));

  const { payload } = await jwtVerify(token, jwks, { issuer, audience });
  return payload;
}

/**
 * getUser() returns:
 * { sub, email, name, tenantId, role, orgId, orgName }
 *
 * If Auth0 Organizations is used, tenantId will be org_id (and we auto-upsert tenant + member).
 */
export async function getUser(request, env) {
  const token = getBearerToken(request);
  if (!token) return null;

  let payload;
  try {
    payload = await verifyAccessToken(token, env);
  } catch {
    return null;
  }

  const sub = (payload.sub || "").toString();

  // email may not exist on access tokens depending on your Auth0 config
  const email =
    (payload.email ||
      payload["https://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] ||
      "").toString();

  const name = (payload.name || payload.nickname || email || "User").toString();

  // ✅ Auth0 Organizations
  const orgId = (payload.org_id || "").toString();
  const orgName = (payload.org_name || "").toString(); // sometimes present; ok if empty

  // If org is present, treat it as the tenantId
  if (orgId && env.DB) {
    const now = new Date().toISOString();

    // Ensure tenant exists
    await env.DB.prepare(
      `INSERT OR IGNORE INTO tenants (id, name, createdAt) VALUES (?, ?, ?)`
    )
      .bind(orgId, orgName || "Workspace", now)
      .run();

    // Ensure membership exists (deterministic id so it doesn't duplicate)
    const memberId = `${orgId}:${sub}`;

    await env.DB.prepare(
      `INSERT OR IGNORE INTO tenant_members (id, tenantId, userId, email, name, role, createdAt)
       VALUES (?, ?, ?, ?, ?, 'member', ?)`
    )
      .bind(memberId, orgId, sub, email, name, now)
      .run();

    // Fetch role (admin/owner/member)
    const member = await env.DB.prepare(
      `SELECT tenantId, role FROM tenant_members
       WHERE tenantId = ? AND (userId = ? OR (email != '' AND lower(email) = lower(?)))
       LIMIT 1`
    )
      .bind(orgId, sub, email)
      .first();

    return {
      sub,
      email,
      name,
      tenantId: member?.tenantId || orgId,
      role: member?.role || "member",
      orgId,
      orgName,
      claims: payload,
    };
  }

  // Fallback (non-org mode): look up membership by email only
  if (env.DB && email) {
    const row = await env.DB.prepare(
      `SELECT tenantId, role
       FROM tenant_members
       WHERE lower(email)=lower(?)
       LIMIT 1`
    )
      .bind(email)
      .first();

    return {
      sub,
      email,
      name,
      tenantId: row?.tenantId || null,
      role: row?.role || null,
      orgId: null,
      orgName: null,
      claims: payload,
    };
  }

  return { sub, email, name, tenantId: null, role: null, orgId: null, orgName: null, claims: payload };
}

/**
 * requireAuth(context OR request+env)
 * opts.allowNoTenant = true lets bootstrap work for first-time users.
 */
export async function requireAuth(contextOrRequest, maybeEnv, opts = {}) {
  const request = contextOrRequest?.request ?? contextOrRequest;
  const env = contextOrRequest?.env ?? maybeEnv;

  const user = await getUser(request, env);
  if (!user) return { ok: false, res: unauthorized() };

  if (!opts.allowNoTenant && !user.tenantId) {
    return { ok: false, res: forbidden("No tenant assigned to this user yet.") };
  }

  return { ok: true, user };
}