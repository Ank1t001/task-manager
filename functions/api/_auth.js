import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Small JSON helpers
 */
export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function badRequest(message = "Bad Request", extra = {}) {
  return json({ error: message, ...extra }, { status: 400 });
}

export function unauthorized(message = "Unauthorized", extra = {}) {
  return json({ error: message, ...extra }, { status: 401 });
}

export function forbidden(message = "Forbidden", extra = {}) {
  return json({ error: message, ...extra }, { status: 403 });
}

/**
 * Read Bearer token
 */
function getBearerToken(request) {
  const auth = request?.headers?.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/**
 * Verify Auth0 access token using JWKS (jose)
 */
async function verifyAccessToken(token, env) {
  const issuer = env.AUTH0_ISSUER || `https://${env.AUTH0_DOMAIN}/`;
  const audience = env.AUTH0_AUDIENCE;

  if (!audience) throw new Error("Missing AUTH0_AUDIENCE env var");
  if (!issuer) throw new Error("Missing AUTH0_ISSUER/AUTH0_DOMAIN env var");

  const jwksUrl = new URL(".well-known/jwks.json", issuer);
  const JWKS = createRemoteJWKSet(jwksUrl);

  const { payload } = await jwtVerify(token, JWKS, {
    issuer,
    audience,
  });

  return payload;
}

/**
 * Returns user claims or null if not logged in (no token)
 */
export async function getUser(context) {
  // Important: Pages Functions always passes a single 'context' arg
  const req = context?.request;
  if (!req) throw new Error("getUser(): context.request is missing");

  const token = getBearerToken(req);
  if (!token) return null;

  const payload = await verifyAccessToken(token, context.env);

  return {
    sub: payload.sub,
    // Access tokens often don't include email unless you added it via Action / custom claims
    email: payload.email || payload["https://task-manager/email"] || null,
    name: payload.name || payload.nickname || null,
    org_id: payload.org_id || null,
    org_name: payload.org_name || null,
    // keep full payload if you want to debug later
    claims: payload,
  };
}

/**
 * requireAuth(context)
 * - validates Bearer token
 * - optionally enforces org_id (if env.VITE_AUTH0_ORG_ID exists)
 * - resolves tenant membership from D1
 * - returns { user, tenant } OR a Response (401/403)
 */
export async function requireAuth(context) {
  let user;
  try {
    user = await getUser(context);
  } catch (e) {
    // token malformed / jwt verify failed / missing config
    return unauthorized("Unauthorized", { detail: String(e?.message || e) });
  }

  if (!user) return unauthorized("Unauthorized");

  const { env } = context;

  // Optional: enforce org_id if you set VITE_AUTH0_ORG_ID in wrangler.toml vars
  const requiredOrgId = env.VITE_AUTH0_ORG_ID || null;
  if (requiredOrgId) {
    if (!user.org_id) {
      return forbidden("No organization found on token. Ensure org login is enabled.", {
        requiredOrgId,
      });
    }
    if (user.org_id !== requiredOrgId) {
      return forbidden("Organization mismatch.", {
        requiredOrgId,
        tokenOrgId: user.org_id,
      });
    }
  }

  if (!env.DB) {
    return new Response(
      "Server misconfigured: missing D1 binding (env.DB). Add [[d1_databases]] binding=\"DB\" in wrangler.toml.",
      { status: 500 }
    );
  }

  // Find membership by userId first, then email fallback (if token includes email)
  const userId = user.sub;
  const email = user.email;

  let member = null;

  if (userId) {
    member = await env.DB.prepare(
      `SELECT tenantId, role, email, name
       FROM tenant_members
       WHERE userId = ?
       LIMIT 1`
    )
      .bind(userId)
      .first();
  }

  if (!member && email) {
    member = await env.DB.prepare(
      `SELECT tenantId, role, email, name
       FROM tenant_members
       WHERE lower(email) = lower(?)
       LIMIT 1`
    )
      .bind(email)
      .first();
  }

  if (!member) {
    return forbidden("No tenant assigned to this user yet.", {
      hint: "Ensure the user exists in tenant_members with matching userId (Auth0 sub) or email.",
      userId,
      email,
    });
  }

  const tenantRow = await env.DB.prepare(
    `SELECT id, name FROM tenants WHERE id = ? LIMIT 1`
  )
    .bind(member.tenantId)
    .first();

  const tenant = {
    tenantId: member.tenantId,
    tenantName: tenantRow?.name || member.tenantId,
    role: member.role || "member",
    memberEmail: member.email || null,
    memberName: member.name || null,
  };

  return { user, tenant };
}