import { jwtVerify, createRemoteJWKSet } from "jose";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...jsonHeaders, ...(init.headers || {}) },
  });
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
 * Accepts either:
 *  - (context)  where context.request + context.env exist
 *  - (request, env)
 */
function normalizeArgs(arg1, arg2) {
  if (arg1 && arg1.request && arg1.env) {
    return { request: arg1.request, env: arg1.env };
  }
  return { request: arg1, env: arg2 };
}

function getBearerToken(request) {
  const auth = request?.headers?.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function getJwks(domain) {
  return createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
}

async function verifyAccessToken(token, env) {
  const domain = env.AUTH0_DOMAIN;
  const audience = env.AUTH0_AUDIENCE;
  const issuer = env.AUTH0_ISSUER || `https://${domain}/`;

  if (!domain || !audience) {
    throw new Error("Missing AUTH0_DOMAIN or AUTH0_AUDIENCE in environment.");
  }

  const jwks = getJwks(domain);

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience,
  });

  return payload;
}

/**
 * Returns:
 *  { ok: true, user: { userId, email, name, orgId, tenantId, role } }
 *  or { ok: false, res: Response }
 */
export async function getUser(arg1, arg2) {
  const { request, env } = normalizeArgs(arg1, arg2);

  const token = getBearerToken(request);
  if (!token) return { ok: false, res: unauthorized("Unauthorized") };

  let payload;
  try {
    payload = await verifyAccessToken(token, env);
  } catch (e) {
    return { ok: false, res: unauthorized("Unauthorized", { detail: String(e?.message || e) }) };
  }

  const userId = payload.sub;
  const email = payload.email || payload["https://task-manager-user/email"] || null;
  const name =
    payload.name ||
    payload.nickname ||
    payload["https://task-manager-user/name"] ||
    (email ? email.split("@")[0] : "User");

  // Auth0 Organizations: org_id claim
  const orgId = payload.org_id || payload.organization_id || null;

  // 1) Prefer explicit membership by userId
  const member = await env.DB.prepare(
    `SELECT tenantId, role FROM tenant_members WHERE userId = ? LIMIT 1`
  )
    .bind(userId)
    .first();

  if (member?.tenantId) {
    return {
      ok: true,
      user: {
        userId,
        email,
        name,
        orgId,
        tenantId: member.tenantId,
        role: member.role,
      },
    };
  }

  // 2) If orgId present, treat it as tenantId (auto-provision)
  if (orgId) {
    const existingTenant = await env.DB.prepare(`SELECT id FROM tenants WHERE id = ? LIMIT 1`)
      .bind(orgId)
      .first();

    if (!existingTenant?.id) {
      await env.DB.prepare(`INSERT INTO tenants (id, name, createdAt) VALUES (?, ?, ?)`)
        .bind(orgId, `Org ${orgId}`, new Date().toISOString())
        .run();
    }

    // create membership if missing
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO tenant_members (id, tenantId, userId, email, name, role, createdAt)
       VALUES (?, ?, ?, ?, ?, 'member', ?)`
    )
      .bind(id, orgId, userId, email || "", name || "", new Date().toISOString())
      .run();

    return {
      ok: true,
      user: { userId, email, name, orgId, tenantId: orgId, role: "member" },
    };
  }

  // 3) No membership and no org → block
  return {
    ok: false,
    res: forbidden("No tenant assigned to this user yet.", {
      hint: "User is authenticated, but no tenant membership was found and no org_id was provided.",
    }),
  };
}

export async function requireAuth(arg1, arg2) {
  const result = await getUser(arg1, arg2);
  if (!result.ok) return result;
  return { ok: true, user: result.user };
}