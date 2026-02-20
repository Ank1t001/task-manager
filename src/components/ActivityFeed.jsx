// src/components/ActivityFeed.jsx
import { useEffect, useState } from "react";

export default function ActivityFeed({ open, onClose, getToken }) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter]   = useState("All");

  async function apiFetch(path, opts = {}) {
    const token = getToken ? await getToken() : null;
    const headers = { ...(opts.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(path, { ...opts, headers });
  }

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/activity");
      if (res.ok) { const d = await res.json(); setItems(d.activity || []); }
    } finally { setLoading(false); }
  }

  useEffect(() => { if (open) load(); }, [open]);

  const ACTION_TYPES = ["All", "task_created", "task_updated", "task_deleted", "comment_added", "stage_changed", "file_uploaded"];

  const filtered = filter === "All" ? items : items.filter(i => i.action === filter);

  function actionIcon(action) {
    if (action === "task_created")  return "✅";
    if (action === "task_updated")  return "✏️";
    if (action === "task_deleted")  return "🗑️";
    if (action === "comment_added") return "💬";
    if (action === "stage_changed") return "📋";
    if (action === "file_uploaded") return "📎";
    return "📌";
  }

  function actionLabel(action) {
    return action?.replace(/_/g, " ") || "activity";
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  // Group by date
  function groupByDate(items) {
    const groups = {};
    for (const item of items) {
      const date = new Date(item.createdAt).toLocaleDateString("en-CA");
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    }
    return groups;
  }

  const grouped = groupByDate(filtered);
  const dates   = Object.keys(grouped).sort().reverse();

  function formatDateLabel(dateStr) {
    const today     = new Date().toLocaleDateString("en-CA");
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
    if (dateStr === today)     return "Today";
    if (dateStr === yesterday) return "Yesterday";
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }

  return (
    <>
      {/* Backdrop */}
      {open && <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 200, backdropFilter: "blur(2px)" }} />}

      {/* Slide-in panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 400,
        background: "var(--card)", borderLeft: "1px solid var(--border)",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.3)",
        zIndex: 201, display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17 }}>⚡ Activity Feed</div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{filtered.length} events</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="dtt-btn" onClick={load} style={{ padding: "6px 12px", fontSize: 12 }}>↻ Refresh</button>
            <button className="dtt-iconBtn" onClick={onClose} style={{ fontSize: 18 }}>✕</button>
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
          {["All", "task_created", "task_updated", "comment_added", "stage_changed", "file_uploaded"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 900, cursor: "pointer",
                border: `1px solid ${filter === f ? "rgba(77,124,255,0.6)" : "var(--border)"}`,
                background: filter === f ? "rgba(77,124,255,0.2)" : "transparent",
                color: filter === f ? "#93c5fd" : "var(--muted)",
              }}>
              {f === "All" ? "All" : actionLabel(f)}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
          {loading && <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              No activity yet
            </div>
          )}
          {!loading && dates.map(date => (
            <div key={date}>
              <div style={{ padding: "8px 20px 4px", fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {formatDateLabel(date)}
              </div>
              {grouped[date].map(item => (
                <div key={item.id} style={{ padding: "10px 20px", display: "flex", gap: 12, alignItems: "flex-start", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    {actionIcon(item.action)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, lineHeight: "17px", fontWeight: 600 }}>{item.summary}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                      {item.actorName && <span style={{ fontSize: 11, color: "var(--muted)" }}>{item.actorName}</span>}
                      {item.projectName && <span style={{ fontSize: 11, color: "rgba(77,124,255,0.8)", fontWeight: 700 }}>{item.projectName}</span>}
                      <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>{timeAgo(item.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}