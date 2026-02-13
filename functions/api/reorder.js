export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.json();
  const updates = Array.isArray(body?.updates) ? body.updates : [];
  if (!updates.length) return Response.json({ success: true, updated: 0 });

  const now = new Date().toISOString();

  for (const u of updates) {
    if (!u?.id) continue;

    const status = u.status || null;
    const sortOrder = Number.isFinite(u.sortOrder) ? u.sortOrder : 0;

    await env.DB.prepare(`
      UPDATE tasks SET
        status = COALESCE(?, status),
        sortOrder = ?,
        updatedAt = ?
      WHERE id = ?
    `)
      .bind(status, sortOrder, now, u.id)
      .run();
  }

  return Response.json({ success: true, updated: updates.length });
}