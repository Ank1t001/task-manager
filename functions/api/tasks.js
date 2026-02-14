// functions/api/tasks.js
import { getUser, json, badRequest, unauthorized, forbidden } from "./_auth";
import { logActivity } from "./_activity";

function normalizeStatus(s) {
  const v = String(s || "").trim().toLowerCase();
  if (v === "blocked") return "In Progress";
  if (v === "inprogress") return "In Progress";
  if (v === "todo") return "To Do";
  if (v === "done") return "Done";
  if (v === "to do") return "To Do";
  if (v === "in progress") return "In Progress";
  if (v === "done") return "Done";
  return s || "To Do";
}

function nowIso() {
  return new Date().toISOString();
}

async function getTaskById(db, id) {
  const r = await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first();
  return r || null;
}

export async function onRequestGet(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  const url = new URL(context.request.url);
  const projectName = (url.searchParams.get("projectName") || "").trim();

  const db = context.env.DB;

  // Members only see their tasks
  if (!user.isAdmin) {
    const sql = `
      SELECT *
      FROM tasks
      WHERE ownerEmail = ?
      ${projectName ? "AND projectName = ?" : ""}
      ORDER BY status ASC, sortOrder ASC, updatedAt DESC
    `;
    const stmt = projectName
      ? db.prepare(sql).bind(user.email, projectName)
      : db.prepare(sql).bind(user.email);

    const rows = await stmt.all();
    return json(rows.results || []);
  }

  // Admin sees all
  const sqlAdmin = `
    SELECT *
    FROM tasks
    ${projectName ? "WHERE projectName = ?" : ""}
    ORDER BY status ASC, sortOrder ASC, updatedAt DESC
  `;
  const rows = projectName
    ? await db.prepare(sqlAdmin).bind(projectName).all()
    : await db.prepare(sqlAdmin).all();

  return json(rows.results || []);
}

export async function onRequestPost(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  const db = context.env.DB;
  const body = await context.request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON");

  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const updatedAt = createdAt;

  const taskName = String(body.taskName || "").trim();
  if (!taskName) return badRequest("taskName is required");

  const owner = String(body.owner || "").trim();
  const ownerEmail = String(body.ownerEmail || "").trim().toLowerCase();

  // Member can only create tasks for themselves
  if (!user.isAdmin) {
    if (ownerEmail !== user.email) {
      return forbidden("Members can only create tasks assigned to themselves");
    }
  }

  const projectName = String(body.projectName || "").trim(); // NAME ONLY
  const stage = String(body.stage || "").trim();

  const description = String(body.description || "");
  const type = String(body.type || body.section || "Other"); // keep your existing type field
  const priority = String(body.priority || "Medium");
  const status = normalizeStatus(body.status || "To Do");
  const dueDate = String(body.dueDate || "");
  const externalStakeholders = String(body.externalStakeholders || "");

  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

  await db
    .prepare(
      `INSERT INTO tasks (
        id, taskName, description, owner, ownerEmail,
        type, priority, status, dueDate, externalStakeholders,
        createdAt, updatedAt,
        projectName, stage, completedAt,
        sortOrder
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      taskName,
      description,
      owner,
      ownerEmail,
      type,
      priority,
      status,
      dueDate,
      externalStakeholders,
      createdAt,
      updatedAt,
      projectName,
      stage,
      status === "Done" ? nowIso() : "",
      sortOrder
    )
    .run();

  // Activity log (only if projectName provided; you can remove condition if you want logs always)
  if (projectName) {
    await logActivity(db, {
      projectName,
      taskId: id,
      actorEmail: user.email,
      actorName: user.name,
      action: "TASK_CREATED",
      summary: `${user.name} created task "${taskName}"${stage ? ` in ${projectName} → ${stage}` : ` in ${projectName}`}`,
      meta: { taskName, projectName, stage, ownerEmail },
    });
  }

  return json({ ok: true, id });
}

export async function onRequestPut(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  const db = context.env.DB;
  const body = await context.request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON");

  const id = String(body.id || "").trim();
  if (!id) return badRequest("id is required");

  const existing = await getTaskById(db, id);
  if (!existing) return badRequest("Task not found");

  // Member can only update their tasks
  if (!user.isAdmin && String(existing.ownerEmail || "").toLowerCase() !== user.email) {
    return forbidden("You can only update tasks assigned to you");
  }

  const next = {
    taskName: String(body.taskName ?? existing.taskName ?? "").trim(),
    description: String(body.description ?? existing.description ?? ""),
    owner: String(body.owner ?? existing.owner ?? "").trim(),
    ownerEmail: String(body.ownerEmail ?? existing.ownerEmail ?? "").trim().toLowerCase(),
    type: String(body.type ?? body.section ?? existing.type ?? "Other"),
    priority: String(body.priority ?? existing.priority ?? "Medium"),
    status: normalizeStatus(body.status ?? existing.status ?? "To Do"),
    dueDate: String(body.dueDate ?? existing.dueDate ?? ""),
    externalStakeholders: String(body.externalStakeholders ?? existing.externalStakeholders ?? ""),
    projectName: String(body.projectName ?? existing.projectName ?? "").trim(),
    stage: String(body.stage ?? existing.stage ?? "").trim(),
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : Number(existing.sortOrder ?? 0),
  };

  // Member cannot reassign ownerEmail/owner
  if (!user.isAdmin) {
    next.ownerEmail = existing.ownerEmail;
    next.owner = existing.owner;
  }

  const updatedAt = nowIso();

  // completedAt management
  let completedAt = existing.completedAt || "";
  if (next.status === "Done" && !completedAt) completedAt = nowIso();
  if (next.status !== "Done") completedAt = "";

  await db
    .prepare(
      `UPDATE tasks SET
        taskName = ?, description = ?,
        owner = ?, ownerEmail = ?,
        type = ?, priority = ?, status = ?, dueDate = ?, externalStakeholders = ?,
        projectName = ?, stage = ?, completedAt = ?,
        sortOrder = ?, updatedAt = ?
       WHERE id = ?`
    )
    .bind(
      next.taskName,
      next.description,
      next.owner,
      next.ownerEmail,
      next.type,
      next.priority,
      next.status,
      next.dueDate,
      next.externalStakeholders,
      next.projectName,
      next.stage,
      completedAt,
      next.sortOrder,
      updatedAt,
      id
    )
    .run();

  // Log diff (only when projectName exists)
  if (next.projectName) {
    const diff = {};
    const fields = ["taskName", "description", "owner", "ownerEmail", "type", "priority", "status", "dueDate", "externalStakeholders", "projectName", "stage", "sortOrder"];
    for (const f of fields) {
      const oldVal = existing[f] ?? "";
      const newVal = next[f] ?? "";
      if (String(oldVal) !== String(newVal)) diff[f] = { from: oldVal, to: newVal };
    }

    if (Object.keys(diff).length > 0) {
      await logActivity(db, {
        projectName: next.projectName,
        taskId: id,
        actorEmail: user.email,
        actorName: user.name,
        action: "TASK_UPDATED",
        summary: `${user.name} updated "${next.taskName}"`,
        meta: { diff },
      });
    }
  }

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  const url = new URL(context.request.url);
  const id = String(url.searchParams.get("id") || "").trim();
  if (!id) return badRequest("id is required");

  const db = context.env.DB;
  const existing = await getTaskById(db, id);
  if (!existing) return badRequest("Task not found");

  // Member can only delete their tasks
  if (!user.isAdmin && String(existing.ownerEmail || "").toLowerCase() !== user.email) {
    return forbidden("You can only delete tasks assigned to you");
  }

  await db.prepare(`DELETE FROM tasks WHERE id = ?`).bind(id).run();

  if (existing.projectName) {
    await logActivity(db, {
      projectName: existing.projectName,
      taskId: id,
      actorEmail: user.email,
      actorName: user.name,
      action: "TASK_DELETED",
      summary: `${user.name} deleted "${existing.taskName}"`,
      meta: { taskName: existing.taskName },
    });
  }

  return json({ ok: true });
}