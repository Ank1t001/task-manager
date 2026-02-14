// src/components/ProjectView.jsx
import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import StageEditor from "./StageEditor";

function isoDay(d) {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function safeParseMeta(meta) {
  try {
    if (!meta) return {};
    if (typeof meta === "string") return JSON.parse(meta);
    return meta;
  } catch {
    return {};
  }
}

function actionIcon(action = "") {
  const a = String(action).toUpperCase();
  if (a.includes("TASK_CREATED")) return "➕";
  if (a.includes("TASK_DELETED")) return "🗑️";
  if (a.includes("STATUS_CHANGED")) return "🔁";
  if (a.includes("TASK_UPDATED")) return "✏️";
  return "🧾";
}

function groupActivityByDay(activity = []) {
  const groups = new Map();
  for (const a of activity) {
    const day = isoDay(a.createdAt);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(a);
  }
  return Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

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

export default function ProjectView({
  projectName,
  projectOwnerName,
  projectOwnerEmail,
  projectArchived,

  meEmail,
  meName,
  userIsAdmin,

  onBack,
  onProjectChanged,

  onEditTask,
  onCreateTaskInStage,
  onOpenTaskById,
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [stages, setStages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState([]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");

  // NEW: Stage editor modal
  const [showStageEditor, setShowStageEditor] = useState(false);

  const me = (meEmail || "").toLowerCase();
  const owner = (projectOwnerEmail || "").toLowerCase();
  const canManageProject = userIsAdmin || (me && owner && me === owner);

  async function loadData() {
    try {
      setLoading(true);
      setErr("");

      const [stagesRes, tasksRes, activityRes] = await Promise.all([
        fetch(`/api/stages?projectName=${encodeURIComponent(projectName)}`, { cache: "no-store" }),
        fetch(`/api/tasks?projectName=${encodeURIComponent(projectName)}`, { cache: "no-store" }),
        fetch(`/api/activity?projectName=${encodeURIComponent(projectName)}`, { cache: "no-store" }),
      ]);

      if (!stagesRes.ok) throw new Error(`Failed loading stages (${stagesRes.status})`);
      if (!tasksRes.ok) throw new Error(`Failed loading tasks (${tasksRes.status})`);
      if (!activityRes.ok) throw new Error(`Failed loading activity (${activityRes.status})`);

      const stagesData = await stagesRes.json();
      const tasksData = await tasksRes.json();
      const activityData = await activityRes.json();

      const stageList = Array.isArray(stagesData?.stages) ? stagesData.stages : [];
      stageList.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setStages(stageList);

      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setActivity(Array.isArray(activityData?.activity) ? activityData.activity : []);
    } catch (e) {
      setErr(e?.message || "Failed loading project data");
      setStages([]);
      setTasks([]);
      setActivity([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectName) loadData();
  }, [projectName]);

  async function setArchived(val) {
    const confirmText =
      val === 1
        ? `Archive "${projectName}"?\n\nIt will move to Archived projects. You can restore it later.`
        : `Unarchive "${projectName}"?\n\nIt will return to Active projects.`;

    if (!window.confirm(confirmText)) return;

    const res = await fetch("/api/projects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName, archived: val }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      alert(`Update failed (${res.status}) ${t}`);
      return;
    }

    onProjectChanged?.();
  }

  async function transferOwner() {
    const nextOwnerEmail = window.prompt("New owner email:", projectOwnerEmail || "");
    if (!nextOwnerEmail) return;

    const nextOwnerName = window.prompt("New owner name:", projectOwnerName || "") || "";

    const res = await fetch("/api/projects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: projectName,
        ownerEmail: nextOwnerEmail.trim().toLowerCase(),
        ownerName: nextOwnerName.trim(),
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      alert(`Transfer failed (${res.status}) ${t}`);
      return;
    }

    alert("Owner updated.");
    onProjectChanged?.();
  }

  const filteredTasks = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tasks.filter((t) => {
      const okQ =
        !needle ||
        String(t.taskName || "").toLowerCase().includes(needle) ||
        String(t.description || "").toLowerCase().includes(needle) ||
        String(t.stage || "").toLowerCase().includes(needle);

      const okStatus = status === "All" || String(t.status) === status;
      return okQ && okStatus;
    });
  }, [tasks, q, status]);

  const overview = useMemo(() => {
    const total = filteredTasks.length;
    const overdue = filteredTasks.filter((t) => isOverdue(t)).length;
    const inProgress = filteredTasks.filter((t) => t.status === "In Progress").length;
    const done = filteredTasks.filter((t) => t.status === "Done").length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, overdue, inProgress, done, pct };
  }, [filteredTasks]);

  const tasksByStage = useMemo(() => {
    const map = new Map();
    for (const s of stages) map.set(s.stageName, []);
    map.set("__Unassigned__", []);

    for (const t of filteredTasks) {
      const st = String(t.stage || "").trim();
      if (st && map.has(st)) map.get(st).push(t);
      else map.get("__Unassigned__").push(t);
    }
    return map;
  }, [filteredTasks, stages]);

  const activityGrouped = useMemo(() => groupActivityByDay(activity), [activity]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Header */}
      <div className="dtt-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 1000 }}>{projectName}</div>
            <div className="dtt-muted" style={{ marginTop: 6 }}>
              Owner: <b>{projectOwnerName}</b> • {projectOwnerEmail}
              {Number(projectArchived) === 1 ? <span className="dtt-pill" style={{ marginLeft: 10 }}>Archived</span> : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="dtt-btn" onClick={onBack}>← Back</button>

            {canManageProject ? (
              <>
                <button className="dtt-btn" onClick={() => setShowStageEditor(true)}>Edit Stages</button>
                <button className="dtt-btn" onClick={transferOwner}>Transfer Owner</button>
                {Number(projectArchived) === 1 ? (
                  <button className="dtt-btn" onClick={() => setArchived(0)}>Unarchive</button>
                ) : (
                  <button className="dtt-btn" onClick={() => setArchived(1)}>Archive</button>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Stage Editor Modal */}
      <Modal
        open={showStageEditor}
        onClose={() => setShowStageEditor(false)}
        title="Edit Project Stages"
        subtitle="Add, remove, or assign stage owners. Saved to D1."
      >
        <StageEditor
          open={showStageEditor}
          projectName={projectName}
          initialStages={stages}
          onClose={() => setShowStageEditor(false)}
          onSaved={async () => {
            setShowStageEditor(false);
            await loadData(); // reload stages + tasks
          }}
        />
      </Modal>

      {loading ? (
        <div className="dtt-card" style={{ padding: 16 }}>Loading project…</div>
      ) : err ? (
        <div className="dtt-card" style={{ padding: 16 }}><b>Error:</b> {err}</div>
      ) : (
        <>
          {/* Overview */}
          <div className="dtt-card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 1000 }}>Project Overview</div>
              <div className="dtt-muted">Completion: <b>{overview.pct}%</b></div>
            </div>

            <div style={{ marginTop: 10, height: 10, borderRadius: 999, border: "1px solid var(--border)", overflow: "hidden" }}>
              <div style={{ width: `${overview.pct}%`, height: "100%", background: "rgba(34,197,94,0.35)" }} />
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
              <MetricCard title="Total" value={overview.total} />
              <MetricCard title="Overdue" value={overview.overdue} />
              <MetricCard title="In Progress" value={overview.inProgress} />
              <MetricCard title="Done" value={overview.done} />
            </div>
          </div>

          {/* Stages + Timeline */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            {/* Stages */}
            <div className="dtt-card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 1000 }}>Stages</div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    className="dtt-input"
                    style={{ width: 280 }}
                    placeholder="Search (name, description, stage)…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />

                  <select className="dtt-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 170 }}>
                    {["All", "To Do", "In Progress", "Done"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  <button className="dtt-btn" onClick={() => { setQ(""); setStatus("All"); }}>
                    Clear
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                {stages.map((s) => {
                  const list = tasksByStage.get(s.stageName) || [];
                  return (
                    <div key={s.stageName} className="dtt-card" style={{ padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 1000, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <span>{s.stageName}</span>
                            <span className="dtt-pill">{list.length} tasks</span>
                          </div>
                          <div className="dtt-muted" style={{ marginTop: 4 }}>
                            Stage Owner: <b>{s.stageOwnerEmail || "—"}</b>
                          </div>
                        </div>

                        <button className="dtt-btn" onClick={() => onCreateTaskInStage?.({ projectName, stage: s.stageName })}>
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
                            >
                              <div style={{ fontWeight: 1000 }}>{t.taskName}</div>
                              {t.description ? <div className="dtt-muted" style={{ marginTop: 4 }}>{t.description}</div> : null}
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                                <span className="dtt-pill">{t.owner}</span>
                                <span className="dtt-pill">{t.status}</span>
                                <span className="dtt-pill">{t.priority}</span>
                                <span className="dtt-pill">{t.dueDate || "No due date"}</span>
                                {isOverdue(t) ? (
                                  <span className="dtt-pill" style={{ borderColor: "rgba(239,68,68,0.55)", background: "rgba(239,68,68,0.12)" }}>
                                    Overdue
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline */}
            <div className="dtt-card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 1000, marginBottom: 10 }}>Activity Timeline</div>

              {activity.length === 0 ? (
                <div className="dtt-muted">No activity yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {activityGrouped.map(([day, list]) => (
                    <div key={day} style={{ display: "grid", gap: 10 }}>
                      <div style={{ fontWeight: 950 }}>{day}</div>

                      {list.map((a) => {
                        const meta = safeParseMeta(a.meta);
                        const diff = meta?.diff || {};
                        const diffKeys = Object.keys(diff || {}).slice(0, 4);

                        return (
                          <div key={a.id} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 12, display: "grid", gap: 8 }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <div style={{ fontSize: 18 }}>{actionIcon(a.action)}</div>
                              <div style={{ fontWeight: 950, flex: 1 }}>{a.summary}</div>

                              {a.taskId ? (
                                <button className="dtt-btn" onClick={() => onOpenTaskById?.(a.taskId)}>
                                  Open
                                </button>
                              ) : null}
                            </div>

                            {diffKeys.length ? (
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {diffKeys.map((k) => (
                                  <span key={k} className="dtt-pill" title={`${k}: ${diff[k]?.from} → ${diff[k]?.to}`}>
                                    {k}: {String(diff[k]?.from)} → {String(diff[k]?.to)}
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
        </>
      )}
    </div>
  );
}

function MetricCard({ title, value }) {
  return (
    <div className="dtt-card" style={{ padding: 14 }}>
      <div className="dtt-muted" style={{ fontWeight: 900 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 30, fontWeight: 1000 }}>{value}</div>
    </div>
  );
}