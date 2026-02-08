import React, { useMemo, useState } from "react";

/**
 * Props:
 * - tasks: array of task objects
 * - onEdit(id)            // optional: jump to edit form on dashboard
 * - onDelete(id)
 * - onUpdateTask(task)    // NEW: needed for inline subtask updates
 * - canEditAny: boolean (admin)
 * - canEditTask(task): boolean (owner-based)
 */

export default function TaskTable({
  tasks,
  onEdit,
  onDelete,
  onUpdateTask,
  canEditAny,
  canEditTask,
}) {
  const [expanded, setExpanded] = useState(() => new Set());

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function isOverdue(task) {
    if (!task?.dueDate) return false;
    if (task.status === "Done") return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate + "T00:00:00");
    return due < today;
  }

  function calcProgress(task) {
    const subs = Array.isArray(task.subtasks) ? task.subtasks : [];
    if (subs.length === 0) return task.status === "Done" ? 100 : 0;
    const done = subs.filter((s) => s.done).length;
    return Math.round((done / subs.length) * 100);
  }

  function safeSubtasks(task) {
    const subs = Array.isArray(task.subtasks) ? task.subtasks : [];
    return subs.map((s) => ({
      id: s.id || crypto.randomUUID(),
      title: String(s.title || ""),
      done: Boolean(s.done),
    }));
  }

  function updateSubtask(task, subId, patch) {
    const canEdit = canEditAny || canEditTask(task);
    if (!canEdit) return;

    const subs = safeSubtasks(task).map((s) => (s.id === subId ? { ...s, ...patch } : s));
    const updated = { ...task, subtasks: subs, updatedAt: new Date().toISOString() };
    onUpdateTask?.(updated);
  }

  function addSubtask(task) {
    const canEdit = canEditAny || canEditTask(task);
    if (!canEdit) return;

    const subs = safeSubtasks(task);
    subs.push({ id: crypto.randomUUID(), title: "", done: false });
    const updated = { ...task, subtasks: subs, updatedAt: new Date().toISOString() };
    onUpdateTask?.(updated);
    // auto-expand so user sees it
    setExpanded((prev) => new Set(prev).add(task.id));
  }

  function removeSubtask(task, subId) {
    const canEdit = canEditAny || canEditTask(task);
    if (!canEdit) return;

    const subs = safeSubtasks(task).filter((s) => s.id !== subId);
    const updated = { ...task, subtasks: subs, updatedAt: new Date().toISOString() };
    onUpdateTask?.(updated);
  }

  if (!tasks.length) {
    return <div style={styles.empty}>No tasks found. Try changing filters.</div>;
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Task</th>
            <th style={styles.th}>Owner</th>
            <th style={styles.th}>Section</th>
            <th style={styles.th}>Priority</th>
            <th style={styles.th}>Due</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Progress</th>
            <th style={styles.th}>External</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {tasks.map((task) => {
            const overdue = isOverdue(task);
            const progress = calcProgress(task);
            const subs = safeSubtasks(task);
            const isOpen = expanded.has(task.id);
            const canEdit = canEditAny || canEditTask(task);

            return (
              <React.Fragment key={task.id}>
                {/* Main row */}
                <tr
                  style={{
                    background: overdue ? "rgba(244,63,94,0.10)" : "transparent",
                  }}
                >
                  <td style={styles.td}>
                    <div style={styles.taskCell}>
                      <button
                        type="button"
                        onClick={() => toggleExpand(task.id)}
                        style={styles.expandBtn}
                        title={isOpen ? "Collapse" : "Expand"}
                      >
                        {isOpen ? "▾" : "▸"}
                      </button>

                      <div>
                        <div style={styles.taskTitle}>{task.taskName}</div>
                        <div style={styles.subtaskHint}>
                          {subs.length > 0 ? (
                            <>
                              {subs.filter((s) => s.done).length}/{subs.length} subtasks
                            </>
                          ) : (
                            <>No subtasks</>
                          )}
                          {overdue && <span style={styles.overduePill}>Overdue</span>}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td style={styles.td}><span style={styles.badge}>{task.owner}</span></td>
                  <td style={styles.td}><span style={styles.badge}>{task.section || "Other"}</span></td>
                  <td style={styles.td}><span style={styles.badge}>{task.priority}</span></td>

                  <td style={styles.td}>
                    <div>{task.dueDate}</div>
                  </td>

                  <td style={styles.td}><span style={styles.badge}>{task.status}</span></td>

                  <td style={styles.td}>
                    <div style={styles.pbWrap}>
                      <div style={{ ...styles.pbFill, width: `${progress}%` }} />
                      <div style={styles.pbText}>{progress}%</div>
                    </div>
                  </td>

                  <td style={styles.td}>{task.externalStakeholders || "-"}</td>

                  <td style={styles.td}>
                    {canEdit ? (
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <button onClick={() => toggleExpand(task.id)} style={styles.linkBtn}>
                          {isOpen ? "Hide" : "Details"}
                        </button>

                        {onEdit && (
                          <button onClick={() => onEdit(task.id)} style={styles.linkBtn}>
                            Edit
                          </button>
                        )}

                        <button
                          onClick={() => onDelete(task.id)}
                          style={{ ...styles.linkBtn, color: "#fca5a5" }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span style={styles.muted}>View only</span>
                    )}
                  </td>
                </tr>

                {/* Expanded details row */}
                {isOpen && (
                  <tr>
                    <td style={{ ...styles.td, paddingTop: 0 }} colSpan={9}>
                      <div style={styles.detailCard}>
                        <div style={styles.detailHeader}>
                          <div style={styles.detailTitle}>Sub-tasks checklist</div>
                          <button
                            type="button"
                            onClick={() => addSubtask(task)}
                            style={styles.smallBtn}
                            disabled={!canEdit}
                          >
                            + Add sub-task
                          </button>
                        </div>

                        {subs.length === 0 ? (
                          <div style={styles.muted}>No sub-tasks yet.</div>
                        ) : (
                          <div style={{ display: "grid", gap: 8 }}>
                            {subs.map((s) => (
                              <div key={s.id} style={styles.subRow}>
                                <input
                                  type="checkbox"
                                  checked={s.done}
                                  onChange={(e) => updateSubtask(task, s.id, { done: e.target.checked })}
                                  disabled={!canEdit}
                                />

                                <input
                                  value={s.title}
                                  onChange={(e) => updateSubtask(task, s.id, { title: e.target.value })}
                                  placeholder="Sub-task title..."
                                  style={styles.subInput}
                                  disabled={!canEdit}
                                />

                                <button
                                  type="button"
                                  onClick={() => removeSubtask(task, s.id)}
                                  style={styles.subRemove}
                                  disabled={!canEdit}
                                  title="Remove"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  empty: {
    padding: 18,
    textAlign: "center",
    color: "rgba(226,232,240,0.75)",
    fontSize: 14,
  },

  tableWrap: {
    overflowX: "auto",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 980,
  },

  th: {
    textAlign: "left",
    padding: 12,
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(226,232,240,0.85)",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },

  td: {
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    verticalAlign: "top",
    fontSize: 13,
    color: "#e5e7eb",
  },

  taskCell: {
    display: "grid",
    gridTemplateColumns: "20px 1fr",
    gap: 10,
    alignItems: "start",
  },

  expandBtn: {
    width: 20,
    height: 20,
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 900,
    lineHeight: "18px",
    padding: 0,
  },

  taskTitle: { fontWeight: 900, color: "#f8fafc" },

  subtaskHint: {
    marginTop: 4,
    fontSize: 11,
    color: "rgba(226,232,240,0.65)",
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },

  overduePill: {
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(244,63,94,0.35)",
    background: "rgba(244,63,94,0.18)",
    color: "#fecaca",
    fontWeight: 900,
  },

  badge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    fontWeight: 900,
    color: "#e5e7eb",
  },

  muted: {
    fontSize: 12,
    color: "rgba(226,232,240,0.55)",
  },

  linkBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    color: "#93c5fd",
    fontWeight: 900,
    fontSize: 13,
  },

  pbWrap: {
    position: "relative",
    height: 22,
    minWidth: 120,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },

  pbFill: {
    height: "100%",
    background: "linear-gradient(90deg, #60a5fa, #34d399)",
  },

  pbText: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 900,
    color: "#e5e7eb",
  },

  detailCard: {
    marginTop: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: 12,
  },

  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },

  detailTitle: { fontWeight: 900, color: "#f8fafc" },

  smallBtn: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 900,
  },

  subRow: {
    display: "grid",
    gridTemplateColumns: "18px 1fr 34px",
    gap: 10,
    alignItems: "center",
  },

  subInput: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    outline: "none",
    width: "100%",
  },

  subRemove: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid rgba(244,63,94,0.35)",
    background: "rgba(244,63,94,0.18)",
    color: "#fecaca",
    cursor: "pointer",
    fontWeight: 900,
  },
};
