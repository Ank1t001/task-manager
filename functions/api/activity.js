// functions/api/activity.js
import { getUser, json, badRequest, unauthorized } from "./_auth";

export async function onRequestGet(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  const url = new URL(context.request.url);
  const projectName = (url.searchParams.get("projectName") || "").trim();
  if (!projectName) return badRequest("projectName is required");

  const db = context.env.DB;

  // Admin: all activity
  if (user.isAdmin) {
    const rows = await db
      .prepare(
        `SELECT *
         FROM activity_log
         WHERE projectName = ?
         ORDER BY createdAt DESC
         LIMIT 250`
      )
      .bind(projectName)
      .all();

    return json({ projectName, activity: rows.results || [] });
  }

  // Member: only activity for tasks they can see in this project
  const taskIdsRes = await db
    .prepare(`SELECT id FROM tasks WHERE projectName = ? AND ownerEmail = ?`)
    .bind(projectName, user.email)
    .all();

  const ids = (taskIdsRes.results || []).map((r) => r.id);
  if (ids.length === 0) {
    return json({ projectName, activity: [] });
  }

  // Build dynamic IN (...)
  const placeholders = ids.map(() => "?").join(",");
  const sql = `
    SELECT *
    FROM activity_log
    WHERE projectName = ?
      AND taskId IN (${placeholders})
    ORDER BY createdAt DESC
    LIMIT 250
  `;

  const stmt = db.prepare(sql).bind(projectName, ...ids);
  const rows = await stmt.all();

  return json({ projectName, activity: rows.results || [] });
}