import { requireAuth, json, badRequest, forbidden } from "./_auth";

const isoNow = () => new Date().toISOString();
const norm = (v = "") => String(v).trim().toLowerCase();

function parseArchivedParam(v) {
  const x = String(v ?? "0").toLowerCase();
  if (x === "all") return "all";
  if (x === "1" || x === "true") return 1;
  return 0;
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { user, tenant } = auth;
  const isAdmin = tenant.role === "admin";

  const url = new URL(context.request.url);
  const archived = parseArchivedParam(url.searchParams.get("archived"));
  const db = context.env.DB;

  if (isAdmin) {
    const sql = archived === "all"
      ? `SELECT name, ownerName, ownerEmail, createdAt, updatedAt, archived FROM projects ORDER BY archived ASC, name ASC`
      : `SELECT name, ownerName, ownerEmail, createdAt, updatedAt, archived FROM projects WHERE archived = ? ORDER BY name ASC`;
    const rows = archived === "all" ? await db.prepare(sql).all() : await db.prepare(sql).bind(archived).all();
    return json({ projects: rows.results || [] });
  }

  const baseSql = `
    SELECT DISTINCT p.name, p.ownerName, p.ownerEmail, p.createdAt, p.updatedAt, p.archived
    FROM projects p
    WHERE EXISTS (
      SELECT 1 FROM tasks t WHERE t.projectName = p.name
      AND (t.ownerEmail = ? OR EXISTS (
        SELECT 1 FROM project_stages ps
        WHERE ps.projectName = t.projectName AND ps.stageName = t.stage AND ps.stageOwnerEmail = ?
      ))
    )`;
  const sql = archived === "all" ? `${baseSql} ORDER BY p.archived ASC, p.name ASC` : `${baseSql} AND p.archived = ? ORDER BY p.name ASC`;
  const stmt = archived === "all" ? db.prepare(sql).bind(user.email, user.email) : db.prepare(sql).bind(user.email, user.email, archived);
  const rows = await stmt.all();
  return json({ projects: rows.results || [] });
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { user, tenant } = auth;
  if (tenant.role !== "admin") return forbidden("Only admin can create projects");

  const body = await context.request.json().catch(() => null);
  const name = String(body?.name || "").trim();
  const ownerEmail = norm(body?.ownerEmail || user.email);
  const ownerName = String(body?.ownerName || user.name || "").trim() || ownerEmail.split("@")[0];
  if (!name) return badRequest("name is required");
  if (!ownerEmail) return badRequest("ownerEmail is required");

  const db = context.env.DB;
  const now = isoNow();
  await db.prepare(`INSERT INTO projects (id, name, ownerName, ownerEmail, createdAt, updatedAt, archived) VALUES (?, ?, ?, ?, ?, ?, 0)`)
    .bind(crypto.randomUUID(), name, ownerName, ownerEmail, now, now).run();

  const stagesIn = Array.isArray(body?.stages) ? body.stages : [];
  if (stagesIn.length) {
    const clean = [];
    const seen = new Set();
    for (const item of stagesIn) {
      if (typeof item === "string") {
        const s = item.trim(); if (!s) continue;
        const k = s.toLowerCase(); if (seen.has(k)) continue;
        seen.add(k); clean.push({ stageName: s, stageOwnerEmail: "" });
      } else if (item && typeof item === "object") {
        const stageName = String(item.stageName || "").trim();
        const stageOwnerEmail = norm(item.stageOwnerEmail || "");
        if (!stageName) continue;
        const k = stageName.toLowerCase(); if (seen.has(k)) continue;
        seen.add(k); clean.push({ stageName, stageOwnerEmail });
      }
    }
    for (let i = 0; i < clean.length; i++) {
      await db.prepare(`INSERT INTO project_stages (id, projectName, stageName, sortOrder, stageOwnerEmail, createdAt) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), name, clean[i].stageName, (i + 1) * 10, clean[i].stageOwnerEmail || "", now).run();
    }
  }
  return json({ ok: true, name, ownerName, ownerEmail });
}

export async function onRequestPut(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { user, tenant } = auth;

  const body = await context.request.json().catch(() => null);
  const name = String(body?.name || "").trim();
  if (!name) return badRequest("name is required");

  const db = context.env.DB;
  const proj = await db.prepare(`SELECT name, ownerName, ownerEmail, archived FROM projects WHERE name = ?`).bind(name).first();
  if (!proj) return badRequest("Project not found");

  const isAdmin = tenant.role === "admin";
  const canManage = isAdmin || (norm(user.email) === norm(proj.ownerEmail));
  if (!canManage) return forbidden("Only admin or project owner can update project");

  const updates = []; const binds = [];
  if (body?.ownerEmail != null) {
    const nextOwnerEmail = norm(body.ownerEmail);
    if (!nextOwnerEmail) return badRequest("ownerEmail cannot be empty");
    const nextOwnerName = String(body?.ownerName || "").trim() || nextOwnerEmail.split("@")[0];
    if (nextOwnerEmail !== norm(proj.ownerEmail)) {
      updates.push("ownerEmail = ?"); binds.push(nextOwnerEmail);
      updates.push("ownerName = ?"); binds.push(nextOwnerName);
    }
  }
  if (body?.archived != null) {
    const a = Number(body.archived);
    if (a !== 0 && a !== 1) return badRequest("archived must be 0 or 1");
    updates.push("archived = ?"); binds.push(a);
  }
  if (updates.length === 0) return json({ ok: true, name, unchanged: true });
  updates.push("updatedAt = ?"); binds.push(isoNow()); binds.push(name);
  await db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE name = ?`).bind(...binds).run();
  return json({ ok: true, name });
}

export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { tenant } = auth;
  if (tenant.role !== "admin") return forbidden("Only admin can delete projects");

  const body = await context.request.json().catch(() => null);
  const name = String(body?.name || "").trim();
  if (!name) return badRequest("name is required");

  const db = context.env.DB;
  await db.prepare(`DELETE FROM project_stages WHERE projectName = ?`).bind(name).run();
  await db.prepare(`DELETE FROM projects WHERE name = ?`).bind(name).run();
  return json({ ok: true, name });
}
