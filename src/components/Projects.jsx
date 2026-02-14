// src/components/Projects.jsx
import { useEffect, useMemo, useState } from "react";

export default function Projects({ onOpenProject }) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setErr("");
        const res = await fetch("/api/projects", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
        const data = await res.json();
        if (!alive) return;
        setProjects(Array.isArray(data?.projects) ? data.projects : []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load projects");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => (alive = false);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((p) => String(p).toLowerCase().includes(needle));
  }, [projects, q]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="dtt-card" style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Projects</div>
          <span className="dtt-pill">{projects.length} projects</span>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className="dtt-input"
            placeholder="Search projects…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 280 }}
          />
          <button className="dtt-btn" onClick={() => setQ("")}>
            Clear
          </button>
        </div>
      </div>

      <div className="dtt-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="dtt-muted" style={{ padding: 16 }}>
            Loading projects…
          </div>
        ) : err ? (
          <div className="dtt-muted" style={{ padding: 16 }}>
            <b>Error:</b> {err}
          </div>
        ) : filtered.length === 0 ? (
          <div className="dtt-muted" style={{ padding: 16 }}>
            No projects found.
          </div>
        ) : (
          <div style={{ display: "grid" }}>
            {filtered.map((p) => (
              <button
                key={p}
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
                  fontWeight: 950,
                }}
                onClick={() => onOpenProject?.(p)}
              >
                <span>{p}</span>
                <span className="dtt-muted">Open →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}