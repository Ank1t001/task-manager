import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Expected env vars (Pages Functions):
 * AUTH0_DOMAIN   = taskmanager.ca.auth0.com
 * AUTH0_AUDIENCE = https://task-manager/api
 * AUTH0_ISSUER   = https://taskmanager.ca.auth0.com/
 */

function envOrThrow(env, key) {
  const v = env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

export function badRequest(message = "Bad Request") {
  return json({ error: message }, 400);
}

export function unauthorized(message = "Unauthorized") {
  return json({ error: message }, 401);
}

export function forbidden(message = "Forbidden") {
  return json({ error: message }, 403);
}

function getBearer(req) {
  const h = req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

/**
 * Verifies Auth0 access token and returns user claims.
 */
export async function getUser(request, env) {
  const token = getBearer(request);
  if (!token) return null;

  const domain = envOrThrow(env, "AUTH0_DOMAIN");
  const audience = envOrThrow(env, "AUTH0_AUDIENCE");
  const issuer = envOrThrow(env, "AUTH0_ISSUER");

  const jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience,
  });

  return {
    sub: payload.sub,
    email: payload.email || "",
    name: payload.name || payload.nickname || payload.email || payload.sub,
    claims: payload,
  };
}

/**
 * Ensures user is authenticated AND resolves tenantId.
 * Multi-tenant model:
 * - tenants(id, name, createdAt)
 * - tenant_members(tenantId, userSub, role, createdAt)
 */
export async function requireAuth(request, env) {
  let u;
  try {
    u = await getUser(request, env);
  } catch (e) {
    return { ok: false, res: unauthorized(`Invalid token: ${e?.message || e}`) };
  }

  if (!u) return { ok: false, res: unauthorized("Missing bearer token") };

  // Resolve tenant membership
  const member = await env.DB.prepare(
    "SELECT tenantId, role FROM tenant_members WHERE userSub = ? LIMIT 1"
  )
    .bind(u.sub)
    .first();

  if (!member?.tenantId) {
    // Not yet onboarded to a tenant (bootstrap step will create membership)
    return {
      ok: true,
      user: u,
      tenantId: null,
      role: "member",
    };
  }

  return {
    ok: true,
    user: u,
    tenantId: member.tenantId,
    role: member.role || "member",
  };
}