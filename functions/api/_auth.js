import { jwtVerify, createRemoteJWKSet } from "jose";

const JWKS = (env) =>
  createRemoteJWKSet(
    new URL(`https://${env.AUTH0_DOMAIN}/.well-known/jwks.json`)
  );

export async function getUser(request, env) {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;

  const token = auth.split(" ")[1];

  try {
    const { payload } = await jwtVerify(token, JWKS(env), {
      issuer: env.AUTH0_ISSUER,
      audience: env.AUTH0_AUDIENCE,
    });

    return payload;
  } catch (e) {
    return null;
  }
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function unauthorized() {
  return json({ error: "Unauthorized" }, 401);
}

export function forbidden() {
  return json({ error: "Forbidden" }, 403);
}

export function badRequest(msg = "Bad request") {
  return json({ error: msg }, 400);
}