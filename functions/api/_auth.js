import { createRemoteJWKSet, jwtVerify } from "jose";

const json = (data, init = {}) =>
  new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) },
    ...init
  });

const badRequest = (msg = "Bad Request") => json({ error: msg }, { status: 400 });
const unauthorized = (msg = "Unauthorized") => json({ error: msg }, { status: 401 });
const forbidden = (msg = "Forbidden") => json({ error: msg }, { status: 403 });

const getBearer = (req) => {
  const h = req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
};

let jwksCache = null;
const getJWKS = (domain) => {
  if (!jwksCache) {
    const url = new URL(`https://${domain}/.well-known/jwks.json`);
    jwksCache = createRemoteJWKSet(url);
  }
  return jwksCache;
};

const verifyAuth0 = async (req, env) => {
  const token = getBearer(req);
  if (!token) return null;

  const domain = env.AUTH0_DOMAIN;
  const audience = env.AUTH0_AUDIENCE;
  const issuer = env.AUTH0_ISSUER || `https://${domain}/`;

  const { payload } = await jwtVerify(token, getJWKS(domain), {
    issuer,
    audience
  });

  // Normalize user fields
  const email = payload.email || payload["https://email"] || "";
  const name =
    payload.name ||
    payload.nickname ||
    (email ? email.split("@")[0] : "User");

  return {
    sub: payload.sub,
    email,
    name,
    raw: payload
  };
};

export async function getUser(req, env) {
  try {
    return await verifyAuth0(req, env);
  } catch {
    return null;
  }
}

export async function requireAuth(req, env) {
  const user = await getUser(req, env);
  if (!user) return { user: null, res: unauthorized() };
  return { user, res: null };
}

export { json, badRequest, unauthorized, forbidden };