// functions/api/tasks.js
import { getUser, json, badRequest, unauthorized, forbidden } from "./_auth";
import { logActivity, nowIso, uid } from "./_activity";

function canEditTask(user, taskRow) {
  if (!user) return false;
  // Admin can do anything in tenant
  if (user.role === "admin") return true;
  // Member can edit only own tasks
  return (taskRow.ownerEmail || "").toLowerCase() === (user.email || "").toLowerCase();
}

function safeLower(v) {
  return (v ?? "").toString().trim().toLowerCase();
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const user = await getUser(request, env);
  if (!user) return unauthorized("Login required");

  if (!user.tenantId) {
    return forbidden("No tenant assigned to this user yet.");
  }

  const method = request.method.toUpperCase();

  // LIST
  if (method === "GET") {
    const ownerEmail = safeLower(url.searchParams.get("ownerEmail"));
    const status = (url.searchParams.get("status") || "").trim();
    const q = (url.searchParams.get("q") || "").trim();
    const projectName = (url.searchParams.get("projectName") || "").trim();

    let sql = `SELECT *
               FROM tasks
               WHERE tenantId = ?`;
    const binds = [user.tenantId];

    if (ownerEmail) {
      sql += ` AND lower(ownerEmail) = ?`;
      binds.push(ownerEmail);
    }
    if (status) {
      sql += ` AND status = ?`;
      binds.push(status);
    }
    if (projectName) {
      sql += ` AND projectName = ?`;
      binds.push(projectName);
    }
    if (q) {
      sql += ` AND (
        taskName LIKE ? OR
        description LIKE ? OR
        type LIKE ? OR
        externalStakeholders LIKE ?
      )`;
      const like = `%${q}%`;
      binds.push(like, like, like, like);
    }

    // stable order: status then sortOrder then updatedAt
    sql += ` ORDER BY status ASC, sortOrder ASC, updatedAt DESC`;

    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    return json(results || []);
  }

  // CREATE
  if (method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !body.taskName) return badRequest("taskName is required");

    const now = nowIso();

    const row = {
      id: uid(),
      tenantId: user.tenantId,
      taskName: (body.taskName || "").trim(),
      description: (body.description || "").trim(),
      owner: (body.owner || user.name || "Unknown").trim(),
      ownerEmail: safeLower(body.ownerEmail || user.email || ""),
      type: (body.type || "Other").trim(),
      priority: (body.priority || "Medium").trim(),
      status: (body.status || "To Do").trim(),
      dueDate: (body.dueDate || "").trim(),
      externalStakeholders: (body.externalStakeholders || "").trim(),
      createdAt: now,
      updatedAt: now,
      projectName: (body.projectName || "").trim(),
      stage: (body.stage || "").trim(),
      completedAt: (body.completedAt || "").trim(),
      sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : 0,
    };

    await env.DB.prepare(
      `INSERT INTO tasks
       (id, tenantId, taskName, description, owner, ownerEmail, type, priority, status, dueDate, externalStakeholders,
        createdAt, updatedAt, projectName, stage, completedAt, sortOrder)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        row.id,
        row.tenantId,
        row.taskName,
        row.description,
        row.owner,
        row.ownerEmail,
        row.type,
        row.priority,
        row.status,
        row.dueDate,
        row.externalStakeholders,
        row.createdAt,
        row.updatedAt,
        row.projectName,
        row.stage,
        row.completedAt,
        row.sortOrder
      )
      .run();

    await logActivity(env, {
      tenantId: user.tenantId,
      actor: user,
      action: "task.created",
      entityType: "task",
      entityId: row.id,
      summary: `Created task: ${row.taskName}`,
      meta: { status: row.status, priority: row.priority, ownerEmail: row.ownerEmail },
    });

    return json(row, 201);
  }

  // UPDATE
  if (method === "PUT" || method === "PATCH") {
    const body = await request.json().catch(() => null);
    if (!body?.id) return badRequest("id is required");

    const existing = await env.DB.prepare(
      `SELECT * FROM tasks WHERE tenantId = ? AND id = ? LIMIT 1`
    )
      .bind(user.tenantId, body.id)
      .first();

    if (!existing) return badRequest("Task not found");
    if (!canEditTask(user, existing)) return forbidden("You can only edit your own tasks (unless admin).");

    const now = nowIso();

    // IMPORTANT: fix ?? + || precedence with parentheses
    const nextOwnerEmail = (body.ownerEmail ?? existing.ownerEmail ?? "");
    const updated = {
      ...existing,
      taskName: (body.taskName ?? existing.taskName ?? "").trim(),
      description: (body.description ?? existing.description ?? "").trim(),
      owner: (body.owner ?? existing.owner ?? "").trim(),
      ownerEmail: safeLower(nextOwnerEmail),
      type: (body.type ?? existing.type ?? "Other").trim(),
      priority: (body.priority ?? existing.priority ?? "Medium").trim(),
      status: (body.status ?? existing.status ?? "To Do").trim(),
      dueDate: (body.dueDate ?? existing.dueDate ?? "").trim(),
      externalStakeholders: (body.externalStakeholders ?? existing.externalStakeholders ?? "").trim(),
      projectName: (body.projectName ?? existing.projectName ?? "").trim(),
      stage: (body.stage ?? existing.stage ?? "").trim(),
      completedAt: (body.completedAt ?? existing.completedAt ?? "").trim(),
      sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : existing.sortOrder ?? 0,
      updatedAt: now,
    };

    await env.DB.prepare(
      `UPDATE tasks SET
        taskName = ?, description = ?, owner = ?, ownerEmail = ?, type = ?, priority = ?, status = ?,
        dueDate = ?, externalStakeholders = ?, updatedAt = ?, projectName = ?, stage = ?, completedAt = ?, sortOrder = ?
       WHERE tenantId = ? AND id = ?`
    )
      .bind(
        updated.taskName,
        updated.description,
        updated.owner,
        updated.ownerEmail,
        updated.type,
        updated.priority,
        updated.status,
        updated.dueDate,
        updated.externalStakeholders,
        updated.updatedAt,
        updated.projectName,
        updated.stage,
        updated.completedAt,
        updated.sortOrder,
        user.tenantId,
        updated.id
      )
      .run();

    await logActivity(env, {
      tenantId: user.tenantId,
      actor: user,
      action: "task.updated",
      entityType: "task",
      entityId: updated.id,
      summary: `Updated task: ${updated.taskName}`,
      meta: { from: { status: existing.status, priority: existing.priority }, to: { status: updated.status, priority: updated.priority } },
    });

    return json(updated);
  }

  // DELETE
  if (method === "DELETE") {
    const body = await request.json().catch(() => ({}));
    const id = body.id || url.searchParams.get("id");
    if (!id) return badRequest("id is required");

    const existing = await env.DB.prepare(
      `SELECT * FROM tasks WHERE tenantId = ? AND id = ? LIMIT 1`
    )
      .bind(user.tenantId, id)
      .first();

    if (!existing) return badRequest("Task not found");
    if (!canEditTask(user, existing)) return forbidden("You can only delete your own tasks (unless admin).");

    await env.DB.prepare(`DELETE FROM tasks WHERE tenantId = ? AND id = ?`)
      .bind(user.tenantId, id)
      .run();

    await logActivity(env, {
      tenantId: user.tenantId,
      actor: user,
      action: "task.deleted",
      entityType: "task",
      entityId: id,
      summary: `Deleted task: ${existing.taskName}`,
      meta: { taskName: existing.taskName },
    });

    return json({ ok: true });
  }

  return json({ error: "method_not_allowed" }, 405);
}