// functions/api/_auth.js
import { jwtVerify, createRemoteJWKSet } from "jose";

const AUTH0_DOMAIN = (env) => env.AUTH0_DOMAIN || env.VITE_AUTH0_DOMAIN;
const AUTH0_AUDIENCE = (env) => env.AUTH0_AUDIENCE || env.VITE_AUTH0_AUDIENCE;
const AUTH0_ISSUER = (env) =>
  env.AUTH0_ISSUER || `https://${AUTH0_DOMAIN(env)}/`;

function toRequest(ctxOrReq) {
  // Accept either Pages context ({ request, env, ... }) or a Request
  if (!ctxOrReq) return undefined;
  if (ctxOrReq instanceof Request) return ctxOrReq;
  if (ctxOrReq.request instanceof Request) return ctxOrReq.request;
  return undefined;
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

export function badRequest(message = "Bad Request") {
  return json({ error: message }, { status: 400 });
}

export function unauthorized(message = "Unauthorized") {
  return json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return json({ error: message }, { status: 403 });
}

function getBearerToken(ctxOrReq) {
  const req = toRequest(ctxOrReq);
  if (!req) return null;

  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function verifyAccessToken(token, env) {
  const issuer = AUTH0_ISSUER(env);
  const audience = AUTH0_AUDIENCE(env);

  const jwksUrl = new URL(".well-known/jwks.json", issuer);
  const JWKS = createRemoteJWKSet(jwksUrl);

  const { payload } = await jwtVerify(token, JWKS, {
    issuer,
    audience,
  });

  return payload;
}

export async function getUser(ctxOrReq, env) {
  const token = getBearerToken(ctxOrReq);
  if (!token) return { ok: false, status: 401, error: "Missing bearer token" };

  try {
    const claims = await verifyAccessToken(token, env);

    // Auth0 Organizations claims
    const orgId = claims.org_id || claims["https://auth0.com/org_id"];
    const orgName = claims.org_name || claims["https://auth0.com/org_name"];

    const email =
      claims.email ||
      claims["https://schemas.openid.net/userinfo/email"] ||
      null;

    return {
      ok: true,
      claims,
      email,
      sub: claims.sub,
      orgId,
      orgName,
    };
  } catch (e) {
    return {
      ok: false,
      status: 401,
      error: `Token verification failed: ${e?.message || String(e)}`,
    };
  }
}