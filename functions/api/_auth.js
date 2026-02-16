export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = auth.substring(7);

  // VERY basic decode (assuming you already validated earlier)
  const payload = JSON.parse(atob(token.split(".")[1]));

  const email = payload.email;
  if (!email) {
    throw new Error("Invalid token");
  }

  const member = await env.DB.prepare(
    "SELECT tenantId, role FROM tenant_members WHERE email = ?"
  )
    .bind(email)
    .first();

  if (!member) {
    throw new Error("No tenant assigned to this user yet.");
  }

  return {
    email,
    tenantId: member.tenantId,
    role: member.role,
  };
}

