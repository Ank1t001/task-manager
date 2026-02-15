import { jwtVerify, createRemoteJWKSet } from "jose";

const jwksCache = new Map();

export async function requireAuth(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const jwks = createRemoteJWKSet(
      new URL(`${env.AUTH0_ISSUER}.well-known/jwks.json`)
    );

    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.AUTH0_ISSUER,
      audience: env.AUTH0_AUDIENCE,
    });

    return {
      ok: true,
      user: {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
      },
    };
  } catch (err) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}