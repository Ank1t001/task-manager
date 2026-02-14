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
         LIMIT 300`
      )
      .bind(projectName)
      .all();

    return json({ projectName, activity: rows.results || [] });
  }

  // Member: visible task ids under this project
  const idsRes = await db
    .prepare(
      `SELECT id
       FROM tasks
       WHERE projectName = ?
         AND (
           ownerEmail = ?
           OR EXISTS (
             SELECT 1 FROM project_stages ps
             WHERE ps.projectName = tasks.projectName
               AND ps.stageName = tasks.stage
               AND ps.stageOwnerEmail = ?
           )
         )`
    )
    .bind(projectName, user.email, user.email)
    .all();

  const ids = (idsRes.results || []).map((r) => r.id);
  if (ids.length === 0) return json({ projectName, activity: [] });

  const placeholders = ids.map(() => "?").join(",");
  const sql = `
    SELECT *
    FROM activity_log
    WHERE projectName = ?
      AND taskId IN (${placeholders})
    ORDER BY createdAt DESC
    LIMIT 300
  `;

  const rows = await db.prepare(sql).bind(projectName, ...ids).all();
  return json({ projectName, activity: rows.results || [] });
}