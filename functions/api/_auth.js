// functions/api/_auth.js

function base64UrlToString(input) {
  // base64url -> base64
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  // pad
  const pad = input.length % 4;
  if (pad) input += "=".repeat(4 - pad);
  // decode
  const bytes = Uint8Array.from(atob(input), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(base64UrlToString(parts[1]));
  } catch {
    return null;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function badRequest(message = "Bad Request", extra = {}) {
  return json({ error: message, ...extra }, 400);
}

export function unauthorized(message = "Unauthorized", extra = {}) {
  return json({ error: message, ...extra }, 401);
}

export function forbidden(message = "Forbidden", extra = {}) {
  return json({ error: message, ...extra }, 403);
}

function getBearerToken(request) {
  // request can be undefined if called incorrectly — guard hard
  const auth = request?.headers?.get?.("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export async function getUser(request, env) {
  const token = getBearerToken(request);
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  // Auth0 standard-ish fields
  const userId = payload.sub || null;
  const email =
    payload.email ||
    payload["https://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] ||
    null;

  const name = payload.name || payload.nickname || payload.given_name || null;

  // Orgs: may appear as org_id / org_name depending on flow
  const orgId = payload.org_id || payload.organization_id || null;

  return { userId, email, name, orgId, raw: payload };
}

/**
 * requireAuth(context)
 * - Validates presence of bearer token
 * - Returns { ok:false, res } on failure
 * - Returns { ok:true, user } on success
 * - Also attaches tenantId + role if membership exists
 */
export async function requireAuth(context) {
  const request = context?.request;
  const env = context?.env;

  if (!request?.headers) {
    return { ok: false, res: unauthorized("Invalid request context (missing request).") };
  }
  if (!env?.DB) {
    return { ok: false, res: json({ error: "Server misconfigured (DB binding missing)." }, 500) };
  }

  const user = await getUser(request, env);
  if (!user?.userId) {
    return { ok: false, res: unauthorized("Unauthorized (token missing/invalid).") };
  }

  // 1) Try membership by userId
  let member = await env.DB.prepare(
    `SELECT tenantId, role, email, name, userId FROM tenant_members WHERE userId = ? LIMIT 1`
  )
    .bind(user.userId)
    .first();

  // 2) Fallback by email (helps when auth connection changes but email stays same)
  if (!member?.tenantId && user.email) {
    member = await env.DB.prepare(
      `SELECT tenantId, role, email, name, userId FROM tenant_members WHERE email = ? LIMIT 1`
    )
      .bind(user.email)
      .first();

    // If found by email, link row to current Auth0 userId for next time
    if (member?.tenantId && member.userId !== user.userId) {
      await env.DB.prepare(`UPDATE tenant_members SET userId = ? WHERE email = ?`)
        .bind(user.userId, user.email)
        .run();
    }
  }

  if (!member?.tenantId) {
    return {
      ok: false,
      res: forbidden("No tenant assigned to this user yet.", {
        hint:
          "Add the user to a tenant_members row (or invite / auto-membership flow) and ensure email matches.",
      }),
    };
  }

  return {
    ok: true,
    user: {
      userId: user.userId,
      email: user.email || member.email || "",
      name: user.name || member.name || "",
      role: member.role || "member",
      tenantId: member.tenantId,
      orgId: user.orgId || null,
    },
  };
}