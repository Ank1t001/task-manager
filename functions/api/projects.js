// functions/api/projects.js
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

  const url = new URL(context.request.url);
  const archived = parseArchivedParam(url.searchParams.get("archived"));
  const db = context.env.DB;
  const isAdmin = tenant.role === "admin";
  const email = user.email || tenant.memberEmail || "";

  if (isAdmin) {
    const sql = archived === "all"
      ? `SELECT name, ownerName, ownerEmail, createdAt, updatedAt, archived FROM projects ORDER BY archived ASC, name ASC`
      : `SELECT name, ownerName, ownerEmail, createdAt, updatedAt, archived FROM projects WHERE archived = ? ORDER BY name ASC`;
    const rows = archived === "all"
      ? await db.prepare(sql).all()
      : await db.prepare(sql).bind(archived).all();
    return json({ projects: rows.results || [] });
  }

  // Member: show projects they own tasks in or are stage owner of
  const baseSql = `
    SELECT DISTINCT p.name, p.ownerName, p.ownerEmail, p.createdAt, p.updatedAt, p.archived
    FROM projects p
    WHERE EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.projectName = p.name
        AND (
          t.ownerEmail = ?
          OR t.assignedToEmail = ?
          OR EXISTS (
            SELECT 1 FROM project_stages ps
            WHERE ps.projectName = t.projectName
              AND ps.stageName = t.stage
              AND ps.stageOwnerEmail = ?
          )
        )
    )
  `;
  const sql = archived === "all"
    ? `${baseSql} ORDER BY p.archived ASC, p.name ASC`
    : `${baseSql} AND p.archived = ? ORDER BY p.name ASC`;

  const stmt = archived === "all"
    ? db.prepare(sql).bind(email, email, email)
    : db.prepare(sql).bind(email, email, email, archived);

  const rows = await stmt.all();
  return json({ projects: rows.results || [] });
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { user, tenant } = auth;

  const isAdmin = tenant.role === "admin";
  if (!isAdmin) return forbidden("Only admin can create projects");

  const body = await context.request.json().catch(() => null);

  const name = String(body?.name || "").trim();
  const ownerEmail = norm(body?.ownerEmail || user.email || tenant.memberEmail || "");
  const ownerName  = String(body?.ownerName || user.name || tenant.memberName || "").trim() || ownerEmail.split("@")[0];

  if (!name)       return badRequest("name is required");
  if (!ownerEmail) return badRequest("ownerEmail is required");

  const db  = context.env.DB;
  const now = isoNow();

  await db.prepare(
    `INSERT INTO projects (id, name, ownerName, ownerEmail, createdAt, updatedAt, archived)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  ).bind(crypto.randomUUID(), name, ownerName, ownerEmail, now, now).run();

  // Optional stages
  const stagesIn = Array.isArray(body?.stages) ? body.stages : [];
  if (stagesIn.length) {
    const clean = [];
    const seen  = new Set();
    for (const item of stagesIn) {
      if (typeof item === "string") {
        const s = item.trim(); if (!s) continue;
        const k = s.toLowerCase(); if (seen.has(k)) continue;
        seen.add(k); clean.push({ stageName: s, stageOwnerEmail: "" });
      } else if (item && typeof item === "object") {
        const stageName = String(item.stageName || "").trim(); if (!stageName) continue;
        const stageOwnerEmail = norm(item.stageOwnerEmail || "");
        const k = stageName.toLowerCase(); if (seen.has(k)) continue;
        seen.add(k); clean.push({ stageName, stageOwnerEmail });
      }
    }
    for (let i = 0; i < clean.length; i++) {
      await db.prepare(
        `INSERT INTO project_stages (id, projectName, stageName, sortOrder, stageOwnerEmail, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), name, clean[i].stageName, (i + 1) * 10, clean[i].stageOwnerEmail || "", now).run();
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

  const db   = context.env.DB;
  const proj = await db.prepare(`SELECT name, ownerName, ownerEmail, archived FROM projects WHERE name = ?`).bind(name).first();
  if (!proj) return badRequest("Project not found");

  const isAdmin  = tenant.role === "admin";
  const myEmail  = norm(user.email || tenant.memberEmail || "");
  const canManage = isAdmin || (myEmail && myEmail === norm(proj.ownerEmail));
  if (!canManage) return forbidden("Only admin or project owner can update project");

  const updates = [];
  const binds   = [];

  if (body?.ownerEmail != null) {
    const nextEmail = norm(body.ownerEmail);
    if (!nextEmail) return badRequest("ownerEmail cannot be empty");
    const nextName  = String(body?.ownerName || "").trim() || nextEmail.split("@")[0];
    if (nextEmail !== norm(proj.ownerEmail)) {
      updates.push("ownerEmail = ?", "ownerName = ?");
      binds.push(nextEmail, nextName);
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