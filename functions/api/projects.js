// functions/api/projects.js
import { getUser, json, badRequest, unauthorized, forbidden } from "./_auth";

const isoNow = () => new Date().toISOString();
const norm = (v = "") => String(v).trim().toLowerCase();

function parseArchivedParam(v) {
  const x = String(v ?? "0").toLowerCase();
  if (x === "all") return "all";
  if (x === "1" || x === "true") return 1;
  return 0; // default active
}

export async function onRequestGet(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  const url = new URL(context.request.url);
  const archived = parseArchivedParam(url.searchParams.get("archived"));

  const db = context.env.DB;

  // Admin: all projects (filtered)
  if (user.isAdmin) {
    const sql =
      archived === "all"
        ? `SELECT name, ownerName, ownerEmail, createdAt, updatedAt, archived
           FROM projects
           ORDER BY archived ASC, name ASC`
        : `SELECT name, ownerName, ownerEmail, createdAt, updatedAt, archived
           FROM projects
           WHERE archived = ?
           ORDER BY name ASC`;

    const rows =
      archived === "all"
        ? await db.prepare(sql).all()
        : await db.prepare(sql).bind(archived).all();

    return json({ projects: rows.results || [] });
  }

  // Members: show ONLY projects they can see tasks for (assigned OR stage-owner) (filtered)
  const baseSql = `
    SELECT DISTINCT p.name, p.ownerName, p.ownerEmail, p.createdAt, p.updatedAt, p.archived
    FROM projects p
    WHERE EXISTS (
      SELECT 1
      FROM tasks t
      WHERE t.projectName = p.name
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
  `;

  const sql =
    archived === "all"
      ? `${baseSql} ORDER BY p.archived ASC, p.name ASC`
      : `${baseSql} AND p.archived = ? ORDER BY p.name ASC`;

  const stmt =
    archived === "all"
      ? db.prepare(sql).bind(user.email, user.email)
      : db.prepare(sql).bind(user.email, user.email, archived);

  const rows = await stmt.all();
  return json({ projects: rows.results || [] });
}

export async function onRequestPost(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  // Create project: Admin only (recommended; you can relax later)
  if (!user.isAdmin) return forbidden("Only admin can create projects");

  const body = await context.request.json().catch(() => null);

  const name = String(body?.name || body?.projectName || "").trim();
  const ownerEmail = norm(body?.ownerEmail || user.email);
  const ownerName = String(body?.ownerName || user.name || "").trim() || ownerEmail.split("@")[0];

  if (!name) return badRequest("name is required");
  if (!ownerEmail) return badRequest("ownerEmail is required");

  const db = context.env.DB;
  const now = isoNow();

  await db
    .prepare(
      `INSERT INTO projects (id, name, ownerName, ownerEmail, createdAt, updatedAt, archived)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    )
    .bind(crypto.randomUUID(), name, ownerName, ownerEmail, now, now)
    .run();

  return json({ ok: true, name, ownerName, ownerEmail });
}

export async function onRequestPut(context) {
  const user = getUser(context);
  if (!user.email) return unauthorized();

  const body = await context.request.json().catch(() => null);
  const name = String(body?.name || body?.projectName || "").trim();
  if (!name) return badRequest("name is required");

  const db = context.env.DB;

  const proj = await db
    .prepare(`SELECT name, ownerName, ownerEmail, archived FROM projects WHERE name = ?`)
    .bind(name)
    .first();

  if (!proj) return badRequest("Project not found");

  const me = norm(user.email);
  const owner = norm(proj.ownerEmail);

  const canManage = user.isAdmin || (me && owner && me === owner);
  if (!canManage) return forbidden("Only admin or project owner can update project");

  const updates = [];
  const binds = [];

  // Transfer ownership (Admin OR current owner)
  if (body?.ownerEmail != null) {
    const nextOwnerEmail = norm(body.ownerEmail);
    if (!nextOwnerEmail) return badRequest("ownerEmail cannot be empty");

    const nextOwnerName =
      String(body?.ownerName || "").trim() || nextOwnerEmail.split("@")[0];

    if (nextOwnerEmail !== owner) {
      updates.push("ownerEmail = ?");
      binds.push(nextOwnerEmail);

      updates.push("ownerName = ?");
      binds.push(nextOwnerName);
    }
  }

  // Archive / unarchive
  if (body?.archived != null) {
    const a = Number(body.archived);
    if (a !== 0 && a !== 1) return badRequest("archived must be 0 or 1");
    updates.push("archived = ?");
    binds.push(a);
  }

  if (updates.length === 0) return json({ ok: true, name, unchanged: true });

  updates.push("updatedAt = ?");
  binds.push(isoNow());

  binds.push(name);

  await db
    .prepare(`UPDATE projects SET ${updates.join(", ")} WHERE name = ?`)
    .bind(...binds)
    .run();

  return json({ ok: true, name });
}