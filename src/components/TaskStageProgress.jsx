// src/components/TaskStageProgress.jsx
// Renders stage progress tracker inside a task card / detail view
import { useEffect, useState } from "react";

const STATUS_COLORS = {
  "To Do":      { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.15)", color: "var(--muted)" },
  "In Progress":{ bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.45)", color: "#fbbf24" },
  "Done":       { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.45)",  color: "#4ade80" },
};

const STATUS_ICON = { "To Do": "⬜", "In Progress": "🔄", "Done": "✅" };

export default function TaskStageProgress({
  taskId,
  projectName,
  currentStageName,
  allProjectStages = [],   // [{stageName, sortOrder, stageOwnerEmail}]
  getToken,
  compact = false,         // compact=true for table row, false for detail view
  onStageAdvanced,         // callback when task advances to next stage
}) {
  const [progress, setProgress]   = useState([]);   // task_stage_progress rows
  const [loading, setLoading]     = useState(false);
  const [updating, setUpdating]   = useState(null); // stageName being updated
  const [showAdvance, setShowAdvance] = useState(null); // stageName awaiting advance confirm

  useEffect(() => {
    if (taskId) load();
  }, [taskId]);

  async function apiFetch(path, opts = {}) {
    const token = getToken ? await getToken() : null;
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(path, { ...opts, headers });
  }

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/task-stage-progress?taskId=${encodeURIComponent(taskId)}`);
      if (res.ok) {
        const d = await res.json();
        setProgress(d.progress || []);
      }
    } finally { setLoading(false); }
  }

  async function updateStatus(stageName, status, advanceToNext = false) {
    setUpdating(stageName);
    try {
      const res = await apiFetch("/api/task-stage-progress", {
        method: "POST",
        body: JSON.stringify({ taskId, stageName, status, advanceToNext }),
      });
      if (res.ok) {
        const d = await res.json();
        setProgress(d.progress || []);
        if (advanceToNext) onStageAdvanced?.();
        setShowAdvance(null);
      }
    } finally { setUpdating(null); }
  }

  // Merge allProjectStages with progress data
  const merged = allProjectStages.map(s => {
    const p = progress.find(r => r.stageName === s.stageName);
    return {
      ...s,
      status: p?.status || "To Do",
      assignedTo: p?.assignedTo || "",
      assignedToEmail: p?.assignedToEmail || "",
      completedAt: p?.completedAt || null,
      startedAt: p?.startedAt || null,
    };
  });

  const currentIdx = merged.findIndex(s => s.stageName === currentStageName);
  const completedCount = merged.filter(s => s.status === "Done").length;
  const pct = merged.length ? Math.round((completedCount / merged.length) * 100) : 0;

  // ── COMPACT MODE (table row pill) ──
  if (compact) {
    const currentStage = merged[currentIdx] || merged[0];
    if (!currentStage) return null;
    const colors = STATUS_COLORS[currentStage.status] || STATUS_COLORS["To Do"];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, ...colors, padding: "2px 8px", borderRadius: 999, border: `1px solid ${colors.border}`, fontWeight: 800 }}>
            {STATUS_ICON[currentStage.status]} Stage {currentIdx + 1}/{merged.length}
          </span>
          <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>
            {currentStage.stageName}
          </span>
        </div>
        {/* Mini progress bar */}
        <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", width: 140 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "rgba(34,197,94,0.6)", transition: "width 0.3s" }} />
        </div>
      </div>
    );
  }

  // ── FULL MODE (project stage view) ──
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {/* Overall progress bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #4d7cff, #4ade80)", transition: "width 0.4s" }} />
        </div>
        <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{completedCount}/{merged.length} stages</span>
      </div>

      {/* Stage list */}
      {loading ? (
        <div style={{ color: "var(--muted)", fontSize: 12 }}>Loading progress…</div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {merged.map((s, idx) => {
            const colors = STATUS_COLORS[s.status] || STATUS_COLORS["To Do"];
            const isCurrent = s.stageName === currentStageName;
            const isPast = idx < currentIdx;
            const isFuture = idx > currentIdx;
            const isUpdating = updating === s.stageName;

            return (
              <div key={s.stageName} style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: `1px solid ${isCurrent ? "rgba(77,124,255,0.5)" : colors.border}`,
                background: isCurrent ? "rgba(77,124,255,0.08)" : colors.bg,
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                opacity: isFuture && !isCurrent ? 0.5 : 1,
              }}>
                {/* Stage number + name */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{STATUS_ICON[s.status]}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>{idx + 1}.</span>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.stageName}</span>
                      {isCurrent && <span style={{ fontSize: 10, background: "rgba(77,124,255,0.25)", color: "#93c5fd", padding: "1px 6px", borderRadius: 999, fontWeight: 900 }}>CURRENT</span>}
                    </div>
                    {s.assignedTo && (
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        👤 {s.assignedTo}
                        {s.completedAt && <span> · ✅ {new Date(s.completedAt).toLocaleDateString()}</span>}
                        {s.startedAt && !s.completedAt && <span> · Started {new Date(s.startedAt).toLocaleDateString()}</span>}
                      </div>
                    )}
                    {!s.assignedTo && s.status === "To Do" && isCurrent && (
                      <div style={{ fontSize: 11, color: "rgba(245,158,11,0.8)", marginTop: 2 }}>⚠️ Not yet picked up</div>
                    )}
                  </div>
                </div>

                {/* Status controls — only for current stage */}
                {isCurrent && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                    {["To Do", "In Progress", "Done"].map(st => (
                      <button
                        key={st}
                        disabled={isUpdating || s.status === st}
                        onClick={() => {
                          if (st === "Done" && idx < merged.length - 1) {
                            // Show advance prompt
                            updateStatus(s.stageName, "Done", false).then(() => setShowAdvance(s.stageName));
                          } else {
                            updateStatus(s.stageName, st, false);
                          }
                        }}
                        style={{
                          borderRadius: 999,
                          padding: "4px 10px",
                          fontSize: 11,
                          fontWeight: 900,
                          border: `1px solid ${s.status === st ? STATUS_COLORS[st].border : "var(--border)"}`,
                          background: s.status === st ? STATUS_COLORS[st].bg : "transparent",
                          color: s.status === st ? STATUS_COLORS[st].color : "var(--muted)",
                          cursor: isUpdating || s.status === st ? "default" : "pointer",
                          opacity: isUpdating && s.status !== st ? 0.5 : 1,
                          transition: "all 0.15s",
                        }}
                      >
                        {STATUS_ICON[st]} {st}
                      </button>
                    ))}
                  </div>
                )}

                {/* Past stage — just show completed pill */}
                {isPast && s.status === "Done" && (
                  <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 800, flexShrink: 0 }}>Completed</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Advance to next stage prompt */}
      {showAdvance && (
        <div style={{
          padding: "12px 14px", borderRadius: 12,
          background: "rgba(77,124,255,0.10)", border: "1px solid rgba(77,124,255,0.40)",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 800 }}>
            ✅ Stage marked done — advance task to next stage?
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => updateStatus(showAdvance, "Done", true)}
              style={{ borderRadius: 10, padding: "7px 16px", background: "rgba(77,124,255,0.3)", border: "1px solid rgba(77,124,255,0.6)", color: "#93c5fd", fontWeight: 900, fontSize: 13, cursor: "pointer" }}>
              Yes, advance →
            </button>
            <button
              onClick={() => setShowAdvance(null)}
              style={{ borderRadius: 10, padding: "7px 14px", background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
              Keep in current stage
            </button>
          </div>
        </div>
      )}
    </div>
  );
}