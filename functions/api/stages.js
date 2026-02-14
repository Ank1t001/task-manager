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
      `SELECT stageName, sortOrder
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
  const stages = Array.isArray(body?.stages) ? body.stages : [];

  if (!projectName) return badRequest("projectName is required");
  if (stages.length === 0) return badRequest("stages array is required");

  // Clean + unique
  const cleanStages = [];
  const seen = new Set();
  for (const s of stages) {
    const name = String(s || "").trim();
    if (!name) continue;
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    cleanStages.push(name);
  }
  if (cleanStages.length === 0) return badRequest("No valid stages");

  // overwrite stages
  await db.prepare(`DELETE FROM project_stages WHERE projectName = ?`).bind(projectName).run();

  const createdAt = new Date().toISOString();
  for (let i = 0; i < cleanStages.length; i++) {
    await db
      .prepare(
        `INSERT INTO project_stages (id, projectName, stageName, sortOrder, createdAt)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), projectName, cleanStages[i], (i + 1) * 10, createdAt)
      .run();
  }

  return json({ ok: true, projectName, stages: cleanStages });
}