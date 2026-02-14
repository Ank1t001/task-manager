// src/components/Projects.jsx
import { useEffect, useMemo, useState } from "react";

function parseStagesText(text) {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const stages = [];
  const seen = new Set();

  for (const line of lines) {
    const parts = line.split("|").map((p) => p.trim());
    const stageName = parts[0] || "";
    const stageOwnerEmail = (parts[1] || "").toLowerCase();

    if (!stageName) continue;
    const k = stageName.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);

    stages.push({ stageName, stageOwnerEmail });
  }

  return stages;
}

export default function Projects({ meEmail, meName, isAdmin, onOpenProject }) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState("0"); // "0" active, "1" archived, "all"

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState(meEmail || "");
  const [newOwnerName, setNewOwnerName] = useState(meName || "");
  const [stagesText, setStagesText] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const res = await fetch(`/api/projects?archived=${encodeURIComponent(view)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
      const data = await res.json();
      setProjects(Array.isArray(data?.projects) ? data.projects : []);
    } catch (e) {
      setErr(e?.message || "Failed to load projects");
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [view]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((p) => {
      const n = String(p.name || "").toLowerCase();
      const o = String(p.ownerEmail || "").toLowerCase();
      return n.includes(needle) || o.includes(needle);
    });
  }, [projects, q]);

  async function createProject() {
    const name = newName.trim();
    const ownerEmail = String(newOwnerEmail || "").trim().toLowerCase();
    const ownerName = String(newOwnerName || "").trim();

    if (!name) return alert("Project name is required");
    if (!ownerEmail) return alert("Owner email is required");

    const stages = parseStagesText(stagesText);

    try {
      setSaving(true);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ownerEmail, ownerName, stages }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Create failed (${res.status}) ${t}`);
      }
      setShowCreate(false);
      setNewName("");
      setNewOwnerEmail(meEmail || "");
      setNewOwnerName(meName || "");
      setStagesText("");
      await load();
    } catch (e) {
      alert(e?.message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="dtt-card" style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Projects</div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="dtt-pill">{projects.length} projects</span>
            {isAdmin ? (
              <button className="dtt-btnPrimary" onClick={() => setShowCreate(true)}>
                + New Project
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className={`dtt-btn ${view === "0" ? "dtt-btnPrimary" : ""}`} onClick={() => setView("0")}>
              Active
            </button>
            <button className={`dtt-btn ${view === "1" ? "dtt-btnPrimary" : ""}`} onClick={() => setView("1")}>
              Archived
            </button>
            <button className={`dtt-btn ${view === "all" ? "dtt-btnPrimary" : ""}`} onClick={() => setView("all")}>
              All
            </button>
          </div>

          <input
            className="dtt-input"
            placeholder="Search project name or owner email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 320 }}
          />
          <button className="dtt-btn" onClick={() => setQ("")}>Clear</button>
        </div>

        {err ? <div className="dtt-muted" style={{ marginTop: 10 }}><b>Error:</b> {err}</div> : null}
      </div>

      <div className="dtt-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="dtt-muted" style={{ padding: 16 }}>Loading projects…</div>
        ) : filtered.length === 0 ? (
          <div className="dtt-muted" style={{ padding: 16 }}>No projects found.</div>
        ) : (
          <div style={{ display: "grid" }}>
            {filtered.map((p) => (
              <button
                key={p.name}
                className="dtt-btn"
                style={{
                  textAlign: "left",
                  borderRadius: 0,
                  padding: "14px 14px",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  background: "transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
                onClick={() => onOpenProject?.(p)}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 1000, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span>{p.name}</span>
                    {Number(p.archived) === 1 ? <span className="dtt-pill">Archived</span> : null}
                  </div>
                  <div className="dtt-muted">Owner: {p.ownerName} • {p.ownerEmail}</div>
                </div>

                <span className="dtt-muted">Open →</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Project card */}
      {showCreate ? (
        <div className="dtt-card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Create Project</div>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 900 }}>Project Name</label>
              <input className="dtt-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., EMIFT" />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 900 }}>Owner Name</label>
              <input className="dtt-input" value={newOwnerName} onChange={(e) => setNewOwnerName(e.target.value)} placeholder="e.g., Ankit" />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 900 }}>Owner Email</label>
              <input className="dtt-input" value={newOwnerEmail} onChange={(e) => setNewOwnerEmail(e.target.value)} placeholder="owner@domain.com" />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 900 }}>Stages (optional)</label>
              <textarea
                className="dtt-input"
                rows={6}
                value={stagesText}
                onChange={(e) => setStagesText(e.target.value)}
                placeholder={`One stage per line.\nFormat:\nStage Name | owner@email.com\n\nExample:\nAds Campaigns | sheelp@equiton.com\nCopy | vanessa@equiton.com\nCreative | ankit@digijabber.com`}
                style={{ resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="dtt-btn" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</button>
              <button className="dtt-btnPrimary" onClick={createProject} disabled={saving}>
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}