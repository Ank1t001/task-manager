// functions/api/stages-reorder.js
import { getUser, json, badRequest, unauthorized, forbidden } from "./_auth";

const norm = (v = "") => String(v).trim().toLowerCase();

export async function onRequestPut(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  const body = await context.request.json().catch(() => null);
  const projectName = String(body?.projectName || "").trim();
  const orderedStageNames = Array.isArray(body?.orderedStageNames) ? body.orderedStageNames : [];

  if (!projectName) return badRequest("projectName is required");
  if (!orderedStageNames.length) return badRequest("orderedStageNames is required");

  const db = context.env.DB;

  // Fetch project owner to allow owner/admin
  const proj = await db.prepare(`SELECT ownerEmail FROM projects WHERE name = ?`).bind(projectName).first();
  if (!proj) return badRequest("Project not found");

  const me = norm(user.email);
  const owner = norm(proj.ownerEmail);
  const canManage = user.isAdmin || (me && owner && me === owner);
  if (!canManage) return forbidden("Only admin or project owner can reorder stages");

  for (let i = 0; i < orderedStageNames.length; i++) {
    const stageName = String(orderedStageNames[i] || "").trim();
    if (!stageName) continue;

    await db
      .prepare(
        `UPDATE project_stages
         SET sortOrder = ?
         WHERE projectName = ? AND stageName = ?`
      )
      .bind((i + 1) * 10, projectName, stageName)
      .run();
  }

  return json({ ok: true });
}