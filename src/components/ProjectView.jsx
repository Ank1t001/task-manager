// src/components/ProjectView.jsx
import { useEffect, useMemo, useState } from "react";
import StageEditor from "./StageEditor";

const STATUS_OPTIONS = ["All", "To Do", "In Progress", "Done"];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function isOverdue(task) {
  if (!task?.dueDate) return false;
  if (task.status === "Done") return false;
  const due = new Date(`${task.dueDate}T00:00:00`);
  if (isNaN(due.getTime())) return false;
  return due < startOfToday();
}

function actionIcon(action = "") {
  const a = String(action).toUpperCase();
  if (a.includes("CREATED")) return "➕";
  if (a.includes("DELETED")) return "🗑️";
  if (a.includes("STATUS")) return "🔁";
  if (a.includes("UPDATED")) return "✏️";
  return "🧾";
}

function groupActivityByDay(activity = []) {
  const groups = new Map();
  for (const a of activity) {
    const day = new Date(a.createdAt).toISOString().slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(a);
  }
  return Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function compactDesc(s = "", max = 110) {
  const v = String(s || "").trim();
  if (!v) return "";
  return v.length > max ? v.slice(0, max) + "…" : v;
}

function normalizeStages(stages = []) {
  // stages may come as {stageName, sortOrder, stageOwnerEmail}
  return [...stages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function diffChips(meta) {
  try {
    const obj = typeof meta === "string" ? JSON.parse(meta || "{}") : meta || {};
    const diff = obj.diff || {};
    const allowed = ["status", "priority", "dueDate", "stage"];
    const chips = [];
    for (const k of allowed) {
      if (diff[k]) chips.push({ k, from: diff[k].from, to: diff[k].to });
    }
    return chips;
  } catch {
    return [];
  }
}

export default function ProjectView({
  projectName,
  userIsAdmin,
  onBack,
  onEditTask,
  onCreateTaskInStage,
  onOpenTaskById, // ✅ new
}) {
  const [loadingStages, setLoadingStages] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const [stages, setStages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState([]);

  const [err, setErr] = useState("");
  const [showStageEditor, setShowStageEditor] = useState(false);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");

  async function fetchStages() {
    const res = await fetch(`/api/stages?projectName=${encodeURIComponent(projectName)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Stages load failed (${res.status})`);
    const data = await res.json();
    setStages(Array.isArray(data?.stages) ? data.stages : []);
  }

  async function fetchTasks() {
    const res = await fetch(`/api/tasks?projectName=${encodeURIComponent(projectName)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Tasks load failed (${res.status})`);
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
  }

  async function fetchActivity() {
    const res = await fetch(`/api/activity?projectName=${encodeURIComponent(projectName)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Activity load failed (${res.status})`);
    const data = await res.json();
    setActivity(Array.isArray(data?.activity) ? data.activity : []);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr("");
        setLoadingStages(true);
        await fetchStages();
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load stages");
        setStages([]);
      } finally {
        if (!alive) return;
        setLoadingStages(false);
      }
    })();
    return () => (alive = false);
  }, [projectName]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr("");
        setLoadingTasks(true);
        await fetchTasks();
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load tasks");
        setTasks([]);
      } finally {
        if (!alive) return;
        setLoadingTasks(false);
      }
    })();
    return () => (alive = false);
  }, [projectName]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr("");
        setLoadingActivity(true);
        await fetchActivity();
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load activity");
        setActivity([]);
      } finally {
        if (!alive) return;
        setLoadingActivity(false);
      }
    })();
    return () => (alive = false);
  }, [projectName]);

  const orderedStages = useMemo(() => normalizeStages(stages), [stages]);

  const filteredTasks = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tasks.filter((t) => {
      const okQ =
        !needle ||
        String(t.taskName || "").toLowerCase().includes(needle) ||
        String(t.description || "").toLowerCase().includes(needle) ||
        String(t.stage || "").toLowerCase().includes(needle);

      const okStatus = status === "All" || t.status === status;
      return okQ && okStatus;
    });
  }, [tasks, q, status]);

  // Overview metrics (A)
  const overview = useMemo(() => {
    const total = filteredTasks.length;
    const overdue = filteredTasks.filter((t) => isOverdue(t)).length;
    const inProgress = filteredTasks.filter((t) => t.status === "In Progress").length;
    const done = filteredTasks.filter((t) => t.status === "Done").length;
    return { total, overdue, inProgress, done };
  }, [filteredTasks]);

  // Group by stage
  const tasksByStage = useMemo(() => {
    const map = new Map();
    for (const s of orderedStages) map.set(s.stageName, []);
    map.set("__Unassigned__", []);

    for (const t of filteredTasks) {
      const st = String(t.stage || "").trim();
      if (st && map.has(st)) map.get(st).push(t);
      else map.get("__Unassigned__").push(t);
    }
    return map;
  }, [filteredTasks, orderedStages]);

  const activityGrouped = useMemo(() => groupActivityByDay(activity), [activity]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Top bar */}
      <div className="dtt-card" style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="dtt-btn" onClick={onBack}>← Back</button>
            <div style={{ fontWeight: 1000, fontSize: 16 }}>{projectName}</div>
            <span className="dtt-pill">{overview.total} tasks</span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              className="dtt-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search in project…"
              style={{ width: 260 }}
            />

            <select className="dtt-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 170 }}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <button className="dtt-btn" onClick={() => { setQ(""); setStatus("All"); }}>
              Clear
            </button>

            {userIsAdmin ? (
              <button className="dtt-btn" onClick={() => setShowStageEditor(true)}>
                Edit Stages
              </button>
            ) : null}
          </div>
        </div>

        {err ? (
          <div className="dtt-muted" style={{ marginTop: 10 }}>
            <b>Error:</b> {err}
          </div>
        ) : null}
      </div>

      {/* Overview cards (A) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        <MetricCard label="Total Tasks" value={overview.total} />
        <MetricCard label="Overdue" value={overview.overdue} />
        <MetricCard label="In Progress" value={overview.inProgress} />
        <MetricCard label="Done" value={overview.done} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        {/* Stages */}
        <div className="dtt-card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>Stages</div>

          {loadingStages || loadingTasks ? (
            <div className="dtt-muted">Loading…</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {orderedStages.map((s) => {
                const stage = s.stageName;
                const list = tasksByStage.get(stage) || [];
                const done = list.filter((t) => t.status === "Done").length;
                const pct = list.length ? Math.round((done / list.length) * 100) : 0;

                return (
                  <div key={stage} className="dtt-card" style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 1000, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <span>{stage}</span>
                          <span className="dtt-pill">{list.length} tasks</span>
                          <span className="dtt-pill">{pct}% done</span>
                        </div>

                        {s.stageOwnerEmail ? (
                          <div className="dtt-muted" style={{ marginTop: 4 }}>
                            Stage Owner: <b>{s.stageOwnerEmail}</b>
                          </div>
                        ) : (
                          <div className="dtt-muted" style={{ marginTop: 4 }}>Stage Owner: —</div>
                        )}

                        <div style={{ marginTop: 8, height: 8, borderRadius: 999, border: "1px solid var(--border)", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "rgba(34,197,94,0.35)" }} />
                        </div>
                      </div>

                      <button className="dtt-btn" onClick={() => onCreateTaskInStage?.({ projectName, stage })}>
                        + Add Task
                      </button>
                    </div>

                    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      {list.length === 0 ? (
                        <div className="dtt-muted">No tasks in this stage.</div>
                      ) : (
                        list.map((t) => (
                          <button
                            key={t.id}
                            className="dtt-btn"
                            style={{
                              textAlign: "left",
                              background: "rgba(255,255,255,0.10)",
                              border: "1px solid var(--border)",
                              padding: 12,
                              borderRadius: 14,
                            }}
                            onClick={() => onEditTask?.(t)}
                            title="Click to edit"
                          >
                            <div style={{ fontWeight: 1000 }}>{t.taskName}</div>
                            {t.description ? <div className="dtt-muted" style={{ marginTop: 4 }}>{compactDesc(t.description)}</div> : null}
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                              <span className="dtt-pill">{t.owner}</span>
                              <span className="dtt-pill">{t.status}</span>
                              <span className="dtt-pill">{t.priority}</span>
                              <span className="dtt-pill">{t.dueDate || "No due date"}</span>
                              {isOverdue(t) ? <span className="dtt-pill" style={{ borderColor: "rgba(239,68,68,0.55)", background: "rgba(239,68,68,0.12)" }}>Overdue</span> : null}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}

              {(tasksByStage.get("__Unassigned__") || []).length > 0 ? (
                <div className="dtt-card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontWeight: 1000 }}>Unassigned Stage</div>
                    <div className="dtt-muted">{(tasksByStage.get("__Unassigned__") || []).length} tasks</div>
                  </div>
                  <div className="dtt-muted" style={{ marginTop: 6 }}>
                    Assign a stage to organize these tasks.
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Timeline (C) */}
        <div className="dtt-card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>Activity Timeline</div>

          {loadingActivity ? (
            <div className="dtt-muted">Loading activity…</div>
          ) : activity.length === 0 ? (
            <div className="dtt-muted">No activity yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {activityGrouped.map(([day, list]) => (
                <div key={day} style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 950 }}>{day}</div>

                  {list.map((a) => {
                    const chips = diffChips(a.meta);
                    return (
                      <div
                        key={a.id}
                        style={{
                          border: "1px solid var(--border)",
                          background: "rgba(255,255,255,0.08)",
                          borderRadius: 14,
                          padding: 12,
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <div style={{ fontSize: 18 }}>{actionIcon(a.action)}</div>
                          <div style={{ fontWeight: 950, flex: 1 }}>{a.summary}</div>

                          {a.taskId ? (
                            <button className="dtt-btn" onClick={() => onOpenTaskById?.(a.taskId)}>
                              Open
                            </button>
                          ) : null}
                        </div>

                        {chips.length ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                            {chips.map((c, idx) => (
                              <span
                                key={idx}
                                className="dtt-pill"
                                title={`${c.k}: ${c.from} → ${c.to}`}
                                style={{ background: "rgba(255,255,255,0.12)" }}
                              >
                                {c.k}: {String(c.from)} → {String(c.to)}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="dtt-muted">
                          {new Date(a.createdAt).toLocaleString()} • {a.actorName}
                        </div>
                        <div className="dtt-muted">{a.action}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <StageEditor
        open={showStageEditor}
        projectName={projectName}
        initialStages={orderedStages}
        onClose={() => setShowStageEditor(false)}
        onSaved={async () => {
          setShowStageEditor(false);
          await fetchStages();
          await fetchTasks();
          await fetchActivity();
        }}
      />
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="dtt-card" style={{ padding: 14 }}>
      <div className="dtt-muted" style={{ fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 30, fontWeight: 1000 }}>{value}</div>
    </div>
  );
}