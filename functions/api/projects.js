// functions/api/projects.js
import { getUser, json, unauthorized } from "./_auth";

export async function onRequestGet(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  const db = context.env.DB;

  const sqlAdmin = `
    SELECT DISTINCT projectName
    FROM tasks
    WHERE projectName IS NOT NULL AND projectName != ''
    ORDER BY projectName ASC
  `;

  const sqlMember = `
    SELECT DISTINCT projectName
    FROM tasks
    WHERE projectName IS NOT NULL AND projectName != ''
      AND ownerEmail = ?
    ORDER BY projectName ASC
  `;

  const result = user.isAdmin
    ? await db.prepare(sqlAdmin).all()
    : await db.prepare(sqlMember).bind(user.email).all();

  const projects = (result.results || []).map((r) => r.projectName);
  return json({ projects });
}