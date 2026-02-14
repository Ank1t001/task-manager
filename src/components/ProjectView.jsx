// src/components/ProjectView.jsx
import { useEffect, useMemo, useState } from "react";
import StageEditor from "./StageEditor";

const STATUS_OPTIONS = ["All", "To Do", "In Progress", "Done"];

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
    const day = new Date(a.createdAt).toISOString().slice(0, 10); // YYYY-MM-DD
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(a);
  }
  // newest day first
  return Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function groupTasksByStage(tasks = [], stageList = []) {
  const map = new Map();
  for (const s of stageList) map.set(s, []);
  map.set("__Unassigned__", []);

  for (const t of tasks) {
    const st = (t.stage || "").trim();
    if (st && map.has(st)) map.get(st).push(t);
    else map.get("__Unassigned__").push(t);
  }
  return map;
}

function compactDesc(s = "", max = 110) {
  const v = String(s || "").trim();
  if (!v) return "";
  return v.length > max ? v.slice(0, max) + "…" : v;
}

export default function ProjectView({
  projectName,
  userIsAdmin,
  onBack,
  onEditTask,
  onCreateTaskInStage, // ✅ new
}) {
  const [loadingStages, setLoadingStages] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const [stages, setStages] = useState([]); // [{stageName, sortOrder}]
  const [tasks, setTasks] = useState([]); // tasks for project (already filtered by backend)
  const [activity, setActivity] = useState([]);

  const [err, setErr] = useState("");
  const [showStageEditor, setShowStageEditor] = useState(false);

  // Project filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");

  async function fetchStages() {
    const res = await fetch(`/api/stages?projectName=${encodeURIComponent(projectName)}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Stages load failed (${res.status})`);
    const data = await res.json();
    setStages(Array.isArray(data?.stages) ? data.stages : []);
  }

  async function fetchTasks() {
    const res = await fetch(`/api/tasks?projectName=${encodeURIComponent(projectName)}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Tasks load failed (${res.status})`);
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
  }

  async function fetchActivity() {
    const res = await fetch(`/api/activity?projectName=${encodeURIComponent(projectName)}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Activity load failed (${res.status})`);
    const data = await res.json();
    setActivity(Array.isArray(data?.activity) ? data.activity : []);
  }

  // Load stages
  useEffect(() => {
    let alive = true;
    async function load() {
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
    }
    if (projectName) load();
    return () => (alive = false);
  }, [projectName]);

  // Load tasks
  useEffect(() => {
    let alive = true;
    async function load() {
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
    }
    if (projectName) load();
    return () => (alive = false);
  }, [projectName]);

  // Load activity
  useEffect(() => {
    let alive = true;
    async function load() {
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
    }
    if (projectName) load();
    return () => (alive = false);
  }, [projectName]);

  const stageNames = useMemo(() => {
    const list = [...stages]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((s) => s.stageName);
    return list;
  }, [stages]);

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

  const grouped = useMemo(() => groupTasksByStage(filteredTasks, stageNames), [filteredTasks, stageNames]);

  const totals = useMemo(() => {
    const total = filteredTasks.length;
    const todo = filteredTasks.filter((t) => t.status === "To Do").length;
    const ip = filteredTasks.filter((t) => t.status === "In Progress").length;
    const done = filteredTasks.filter((t) => t.status === "Done").length;
    return { total, todo, ip, done };
  }, [filteredTasks]);

  const activityGrouped = useMemo(() => groupActivityByDay(activity), [activity]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Top Bar */}
      <div className="dtt-card" style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="dtt-btn" onClick={onBack}>← Back</button>
            <div style={{ fontWeight: 1000, fontSize: 16 }}>{projectName}</div>

            <span className="dtt-pill">{totals.total} tasks</span>
            <span className="dtt-pill">To Do: {totals.todo}</span>
            <span className="dtt-pill">In Progress: {totals.ip}</span>
            <span className="dtt-pill">Done: {totals.done}</span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              className="dtt-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search in this project…"
              style={{ width: 260 }}
            />

            <select className="dtt-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 170 }}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
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

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        {/* Left: Stages */}
        <div className="dtt-card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>Stages</div>

          {loadingStages || loadingTasks ? (
            <div className="dtt-muted">Loading…</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {stageNames.map((stage) => {
                const list = grouped.get(stage) || [];
                return (
                  <div key={stage} className="dtt-card" style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 1000 }}>{stage}</div>
                        <div className="dtt-muted" style={{ marginTop: 2 }}>{list.length} tasks</div>
                      </div>

                      <button
                        className="dtt-btn"
                        onClick={() => onCreateTaskInStage?.({ projectName, stage })}
                      >
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

                            {t.description ? (
                              <div className="dtt-muted" style={{ marginTop: 4 }}>
                                {compactDesc(t.description)}
                              </div>
                            ) : null}

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                              <span className="dtt-pill">{t.owner}</span>
                              <span className="dtt-pill">{t.status}</span>
                              <span className="dtt-pill">{t.priority}</span>
                              <span className="dtt-pill">{t.dueDate || "No due date"}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}

              {(grouped.get("__Unassigned__") || []).length > 0 ? (
                <div className="dtt-card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontWeight: 1000 }}>Unassigned Stage</div>
                    <div className="dtt-muted">{(grouped.get("__Unassigned__") || []).length} tasks</div>
                  </div>
                  <div className="dtt-muted" style={{ marginTop: 6 }}>
                    Assign a stage to these tasks to organize them.
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Right: Timeline */}
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

                  {list.map((a) => (
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
                        <div style={{ fontWeight: 950 }}>{a.summary}</div>
                      </div>
                      <div className="dtt-muted">
                        {new Date(a.createdAt).toLocaleString()} • {a.actorName}
                      </div>
                      <div className="dtt-muted">{a.action}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Admin Stage Editor */}
      <StageEditor
        open={showStageEditor}
        projectName={projectName}
        initialStages={stageNames}
        onClose={() => setShowStageEditor(false)}
        onSaved={() => window.location.reload()}
      />
    </div>
  );
}