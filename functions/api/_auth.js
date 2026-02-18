// functions/api/_auth.js

/**
 * Shared helpers for Cloudflare Pages Functions
 * - Validates Auth0 JWT (RS256) using your tenant's JWKS
 * - Maps user -> tenant using D1 table tenant_members
 * - Exposes requireAuth(context) wrapper used by other handlers
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
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

function base64UrlToUint8Array(b64url) {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function decodeJwt(token) {
  const [h, p] = token.split(".");
  if (!h || !p) throw new Error("Invalid JWT");
  const header = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(h)));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(p)));
  return { header, payload };
}

async function importRsaPublicKeyFromJwk(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

async function getJwks(env) {
  const domain = env.AUTH0_DOMAIN;
  if (!domain) throw new Error("Missing AUTH0_DOMAIN");
  const url = `https://${domain}/.well-known/jwks.json`;

  const res = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`);
  return res.json();
}

async function verifyJwtRs256(token, env) {
  const { header, payload } = decodeJwt(token);

  const issuer = env.AUTH0_ISSUER;
  const audience = env.AUTH0_AUDIENCE;

  if (!issuer) throw new Error("Missing AUTH0_ISSUER");
  if (!audience) throw new Error("Missing AUTH0_AUDIENCE");

  // Basic claim checks
  if (payload.iss !== issuer) throw new Error("Invalid issuer");
  const audOk = Array.isArray(payload.aud) ? payload.aud.includes(audience) : payload.aud === audience;
  if (!audOk) throw new Error("Invalid audience");

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now >= payload.exp) throw new Error("Token expired");

  // Signature verify
  const jwks = await getJwks(env);
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Signing key not found");

  const key = await importRsaPublicKeyFromJwk(jwk);

  const [h, p, s] = token.split(".");
  const data = new TextEncoder().encode(`${h}.${p}`);
  const sig = base64UrlToUint8Array(s);

  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, data);
  if (!ok) throw new Error("Invalid signature");

  return payload;
}

function getBearerToken(request) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/**
 * Returns:
 * {
 *   userId, email, name, sub, orgId,
 *   tenantId, role
 * }
 */
export async function getUser(request, env) {
  const token = getBearerToken(request);
  if (!token) return null;

  const claims = await verifyJwtRs256(token, env);

  const userId = claims.sub;
  const email = claims.email || null;
  const name = claims.name || claims.nickname || null;

  // org claim key varies; include a few common places:
  const orgId =
    claims.org_id ||
    claims.organization ||
    claims["https://taskmanager.ca/org_id"] ||
    claims["https://task-manager-user/api/org_id"] ||
    null;

  // Map user -> tenant via D1
  if (!env.DB) {
    // Helpful error (you hit this earlier)
    throw new Error("Server misconfigured: missing D1 binding (env.DB). Add [[d1_databases]] binding=\"DB\" in wrangler.toml.");
  }

  const member = await env.DB.prepare(
    `SELECT tenantId, role FROM tenant_members
     WHERE userId = ?
        OR (email IS NOT NULL AND email = ?)
     LIMIT 1`
  )
    .bind(userId, email)
    .first();

  return {
    userId,
    email,
    name,
    sub: userId,
    orgId,
    tenantId: member?.tenantId || null,
    role: member?.role || null,
  };
}

/**
 * Standard guard for Pages Functions.
 * Usage:
 *   const auth = await requireAuth(context);
 *   if (!auth.ok) return auth.res;
 *   const user = auth.user;
 */
export async function requireAuth(context) {
  const request = context?.request;
  const env = context?.env;

  if (!request) return { ok: false, res: unauthorized("Missing request context") };
  if (!env) return { ok: false, res: unauthorized("Missing env context") };

  try {
    const user = await getUser(request, env);
    if (!user) return { ok: false, res: unauthorized("Unauthorized") };

    if (!user.tenantId) {
      return {
        ok: false,
        res: forbidden("No tenant assigned to this user yet.", {
          hint: "Ensure the user exists in tenant_members with matching userId (Auth0 sub) or email.",
          userId: user.userId,
          email: user.email,
        }),
      };
    }

    return { ok: true, user };
  } catch (e) {
    return {
      ok: false,
      res: json({ error: "Auth error", message: e?.message || String(e) }, { status: 500 }),
    };
  }
}

// Preflight support
export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};