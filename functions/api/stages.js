// functions/api/stages.js
import { getUser, json, badRequest, unauthorized, forbidden } from "./_auth";

export async function onRequestGet(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  const url = new URL(context.request.url);
  const projectName = (url.searchParams.get("projectName") || "").trim();
  if (!projectName) return badRequest("projectName is required");

  const db = context.env.DB;

  const rows = await db
    .prepare(
      `SELECT stageName, sortOrder, stageOwnerEmail
       FROM project_stages
       WHERE projectName = ?
       ORDER BY sortOrder ASC`
    )
    .bind(projectName)
    .all();

  return json({ projectName, stages: rows.results || [] });
}

export async function onRequestPost(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();
  if (!user.isAdmin) return forbidden("Only admin can edit stages");

  const db = context.env.DB;
  const body = await context.request.json().catch(() => null);

  const projectName = (body?.projectName || "").trim();
  const stagesIn = Array.isArray(body?.stages) ? body.stages : [];

  if (!projectName) return badRequest("projectName is required");
  if (stagesIn.length === 0) return badRequest("stages array is required");

  // Normalize:
  // - string => {stageName, stageOwnerEmail:""}
  // - object => {stageName, stageOwnerEmail}
  const clean = [];
  const seen = new Set();

  for (const item of stagesIn) {
    if (typeof item === "string") {
      const name = item.trim();
      if (!name) continue;
      const k = name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      clean.push({ stageName: name, stageOwnerEmail: "" });
      continue;
    }

    if (item && typeof item === "object") {
      const name = String(item.stageName || "").trim();
      if (!name) continue;
      const k = name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      clean.push({
        stageName: name,
        stageOwnerEmail: String(item.stageOwnerEmail || "").trim().toLowerCase(),
      });
    }
  }

  if (clean.length === 0) return badRequest("No valid stages");

  // Overwrite stages for project
  await db.prepare(`DELETE FROM project_stages WHERE projectName = ?`).bind(projectName).run();

  const createdAt = new Date().toISOString();
  for (let i = 0; i < clean.length; i++) {
    await db
      .prepare(
        `INSERT INTO project_stages (id, projectName, stageName, sortOrder, stageOwnerEmail, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        projectName,
        clean[i].stageName,
        (i + 1) * 10,
        clean[i].stageOwnerEmail || "",
        createdAt
      )
      .run();
  }

  return json({ ok: true, projectName, stages: clean });
}