// functions/api/reorder.js
import { requireAuth, json, badRequest, forbidden } from "./_auth";

const isoNow = () => new Date().toISOString();
const norm = (v = "") => String(v).trim().toLowerCase();

async function isStageOwner(db, email, projectName, stageName) {
  if (!email || !projectName || !stageName) return false;
  const r = await db
    .prepare(
      `SELECT 1 FROM project_stages
       WHERE projectName = ? AND stageName = ? AND stageOwnerEmail = ?
       LIMIT 1`
    )
    .bind(projectName, stageName, email)
    .first();
  return !!r;
}

export async function onRequestPost(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  const body = await context.request.json().catch(() => null);
  const updates = Array.isArray(body?.updates) ? body.updates : [];
  if (!updates.length) return badRequest("updates is required");

  const db = context.env.DB;
  const now = isoNow();
  const me = norm(user.email);

  for (const u of updates) {
    const id = String(u?.id || "").trim();
    const status = u?.status != null ? String(u.status) : null;
    const sortOrder = Number(u?.sortOrder);

    if (!id || !Number.isFinite(sortOrder)) continue;

    const task = await db.prepare(`SELECT id, ownerEmail, projectName, stage FROM tasks WHERE id = ?`).bind(id).first();
    if (!task) continue;

    const ownerEmail = norm(task.ownerEmail);
    const stageOwnerOk = await isStageOwner(db, me, task.projectName, task.stage);

    // Permission
    if (!user.isAdmin && me !== ownerEmail && !stageOwnerOk) {
      return forbidden("Read-only: you can only reorder tasks you own or tasks in stages you own");
    }

    if (status) {
      await db
        .prepare(`UPDATE tasks SET status = ?, sortOrder = ?, updatedAt = ? WHERE id = ?`)
        .bind(status, sortOrder, now, id)
        .run();
    } else {
      await db
        .prepare(`UPDATE tasks SET sortOrder = ?, updatedAt = ? WHERE id = ?`)
        .bind(sortOrder, now, id)
        .run();
    }
  }

  return json({ ok: true });
}