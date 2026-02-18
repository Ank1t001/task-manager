// functions/api/task-stage-progress.js
import { requireAuth, json, badRequest, forbidden } from "./_auth";

const isoNow = () => new Date().toISOString();

// GET /api/task-stage-progress?taskId=xxx
// Returns all stage progress rows for a task
export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const url = new URL(context.request.url);
  const taskId = (url.searchParams.get("taskId") || "").trim();
  if (!taskId) return badRequest("taskId is required");

  const db = context.env.DB;
  const rows = await db
    .prepare(`SELECT * FROM task_stage_progress WHERE taskId = ? ORDER BY sortOrder ASC`)
    .bind(taskId)
    .all();

  return json({ taskId, progress: rows.results || [] });
}

// POST /api/task-stage-progress
// Body: { taskId, stageName, status, assignedTo, assignedToEmail, advanceToNext }
export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { user, tenant } = auth;

  const isAdmin = tenant.role === "admin";
  const db = context.env.DB;
  const body = await context.request.json().catch(() => null);

  const taskId        = String(body?.taskId || "").trim();
  const stageName     = String(body?.stageName || "").trim();
  const status        = String(body?.status || "To Do").trim();
  const assignedTo    = String(body?.assignedTo || user.name || "").trim();
  const assignedToEmail = String(body?.assignedToEmail || user.email || "").trim().toLowerCase();
  const advanceToNext = !!body?.advanceToNext;

  if (!taskId) return badRequest("taskId is required");
  if (!stageName) return badRequest("stageName is required");
  if (!["To Do", "In Progress", "Done"].includes(status)) return badRequest("Invalid status");

  // Get task to verify access
  const task = await db.prepare(`SELECT * FROM tasks WHERE id = ? LIMIT 1`).bind(taskId).first();
  if (!task) return badRequest("Task not found");

  // Check permission: admin, stage owner, or task owner
  const stageRow = await db
    .prepare(`SELECT stageOwnerEmail FROM project_stages WHERE projectName = ? AND stageName = ? LIMIT 1`)
    .bind(task.projectName, stageName)
    .first();

  const isStageOwner = stageRow?.stageOwnerEmail && stageRow.stageOwnerEmail.toLowerCase() === (user.email || "").toLowerCase();
  const isTaskOwner  = task.ownerEmail && task.ownerEmail.toLowerCase() === (user.email || "").toLowerCase();

  if (!isAdmin && !isStageOwner && !isTaskOwner) {
    return forbidden("Only admin, stage owner, or task owner can update stage progress");
  }

  const now = isoNow();

  // Get sortOrder for this stage
  const sortRow = await db
    .prepare(`SELECT sortOrder FROM project_stages WHERE projectName = ? AND stageName = ? LIMIT 1`)
    .bind(task.projectName, stageName)
    .first();
  const sortOrder = sortRow?.sortOrder ?? 0;

  // Upsert stage progress
  const existing = await db
    .prepare(`SELECT id FROM task_stage_progress WHERE taskId = ? AND stageName = ? LIMIT 1`)
    .bind(taskId, stageName)
    .first();

  if (existing) {
    await db.prepare(`
      UPDATE task_stage_progress
      SET status = ?, assignedTo = ?, assignedToEmail = ?, updatedAt = ?
      WHERE taskId = ? AND stageName = ?
    `).bind(status, assignedTo, assignedToEmail, now, taskId, stageName).run();
  } else {
    await db.prepare(`
      INSERT INTO task_stage_progress (id, taskId, projectName, stageName, sortOrder, status, assignedTo, assignedToEmail, startedAt, completedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), taskId, task.projectName, stageName, sortOrder,
      status, assignedTo, assignedToEmail,
      status !== "To Do" ? now : null,
      status === "Done" ? now : null,
      now, now
    ).run();
  }

  // Update completedAt / startedAt
  if (status === "Done") {
    await db.prepare(`UPDATE task_stage_progress SET completedAt = ? WHERE taskId = ? AND stageName = ? AND completedAt IS NULL`)
      .bind(now, taskId, stageName).run();
  }
  if (status === "In Progress") {
    await db.prepare(`UPDATE task_stage_progress SET startedAt = ? WHERE taskId = ? AND stageName = ? AND startedAt IS NULL`)
      .bind(now, taskId, stageName).run();
  }

  // Auto-advance: update task's current stage to next stage
  if (advanceToNext && status === "Done") {
    const allStages = await db
      .prepare(`SELECT stageName, sortOrder FROM project_stages WHERE projectName = ? ORDER BY sortOrder ASC`)
      .bind(task.projectName)
      .all();

    const stages = allStages.results || [];
    const currentIdx = stages.findIndex(s => s.stageName === stageName);
    const nextStage = stages[currentIdx + 1];

    if (nextStage) {
      await db.prepare(`UPDATE tasks SET stage = ?, updatedAt = ? WHERE id = ?`)
        .bind(nextStage.stageName, now, taskId).run();
      
      // Pre-create To Do entry for next stage
      const nextExists = await db
        .prepare(`SELECT id FROM task_stage_progress WHERE taskId = ? AND stageName = ? LIMIT 1`)
        .bind(taskId, nextStage.stageName).first();

      if (!nextExists) {
        await db.prepare(`
          INSERT INTO task_stage_progress (id, taskId, projectName, stageName, sortOrder, status, assignedTo, assignedToEmail, startedAt, completedAt, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, 'To Do', '', '', null, null, ?, ?)
        `).bind(crypto.randomUUID(), taskId, task.projectName, nextStage.stageName, nextStage.sortOrder, now, now).run();
      }
    }
  }

  // Return updated progress
  const updated = await db
    .prepare(`SELECT * FROM task_stage_progress WHERE taskId = ? ORDER BY sortOrder ASC`)
    .bind(taskId).all();

  return json({ ok: true, taskId, progress: updated.results || [] });
}