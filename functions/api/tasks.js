// functions/api/tasks.js
import { requireAuth, json, badRequest, unauthorized, forbidden } from "./_auth";

function parseUrl(request) {
  return new URL(request.url);
}

function withCors(resp) {
  // Same-origin on Pages, but leaving this safe/no-op-ish.
  resp.headers.set("access-control-allow-origin", "*");
  resp.headers.set("access-control-allow-headers", "authorization, content-type");
  resp.headers.set("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
  return resp;
}

export async function onRequest(context) {
  const { request, env } = context;

  // Preflight
  if (request.method === "OPTIONS") return withCors(new Response("", { status: 204 }));

  const auth = await requireAuth(request, env);
  if (!auth.ok) return withCors(auth.response);

  const { user } = auth; // { tenantId, role, email, name, ... }

  try {
    if (request.method === "GET") {
      const url = parseUrl(request);
      const status = url.searchParams.get("status"); // optional

      let stmt;
      if (status) {
        stmt = env.DB.prepare(
          `SELECT id, title, owner, priority, status, due, project, stage, createdAt, updatedAt
           FROM tasks
           WHERE tenantId = ? AND status = ?
           ORDER BY createdAt DESC`
        ).bind(user.tenantId, status);
      } else {
        stmt = env.DB.prepare(
          `SELECT id, title, owner, priority, status, due, project, stage, createdAt, updatedAt
           FROM tasks
           WHERE tenantId = ?
           ORDER BY createdAt DESC`
        ).bind(user.tenantId);
      }

      const { results } = await stmt.all();
      return withCors(json({ tasks: results || [] }));
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body) return withCors(badRequest("Invalid JSON"));

      const {
        title,
        owner = user.name || user.email,
        priority = "Medium",
        status = "In Progress",
        due = null,
        project = null,
        stage = null,
      } = body;

      if (!title) return withCors(badRequest("title is required"));

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      await env.DB.prepare(
        `INSERT INTO tasks (id, tenantId, title, owner, priority, status, due, project, stage, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          user.tenantId,
          title,
          owner,
          priority,
          status,
          due,
          project,
          stage,
          now,
          now
        )
        .run();

      return withCors(json({ ok: true, id }, 201));
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      if (!body) return withCors(badRequest("Invalid JSON"));

      const { id } = body;
      if (!id) return withCors(badRequest("id is required"));

      const now = new Date().toISOString();

      // Only update allowed fields
      const allowed = ["title", "owner", "priority", "status", "due", "project", "stage"];
      const updates = [];
      const binds = [];

      for (const k of allowed) {
        if (k in body) {
          updates.push(`${k} = ?`);
          binds.push(body[k]);
        }
      }

      if (!updates.length) return withCors(badRequest("No fields to update"));

      updates.push(`updatedAt = ?`);
      binds.push(now);

      // tenant guard + id last
      binds.push(user.tenantId, id);

      await env.DB.prepare(
        `UPDATE tasks
         SET ${updates.join(", ")}
         WHERE tenantId = ? AND id = ?`
      )
        .bind(...binds)
        .run();

      return withCors(json({ ok: true }));
    }

    if (request.method === "DELETE") {
      const url = parseUrl(request);
      const id = url.searchParams.get("id");
      if (!id) return withCors(badRequest("id is required"));

      await env.DB.prepare(`DELETE FROM tasks WHERE tenantId = ? AND id = ?`)
        .bind(user.tenantId, id)
        .run();

      return withCors(json({ ok: true }));
    }

    return withCors(json({ error: "Method Not Allowed" }, 405));
  } catch (e) {
    return withCors(
      json(
        {
          error: "Server error",
          message: e?.message || String(e),
        },
        500
      )
    );
  }
}