import { createRemoteJWKSet, jwtVerify } from "jose";

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders
    }
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

function getBearer(request) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

async function fetchUserInfo(env, token) {
  // Auth0 userinfo endpoint
  const issuer = env.AUTH0_ISSUER || `https://${env.AUTH0_DOMAIN}/`;
  const url = issuer.replace(/\/+$/, "/") + "userinfo";

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) return null;
  return res.json();
}

export async function getUser(request, env) {
  const token = getBearer(request);
  if (!token) return null;

  const domain = env.AUTH0_DOMAIN;
  const issuer = env.AUTH0_ISSUER || `https://${domain}/`;
  const audience = env.AUTH0_AUDIENCE;

  if (!domain || !audience) return null;

  const jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));

  const { payload } = await jwtVerify(token, jwks, {
    issuer: issuer.replace(/\/+$/, "/"),
    audience
  });

  // Try to enrich from userinfo (email/name usually not in access token for custom API)
  const ui = await fetchUserInfo(env, token);

  const userId = payload.sub;
  const email = ui?.email || payload.email || "";
  const name = ui?.name || payload.name || email || userId;

  return {
    userId,
    email,
    name,
    claims: payload
  };
}

export async function requireAuth(request, env) {
  try {
    const token = getBearer(request);
    if (!token) return { ok: false, status: 401, body: { error: "Unauthorized" } };

    const user = await getUser(request, env);
    if (!user?.userId) return { ok: false, status: 401, body: { error: "Unauthorized" } };

    return { ok: true, status: 200, user };
  } catch (e) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
}