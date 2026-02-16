import { jwtVerify, createRemoteJWKSet } from "jose";

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) },
  });
}
function badRequest(message = "Bad Request") {
  return json({ error: message }, { status: 400 });
}
function unauthorized(message = "Unauthorized") {
  return json({ error: message }, { status: 401 });
}
function forbidden(message = "Forbidden") {
  return json({ error: message }, { status: 403 });
}

function getAuthHeader(request) {
  const h = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice("Bearer ".length) : "";
}

/**
 * Validate Auth0 access token and return user identity.
 * Expects env:
 *  AUTH0_DOMAIN, AUTH0_AUDIENCE, AUTH0_ISSUER
 */
async function getUser(request, env) {
  const token = getAuthHeader(request);
  if (!token) return null;

  const domain = env.AUTH0_DOMAIN;
  const audience = env.AUTH0_AUDIENCE;
  const issuer = env.AUTH0_ISSUER || `https://${domain}/`;

  if (!domain || !audience) throw new Error("Missing AUTH0_DOMAIN or AUTH0_AUDIENCE");

  const jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks, { issuer, audience });

  // Typical Auth0 claims
  const email = payload.email || payload["https://example.com/email"] || "";
  const name = payload.name || payload.nickname || email || "User";
  const sub = payload.sub || "";

  return { sub, email, name, claims: payload };
}

/** Require auth; returns { user } or throws Response */
async function requireAuth(request, env) {
  try {
    const user = await getUser(request, env);
    if (!user) throw unauthorized();
    return { user };
  } catch (e) {
    // If jose throws, treat as unauthorized
    if (e instanceof Response) throw e;
    throw unauthorized("Invalid token");
  }
}

export { json, badRequest, unauthorized, forbidden, getUser, requireAuth };