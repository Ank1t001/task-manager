import { jwtVerify, createRemoteJWKSet } from "jose";

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });

const badRequest = (msg = "Bad Request") => json({ error: msg }, { status: 400 });
const unauthorized = (msg = "Unauthorized") => json({ error: msg }, { status: 401 });
const forbidden = (msg = "Forbidden") => json({ error: msg }, { status: 403 });

const getBearer = (req) => {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
};

const nowIso = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

const lower = (s) => (s || "").toString().trim().toLowerCase();

async function verifyAccessToken(env, token) {
  const issuer = env.AUTH0_ISSUER; // e.g. https://taskmanager.ca.auth0.com/
  const audience = env.AUTH0_AUDIENCE; // e.g. https://task-manager-user/api

  if (!issuer || !audience) throw new Error("Missing AUTH0_ISSUER/AUTH0_AUDIENCE");

  const jwks = createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience,
  });

  return payload;
}

async function getTenantMembership(env, { userId, email }) {
  // ✅ lookup by userId OR email (email may be absent in access token)
  const row = await env.DB.prepare(
    `SELECT tenantId, role
     FROM tenant_members
     WHERE userId = ?
        OR (email IS NOT NULL AND lower(email) = lower(?))
     LIMIT 1`
  )
    .bind(userId, email || "")
    .first();

  return row || null;
}

async function ensureTenantAndMembershipForOrg(env, { orgId, orgName, userId, email, name }) {
  // Create tenant if missing (id = orgId)
  const existingTenant = await env.DB.prepare(`SELECT id FROM tenants WHERE id = ? LIMIT 1`)
    .bind(orgId)
    .first();

  if (!existingTenant?.id) {
    await env.DB.prepare(`INSERT INTO tenants (id, name, createdAt) VALUES (?, ?, ?)`)
      .bind(orgId, orgName || orgId, nowIso())
      .run();
  }

  // Ensure membership row exists
  const member = await env.DB.prepare(
    `SELECT id, role FROM tenant_members
     WHERE tenantId = ? AND (userId = ? OR (email IS NOT NULL AND lower(email)=lower(?)))
     LIMIT 1`
  )
    .bind(orgId, userId, email || "")
    .first();

  if (!member?.id) {
    await env.DB.prepare(
      `INSERT INTO tenant_members (id, tenantId, userId, email, name, role, createdAt)
       VALUES (?, ?, ?, ?, ?, 'member', ?)`
    )
      .bind(uid(), orgId, userId, email || "", name || "", nowIso())
      .run();
  }

  return member?.role || "member";
}

async function getUser(context) {
  const token = getBearer(context.request);
  if (!token) return null;

  const payload = await verifyAccessToken(context.env, token);

  const userId = payload.sub;
  const email = payload.email || payload["https://example.com/email"] || null; // optional
  const name = payload.name || payload.nickname || email || userId;

  // ✅ Organizations
  const orgId = payload.org_id || null;
  const orgName = payload.org_name || null;

  // If org present → tenancy comes from org
  if (orgId) {
    const role = await ensureTenantAndMembershipForOrg(context.env, {
      orgId,
      orgName,
      userId,
      email,
      name,
    });

    return { userId, email, name, tenantId: orgId, role, orgId, orgName };
  }

  // Otherwise → tenancy comes from D1 membership
  const membership = await getTenantMembership(context.env, { userId, email });
  if (!membership?.tenantId) return { userId, email, name, tenantId: null, role: null, orgId, orgName };

  return { userId, email, name, tenantId: membership.tenantId, role: membership.role, orgId, orgName };
}

const requireAuth = async (context) => {
  const user = await getUser(context);
  if (!user) return { ok: false, res: unauthorized(), user: null };

  // If no tenant, treat as 403 (your UI expects this)
  if (!user.tenantId) return { ok: false, res: forbidden("No tenant assigned to this user yet."), user };

  return { ok: true, res: null, user };
};

export {
  json,
  badRequest,
  unauthorized,
  forbidden,
  getUser,
  requireAuth,
};