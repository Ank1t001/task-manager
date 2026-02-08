import React, { useMemo } from "react";

const COLUMNS = ["To Do", "In Progress", "Blocked", "Done"];

function isOverdue(task) {
  if (!task?.dueDate) return false;
  if (task.status === "Done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate + "T00:00:00");
  return due < today;
}

function calcProgress(task) {
  const subs = Array.isArray(task?.subtasks) ? task.subtasks : [];
  if (subs.length === 0) return task.status === "Done" ? 100 : 0;
  const done = subs.filter((s) => s.done).length;
  return Math.round((done / subs.length) * 100);
}

export default function KanbanBoard({
  tasks,
  onEdit,
  onDelete,
  onUpdateTask,
  canEditAny,
  canEditTask,
}) {
  const grouped = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map((c) => [c, []]));
    for (const t of tasks) map[t.status || "To Do"]?.push(t);
    return map;
  }, [tasks]);

  function moveStatus(task, status) {
    const allowed = canEditAny || canEditTask(task);
    if (!allowed) return;
    onUpdateTask?.({ ...task, status, updatedAt: new Date().toISOString() });
  }

  return (
    <div style={styles.wrap}>
      {COLUMNS.map((col) => (
        <div key={col} style={styles.col}>
          <div style={styles.colHeader}>
            <div style={styles.colTitle}>{col}</div>
            <div style={styles.colCount}>{grouped[col].length}</div>
          </div>

          <div style={styles.cards}>
            {grouped[col].map((t) => {
              const overdue = isOverdue(t);
              const progress = calcProgress(t);
              const canEdit = canEditAny || canEditTask(t);

              return (
                <div key={t.id} style={{ ...styles.card, ...(overdue ? styles.cardOverdue : {}) }}>
                  <div style={styles.taskName}>{t.taskName}</div>

                  <div style={styles.meta}>
                    <span style={styles.badge}>{t.owner}</span>
                    <span style={styles.badge}>{t.section || "Other"}</span>
                    <span style={styles.badge}>{t.priority}</span>
                    {overdue && <span style={styles.overdue}>Overdue</span>}
                  </div>

                  <div style={styles.row}>
                    <div style={styles.label}>Due</div>
                    <div>{t.dueDate}</div>
                  </div>

                  <div style={styles.row}>
                    <div style={styles.label}>Progress</div>
                    <div style={styles.pbWrap}>
                      <div style={{ ...styles.pbFill, width: `${progress}%` }} />
                      <div style={styles.pbText}>{progress}%</div>
                    </div>
                  </div>

                  <div style={styles.actions}>
                    {canEdit ? (
                      <>
                        <select
                          value={t.status}
                          onChange={(e) => moveStatus(t, e.target.value)}
                          style={styles.select}
                        >
                          {COLUMNS.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>

                        {onEdit && (
                          <button onClick={() => onEdit(t.id)} style={styles.linkBtn}>
                            Edit
                          </button>
                        )}

                        <button onClick={() => onDelete(t.id)} style={{ ...styles.linkBtn, color: "#fca5a5" }}>
                          Delete
                        </button>
                      </>
                    ) : (
                      <span style={styles.muted}>View only</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  wrap: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  col: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  colHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.05)",
  },
  colTitle: { fontWeight: 950, color: "#f8fafc" },
  colCount: {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    fontWeight: 900,
    color: "#e5e7eb",
    fontSize: 12,
  },
  cards: { padding: 12, display: "grid", gap: 10, maxHeight: "68vh", overflow: "auto" },
  card: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    padding: 12,
  },
  cardOverdue: { boxShadow: "0 0 0 1px rgba(244,63,94,0.25) inset" },
  taskName: { fontWeight: 950, color: "#f8fafc" },
  meta: { marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" },
  badge: {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    fontWeight: 900,
    color: "#e5e7eb",
  },
  overdue: {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(244,63,94,0.35)",
    background: "rgba(244,63,94,0.18)",
    color: "#fecaca",
    fontWeight: 900,
    fontSize: 12,
  },
  row: { marginTop: 10, display: "grid", gridTemplateColumns: "70px 1fr", gap: 10, alignItems: "center" },
  label: { color: "rgba(226,232,240,0.70)", fontWeight: 900, fontSize: 12 },
  pbWrap: {
    position: "relative",
    height: 22,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  pbFill: { height: "100%", background: "linear-gradient(90deg, #60a5fa, #34d399)" },
  pbText: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, color: "#e5e7eb" },
  actions: { marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  select: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    outline: "none",
    fontWeight: 900,
  },
  linkBtn: { background: "transparent", border: "none", cursor: "pointer", padding: 0, color: "#93c5fd", fontWeight: 900 },
  muted: { fontSize: 12, color: "rgba(226,232,240,0.55)" },
};
