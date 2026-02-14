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
  return s || "To Do";
}

function nowIso() {
  return new Date().toISOString();
}

async function getTaskById(db, id) {
  return (await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first()) || null;
}

async function isStageOwner(db, email, projectName, stage) {
  if (!email || !projectName || !stage) return false;
  const row = await db
    .prepare(
      `SELECT 1 FROM project_stages
       WHERE projectName = ?
         AND stageName = ?
         AND stageOwnerEmail = ?
       LIMIT 1`
    )
    .bind(projectName, stage, email)
    .first();
  return !!row;
}

export async function onRequestGet(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  const url = new URL(context.request.url);
  const projectName = (url.searchParams.get("projectName") || "").trim();

  const db = context.env.DB;

  if (user.isAdmin) {
    const sql = `
      SELECT *
      FROM tasks
      ${projectName ? "WHERE projectName = ?" : ""}
      ORDER BY updatedAt DESC
    `;
    const rows = projectName ? await db.prepare(sql).bind(projectName).all() : await db.prepare(sql).all();
    return json(rows.results || []);
  }

  // Member: owner OR stage owner
  const sql = `
    SELECT *
    FROM tasks
    WHERE
      (ownerEmail = ?)
      OR EXISTS (
        SELECT 1
        FROM project_stages ps
        WHERE ps.projectName = tasks.projectName
          AND ps.stageName = tasks.stage
          AND ps.stageOwnerEmail = ?
      )
    ${projectName ? "AND tasks.projectName = ?" : ""}
    ORDER BY updatedAt DESC
  `;

  const stmt = projectName
    ? db.prepare(sql).bind(user.email, user.email, projectName)
    : db.prepare(sql).bind(user.email, user.email);

  const rows = await stmt.all();
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

  const projectName = String(body.projectName || "").trim();
  const stage = String(body.stage || "").trim();

  const owner = String(body.owner || "").trim();
  const ownerEmail = String(body.ownerEmail || "").trim().toLowerCase();

  // Member can only create tasks for themselves OR (if they are stage owner, allow create in their stage)
  if (!user.isAdmin) {
    const stageOwnerOk = await isStageOwner(db, user.email, projectName, stage);
    if (!stageOwnerOk && ownerEmail !== user.email) {
      return forbidden("Members can only create tasks assigned to themselves (unless they are Stage Owner)");
    }
  }

  const description = String(body.description || "");
  const type = String(body.type || body.section || "Other");
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

  if (projectName) {
    await logActivity(db, {
      projectName,
      taskId: id,
      actorEmail: user.email,
      actorName: user.name,
      action: "TASK_CREATED",
      summary: `${user.name} created "${taskName}"${stage ? ` (${projectName} → ${stage})` : ` (${projectName})`}`,
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

  const existingOwnerEmail = String(existing.ownerEmail || "").toLowerCase();
  const existingProjectName = String(existing.projectName || "");
  const existingStage = String(existing.stage || "");

  // Member update permissions: owner OR stage owner
  if (!user.isAdmin) {
    const stageOwnerOk = await isStageOwner(db, user.email, existingProjectName, existingStage);
    if (!stageOwnerOk && existingOwnerEmail !== user.email) {
      return forbidden("You can only update tasks assigned to you (or tasks in your owned stage)");
    }
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

  // Member: cannot reassign owner unless admin (stage owner can manage status/priority/due/stage, but not owner email)
  if (!user.isAdmin) {
    next.ownerEmail = existing.ownerEmail;
    next.owner = existing.owner;
  }

  const updatedAt = nowIso();

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

  // Log diff
  if (next.projectName) {
    const diff = {};
    const fields = ["taskName", "description", "type", "priority", "status", "dueDate", "externalStakeholders", "stage", "sortOrder"];
    for (const f of fields) {
      const oldVal = existing[f] ?? "";
      const newVal = next[f] ?? "";
      if (String(oldVal) !== String(newVal)) diff[f] = { from: oldVal, to: newVal };
    }

    if (Object.keys(diff).length > 0) {
      const action = diff.status ? "STATUS_CHANGED" : "TASK_UPDATED";
      const summary = diff.status
        ? `${user.name} moved "${next.taskName}" ${diff.status.from} → ${diff.status.to}`
        : `${user.name} updated "${next.taskName}"`;

      await logActivity(db, {
        projectName: next.projectName,
        taskId: id,
        actorEmail: user.email,
        actorName: user.name,
        action,
        summary,
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

  const existingOwnerEmail = String(existing.ownerEmail || "").toLowerCase();

  // Member delete permissions: owner OR stage owner
  if (!user.isAdmin) {
    const stageOwnerOk = await isStageOwner(db, user.email, existing.projectName, existing.stage);
    if (!stageOwnerOk && existingOwnerEmail !== user.email) {
      return forbidden("You can only delete tasks assigned to you (or tasks in your owned stage)");
    }
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