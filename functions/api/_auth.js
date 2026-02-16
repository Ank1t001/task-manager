async function getUser(request, env) {
  const token = getAuthHeader(request);
  if (!token) return null;

  const domain = env.AUTH0_DOMAIN;
  const audience = env.AUTH0_AUDIENCE;
  const issuer = env.AUTH0_ISSUER || `https://${domain}/`;

  if (!domain || !audience) throw new Error("Missing AUTH0_DOMAIN or AUTH0_AUDIENCE");

  const jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks, { issuer, audience });

  const email = (payload.email || payload["https://example.com/email"] || "").toString();
  const name = (payload.name || payload.nickname || email || "User").toString();
  const sub = (payload.sub || "").toString();

  // 🔥 Attach tenant membership (if DB binding exists)
  let tenantId = null;
  let role = null;

  if (env.DB && (email || sub)) {
    const emailLower = email.trim().toLowerCase();

    const member = await env.DB
      .prepare(
        `SELECT tenantId, role
         FROM tenant_members
         WHERE lower(email) = ? OR userId = ?
         LIMIT 1`
      )
      .bind(emailLower, sub)
      .first();

    if (member) {
      tenantId = member.tenantId;
      role = member.role;
    }
  }

  return { sub, email, name, tenantId, role, claims: payload };
}
