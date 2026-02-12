export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  const url = new URL(request.url);

  // GET → fetch all tasks
  if (method === "GET") {
    const { results } = await env.DB
      .prepare("SELECT * FROM tasks ORDER BY createdAt DESC")
      .all();

    return Response.json(results || []);
  }

  // POST → create task
  if (method === "POST") {
    const body = await request.json();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO tasks (
        id, taskName, description, owner, ownerEmail,
        type, priority, status, dueDate,
        externalStakeholders, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        id,
        body.taskName,
        body.description || "",
        body.owner,
        body.ownerEmail,
        body.type,
        body.priority,
        body.status,
        body.dueDate || "",
        body.externalStakeholders || "",
        now,
        now
      )
      .run();

    return Response.json({ success: true });
  }

  // PUT → update task
  if (method === "PUT") {
    const body = await request.json();

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
        updatedAt = ?
      WHERE id = ?
    `)
      .bind(
        body.taskName,
        body.description || "",
        body.owner,
        body.ownerEmail,
        body.type,
        body.priority,
        body.status,
        body.dueDate || "",
        body.externalStakeholders || "",
        new Date().toISOString(),
        body.id
      )
      .run();

    return Response.json({ success: true });
  }

  // DELETE → delete task
  if (method === "DELETE") {
    const id = url.searchParams.get("id");

    await env.DB.prepare("DELETE FROM tasks WHERE id = ?")
      .bind(id)
      .run();

    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
}