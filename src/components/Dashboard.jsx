// src/components/Dashboard.jsx
import { useMemo } from "react";

function StatCard({ icon, label, value, sub, color = "#4d7cff" }) {
  return (
    <div style={{
      padding: "18px 20px", borderRadius: 18,
      border: `1px solid ${color}44`,
      background: `linear-gradient(135deg, ${color}14 0%, transparent 100%)`,
      display: "grid", gap: 6,
    }}>
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{value}</div>
      <div style={{ fontWeight: 800, fontSize: 13 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ label, value, max, color = "#4d7cff" }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
        <span>{label}</span>
        <span style={{ color: "var(--muted)" }}>{value}/{max} ({pct}%)</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

export default function Dashboard({ tasks = [], projects = [] }) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const stats = useMemo(() => {
    const total      = tasks.length;
    const done       = tasks.filter(t => t.status === "Done").length;
    const inProgress = tasks.filter(t => t.status === "In Progress").length;
    const toDo       = tasks.filter(t => t.status === "To Do").length;
    const overdue    = tasks.filter(t => {
      if (!t.dueDate || t.status === "Done") return false;
      return new Date(`${t.dueDate}T00:00:00`) < today;
    }).length;
    const dueToday = tasks.filter(t => {
      if (!t.dueDate || t.status === "Done") return false;
      const d = new Date(`${t.dueDate}T00:00:00`);
      return d >= today && d < new Date(today.getTime() + 86400000);
    }).length;
    const dueThisWeek = tasks.filter(t => {
      if (!t.dueDate || t.status === "Done") return false;
      const d = new Date(`${t.dueDate}T00:00:00`);
      const weekEnd = new Date(today.getTime() + 7 * 86400000);
      return d >= today && d < weekEnd;
    }).length;

    // By stage
    const byStage = {};
    for (const t of tasks) {
      const s = t.stage || "No Stage";
      if (!byStage[s]) byStage[s] = { total: 0, done: 0 };
      byStage[s].total++;
      if (t.status === "Done") byStage[s].done++;
    }

    // By owner
    const byOwner = {};
    for (const t of tasks) {
      const o = t.owner || "Unassigned";
      if (!byOwner[o]) byOwner[o] = { total: 0, done: 0 };
      byOwner[o].total++;
      if (t.status === "Done") byOwner[o].done++;
    }

    // By priority
    const byPriority = { High: 0, Medium: 0, Low: 0 };
    for (const t of tasks) byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;

    return { total, done, inProgress, toDo, overdue, dueToday, dueThisWeek, byStage, byOwner, byPriority };
  }, [tasks]);

  const STAGE_ORDER = ["Brief/Kickoff","Strategy","Creative/Concept","Production","Internal Review","Compliance Review","Revisions (If Any)","Approval","Launch/Execution"];

  const stageEntries = STAGE_ORDER
    .map(s => ({ stage: s, ...(stats.byStage[s] || { total: 0, done: 0 }) }))
    .filter(s => s.total > 0);

  const ownerEntries = Object.entries(stats.byOwner).sort((a,b) => b[1].total - a[1].total).slice(0, 6);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <StatCard icon="📋" label="Total Tasks"  value={stats.total}       color="#4d7cff" />
        <StatCard icon="✅" label="Done"          value={stats.done}        color="#22c55e" sub={`${stats.total > 0 ? Math.round(stats.done/stats.total*100) : 0}% complete`} />
        <StatCard icon="🔄" label="In Progress"  value={stats.inProgress}  color="#f59e0b" />
        <StatCard icon="📝" label="To Do"         value={stats.toDo}        color="#a855f7" />
        <StatCard icon="⚠️" label="Overdue"       value={stats.overdue}     color="#ef4444" />
        <StatCard icon="📅" label="Due Today"     value={stats.dueToday}    color="#06b6d4" />
        <StatCard icon="📆" label="Due This Week" value={stats.dueThisWeek} color="#f97316" />
        <StatCard icon="📁" label="Projects"      value={projects.length}   color="#8b5cf6" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Stage progress */}
        {stageEntries.length > 0 && (
          <div className="dtt-card">
            <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 14 }}>📊 Progress by Stage</div>
            <div style={{ display: "grid", gap: 10 }}>
              {stageEntries.map(({ stage, total, done }) => (
                <ProgressBar key={stage} label={stage} value={done} max={total}
                  color={done === total ? "#22c55e" : "#4d7cff"} />
              ))}
            </div>
          </div>
        )}

        {/* Owner breakdown */}
        {ownerEntries.length > 0 && (
          <div className="dtt-card">
            <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 14 }}>👤 Tasks by Owner</div>
            <div style={{ display: "grid", gap: 10 }}>
              {ownerEntries.map(([owner, { total, done }]) => (
                <ProgressBar key={owner} label={owner} value={done} max={total}
                  color="#a855f7" />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Priority breakdown */}
      <div className="dtt-card">
        <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 14 }}>🎯 Tasks by Priority</div>
        <div style={{ display: "flex", gap: 16 }}>
          {[["High","#ef4444"],["Medium","#f59e0b"],["Low","#22c55e"]].map(([p, color]) => (
            <div key={p} style={{ flex: 1, padding: "14px", borderRadius: 14, border: `1px solid ${color}44`, background: `${color}12`, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{stats.byPriority[p] || 0}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 4 }}>{p}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Overdue tasks list */}
      {stats.overdue > 0 && (
        <div className="dtt-card" style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 12, color: "#f87171" }}>🚨 Overdue Tasks</div>
          <div style={{ display: "grid", gap: 8 }}>
            {tasks.filter(t => t.dueDate && t.status !== "Done" && new Date(`${t.dueDate}T00:00:00`) < today)
              .slice(0, 8).map(t => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{t.taskName}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.owner} · {t.projectName} · {t.stage}</div>
                </div>
                <div style={{ fontSize: 12, color: "#f87171", fontWeight: 900, flexShrink: 0 }}>Due {t.dueDate}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}