// src/components/ProjectView.jsx
import { useEffect, useMemo, useState } from "react";
import StageEditor from "./StageEditor";

function groupByStage(tasks = [], stageList = []) {
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

export default function ProjectView({
  projectName,
  userIsAdmin,
  onBack,
  onEditTask,
}) {
  const [loadingStages, setLoadingStages] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const [stages, setStages] = useState([]); // [{stageName, sortOrder}]
  const [tasks, setTasks] = useState([]); // tasks for project (already filtered by role)
  const [activity, setActivity] = useState([]);

  const [err, setErr] = useState("");
  const [showStageEditor, setShowStageEditor] = useState(false);

  // Load stages
  useEffect(() => {
    let alive = true;
    async function loadStages() {
      try {
        setLoadingStages(true);
        const res = await fetch(`/api/stages?projectName=${encodeURIComponent(projectName)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Stages load failed (${res.status})`);
        const data = await res.json();
        if (!alive) return;
        setStages(Array.isArray(data?.stages) ? data.stages : []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load stages");
        setStages([]);
      } finally {
        if (!alive) return;
        setLoadingStages(false);
      }
    }
    if (projectName) loadStages();
    return () => (alive = false);
  }, [projectName]);

  // Load tasks (project-filtered)
  useEffect(() => {
    let alive = true;
    async function loadTasks() {
      try {
        setLoadingTasks(true);
        const res = await fetch(`/api/tasks?projectName=${encodeURIComponent(projectName)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Tasks load failed (${res.status})`);
        const data = await res.json();
        if (!alive) return;
        setTasks(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load tasks");
        setTasks([]);
      } finally {
        if (!alive) return;
        setLoadingTasks(false);
      }
    }
    if (projectName) loadTasks();
    return () => (alive = false);
  }, [projectName]);

  // Load activity
  useEffect(() => {
    let alive = true;
    async function loadActivity() {
      try {
        setLoadingActivity(true);
        const res = await fetch(`/api/activity?projectName=${encodeURIComponent(projectName)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Activity load failed (${res.status})`);
        const data = await res.json();
        if (!alive) return;
        setActivity(Array.isArray(data?.activity) ? data.activity : []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load activity");
        setActivity([]);
      } finally {
        if (!alive) return;
        setLoadingActivity(false);
      }
    }
    if (projectName) loadActivity();
    return () => (alive = false);
  }, [projectName]);

  const stageNames = useMemo(() => {
    const list = [...stages]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((s) => s.stageName);
    return list;
  }, [stages]);

  const grouped = useMemo(() => groupByStage(tasks, stageNames), [tasks, stageNames]);

  const totals = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter((t) => t.status === "To Do").length;
    const ip = tasks.filter((t) => t.status === "In Progress").length;
    const done = tasks.filter((t) => t.status === "Done").length;
    return { total, todo, ip, done };
  }, [tasks]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
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

          {userIsAdmin ? (
            <button className="dtt-btn" onClick={() => setShowStageEditor(true)}>
              Edit Stages
            </button>
          ) : null}
        </div>

        {err ? (
          <div className="dtt-muted" style={{ marginTop: 10 }}>
            <b>Error:</b> {err}
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        {/* Left: Stage columns */}
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ fontWeight: 1000 }}>{stage}</div>
                      <div className="dtt-muted">{list.length} tasks</div>
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
                                {t.description.length > 90 ? t.description.slice(0, 90) + "…" : t.description}
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

              {/* Unassigned stage bucket */}
              {(grouped.get("__Unassigned__") || []).length > 0 ? (
                <div className="dtt-card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontWeight: 1000 }}>Unassigned Stage</div>
                    <div className="dtt-muted">{(grouped.get("__Unassigned__") || []).length} tasks</div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Right: Activity timeline */}
        <div className="dtt-card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>Activity Timeline</div>

          {loadingActivity ? (
            <div className="dtt-muted">Loading activity…</div>
          ) : activity.length === 0 ? (
            <div className="dtt-muted">No activity yet (create/update tasks to generate trail).</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {activity.map((a) => (
                <div
                  key={a.id}
                  style={{
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 14,
                    padding: 12,
                  }}
                >
                  <div style={{ fontWeight: 950 }}>{a.summary}</div>
                  <div className="dtt-muted" style={{ marginTop: 6 }}>
                    {new Date(a.createdAt).toLocaleString()} • {a.actorName} ({a.actorEmail})
                  </div>
                  <div className="dtt-muted" style={{ marginTop: 6 }}>
                    {a.action}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Admin stage editor modal */}
      <StageEditor
        open={showStageEditor}
        projectName={projectName}
        initialStages={stageNames}
        onClose={() => setShowStageEditor(false)}
        onSaved={() => {
          // refresh stages after save
          setShowStageEditor(false);
          // simplest: hard refresh this view's stages:
          // trigger re-fetch by forcing loadingStages state flip
          // (we’ll just reload window fetches quickly by reusing the same endpoint call)
          // easiest: reload page data by refetching:
          // do it via same load again by updating a dummy state
          window.location.reload();
        }}
      />
    </div>
  );
}