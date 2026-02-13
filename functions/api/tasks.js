export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // GET → fetch tasks ordered by status + sortOrder (stable after refresh)
  if (method === "GET") {
    const { results } = await env.DB.prepare(`
      SELECT * FROM tasks
      ORDER BY
        CASE status
          WHEN 'To Do' THEN 1
          WHEN 'In Progress' THEN 2
          WHEN 'Done' THEN 3
          ELSE 4
        END,
        sortOrder ASC,
        createdAt DESC
    `).all();

    return Response.json(results || []);
  }

  // POST → create task
  if (method === "POST") {
    const body = await request.json();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const sortOrder = Number.isFinite(body.sortOrder) ? body.sortOrder : 0;

    await env.DB.prepare(`
      INSERT INTO tasks (
        id, taskName, description, owner, ownerEmail,
        type, priority, status, dueDate,
        externalStakeholders, sortOrder, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        id,
        body.taskName,
        body.description || "",
        body.owner,
        body.ownerEmail,
        body.type || "Other",
        body.priority || "Medium",
        body.status || "To Do",
        body.dueDate || "",
        body.externalStakeholders || "",
        sortOrder,
        now,
        now
      )
      .run();

    return Response.json({ success: true, id });
  }

  // PUT → update task
  if (method === "PUT") {
    const body = await request.json();

    const sortOrder = Number.isFinite(body.sortOrder) ? body.sortOrder : 0;

    await env.DB.prepare(`
      UPDATE tasks SET
        taskName = ?,
        description = ?,
        owner = ?,
        ownerEmail = ?,
        type = ?,
        priority = ?,
        status = ?,
        dueDate = ?,
        externalStakeholders = ?,
        sortOrder = ?,
        updatedAt = ?
      WHERE id = ?
    `)
      .bind(
        body.taskName,
        body.description || "",
        body.owner,
        body.ownerEmail,
        body.type || "Other",
        body.priority || "Medium",
        body.status || "To Do",
        body.dueDate || "",
        body.externalStakeholders || "",
        sortOrder,
        new Date().toISOString(),
        body.id
      )
      .run();

    return Response.json({ success: true });
  }

  // DELETE → delete task
  if (method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    await env.DB.prepare(`DELETE FROM tasks WHERE id = ?`).bind(id).run();
    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
}