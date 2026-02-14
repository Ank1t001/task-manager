// functions/api/projects.js
import { getUser, json, badRequest, unauthorized, forbidden } from "./_auth";

function nowIso() {
  return new Date().toISOString();
}

export async function onRequestGet(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  const db = context.env.DB;

  // Admin: all projects
  if (user.isAdmin) {
    const rows = await db
      .prepare(`SELECT projectName, ownerEmail, createdAt FROM projects ORDER BY projectName ASC`)
      .all();
    return json({ projects: rows.results || [] });
  }

  // Member: only projects where user can see tasks (assigned OR stage-owner)
  const rows = await db
    .prepare(
      `
      SELECT DISTINCT p.projectName, p.ownerEmail, p.createdAt
      FROM projects p
      WHERE EXISTS (
        SELECT 1
        FROM tasks t
        WHERE t.projectName = p.projectName
          AND (
            t.ownerEmail = ?
            OR EXISTS (
              SELECT 1 FROM project_stages ps
              WHERE ps.projectName = t.projectName
                AND ps.stageName = t.stage
                AND ps.stageOwnerEmail = ?
            )
          )
      )
      ORDER BY p.projectName ASC
      `
    )
    .bind(user.email, user.email)
    .all();

  return json({ projects: rows.results || [] });
}

export async function onRequestPost(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  // Only Admin can create projects (recommended)
  if (!user.isAdmin) return forbidden("Only admin can create projects");

  const body = await context.request.json().catch(() => null);
  const projectName = String(body?.projectName || "").trim();
  const ownerEmail = String(body?.ownerEmail || user.email).trim().toLowerCase();

  if (!projectName) return badRequest("projectName is required");
  if (!ownerEmail) return badRequest("ownerEmail is required");

  const db = context.env.DB;

  await db
    .prepare(`INSERT INTO projects (id, projectName, ownerEmail, createdAt) VALUES (?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), projectName, ownerEmail, nowIso())
    .run();

  return json({ ok: true, projectName, ownerEmail });
}

export async function onRequestDelete(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  const url = new URL(context.request.url);
  const projectName = String(url.searchParams.get("projectName") || "").trim();
  if (!projectName) return badRequest("projectName is required");

  const db = context.env.DB;

  const project = await db
    .prepare(`SELECT projectName, ownerEmail FROM projects WHERE projectName = ?`)
    .bind(projectName)
    .first();

  if (!project) return badRequest("Project not found");

  const ownerEmail = String(project.ownerEmail || "").toLowerCase();
  const me = String(user.email || "").toLowerCase();

  // Admin OR Project Owner can delete
  if (!user.isAdmin && me !== ownerEmail) {
    return forbidden("Only admin or project owner can delete project");
  }

  // Delete everything under project (safe cascade)
  await db.prepare(`DELETE FROM activity_log WHERE projectName = ?`).bind(projectName).run();
  await db.prepare(`DELETE FROM project_stages WHERE projectName = ?`).bind(projectName).run();
  await db.prepare(`DELETE FROM tasks WHERE projectName = ?`).bind(projectName).run();
  await db.prepare(`DELETE FROM projects WHERE projectName = ?`).bind(projectName).run();

  return json({ ok: true, projectName });
}