import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Props:
 * - tasks
 * - onEdit(id)            // optional
 * - onDelete(id)
 * - onUpdateTask(task)    // required for inline edits
 * - canEditAny
 * - canEditTask(task)
 */

function useWindowWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
}

function safeSubtasks(task) {
  const subs = Array.isArray(task.subtasks) ? task.subtasks : [];
  return subs.map((s) => ({
    id: s.id || crypto.randomUUID(),
    title: String(s.title || ""),
    done: Boolean(s.done),
  }));
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
  const subs = safeSubtasks(task);
  if (subs.length === 0) return task.status === "Done" ? 100 : 0;
  const done = subs.filter((s) => s.done).length;
  return Math.round((done / subs.length) * 100);
}

function ProgressBar({ value }) {
  return (
    <div style={styles.pbWrap} title={`${value}%`}>
      <div style={{ ...styles.pbFill, width: `${value}%` }} />
      <div style={styles.pbText}>{value}%</div>
    </div>
  );
}

function Badge({ children }) {
  return <span style={styles.badge}>{children}</span>;
}

/** Smooth expand/collapse wrapper (height animation) */
function Collapse({ open, children }) {
  const innerRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    if (open) {
      const h = el.scrollHeight;
      setHeight(h);
      // After transition ends, set to "auto" behavior by re-measuring
      const t = setTimeout(() => {
        const h2 = el.scrollHeight;
        setHeight(h2);
      }, 220);
      return () => clearTimeout(t);
    } else {
      // set current height then animate to 0
      const h = el.scrollHeight;
      setHeight(h);
      requestAnimationFrame(() => setHeight(0));
    }
  }, [open]);

  return (
    <div
      style={{
        overflow: "hidden",
        height: open ? height : 0,
        transition: "height 220ms ease",
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

export default function TaskTable({
  tasks,
  onEdit,
  onDelete,
  onUpdateTask,
  canEditAny,
  canEditTask,
}) {
  const [expanded, setExpanded] = useState(() => new Set());
  const width = useWindowWidth();
  const isMobile = width < 900;

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function updateSubtask(task, subId, patch) {
    const allowed = canEditAny || canEditTask(task);
    if (!allowed) return;

    const subs = safeSubtasks(task).map((s) => (s.id === subId ? { ...s, ...patch } : s));
    onUpdateTask?.({ ...task, subtasks: subs, updatedAt: new Date().toISOString() });
  }

  function addSubtask(task) {
    const allowed = canEditAny || canEditTask(task);
    if (!allowed) return;

    const subs = safeSubtasks(task);
    subs.push({ id: crypto.randomUUID(), title: "", done: false });
    onUpdateTask?.({ ...task, subtasks: subs, updatedAt: new Date().toISOString() });
    setExpanded((prev) => new Set(prev).add(task.id));
  }

  function removeSubtask(task, subId) {
    const allowed = canEditAny || canEditTask(task);
    if (!allowed) return;

    const subs = safeSubtasks(task).filter((s) => s.id !== subId);
    onUpdateTask?.({ ...task, subtasks: subs, updatedAt: new Date().toISOString() });
  }

  if (!tasks.length) {
    return <div style={styles.empty}>No tasks found.</div>;
  }

  // ✅ MOBILE CARD VIEW
  if (isMobile) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        {tasks.map((task) => {
          const overdue = isOverdue(task);
          const progress = calcProgress(task);
          const subs = safeSubtasks(task);
          const open = expanded.has(task.id);
          const canEdit = canEditAny || canEditTask(task);

          return (
            <div key={task.id} style={{ ...styles.card, ...(overdue ? styles.cardOverdue : {}) }}>
              <div style={styles.cardTop}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={styles.cardTitle}>{task.taskName}</div>
                  <div style={styles.cardMeta}>
                    <Badge>{task.owner}</Badge>
                    <Badge>{task.section || "Other"}</Badge>
                    <Badge>{task.priority}</Badge>
                    <Badge>{task.status}</Badge>
                    {overdue && <span style={styles.overduePill}>Overdue</span>}
                  </div>
                </div>

                <button type="button" onClick={() => toggleExpand(task.id)} style={styles.smallBtn}>
                  {open ? "Hide" : "Details"}
                </button>
              </div>

              <div style={styles.cardRow}>
                <div style={styles.cardLabel}>Due</div>
                <div>{task.dueDate}</div>
              </div>

              <div style={styles.cardRow}>
                <div style={styles.cardLabel}>Progress</div>
                <ProgressBar value={progress} />
              </div>

              <div style={styles.cardRow}>
                <div style={styles.cardLabel}>External</div>
                <div>{task.externalStakeholders || "-"}</div>
              </div>

              <Collapse open={open}>
                <div style={styles.detailCard}>
                  <div style={styles.detailHeader}>
                    <div style={styles.detailTitle}>Sub-tasks</div>
                    <button
                      type="button"
                      onClick={() => addSubtask(task)}
                      style={styles.smallBtn}
                      disabled={!canEdit}
                    >
                      + Add
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
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={styles.cardActions}>
                    {canEdit ? (
                      <>
                        {onEdit && (
                          <button onClick={() => onEdit(task.id)} style={styles.linkBtn}>
                            Edit
                          </button>
                        )}
                        <button onClick={() => onDelete(task.id)} style={{ ...styles.linkBtn, color: "#fca5a5" }}>
                          Delete
                        </button>
                      </>
                    ) : (
                      <span style={styles.muted}>View only</span>
                    )}
                  </div>
                </div>
              </Collapse>
            </div>
          );
        })}
      </div>
    );
  }

  // ✅ DESKTOP TABLE VIEW (Sticky header + expand animation)
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, ...styles.thSticky }}>Task</th>
            <th style={{ ...styles.th, ...styles.thSticky }}>Owner</th>
            <th style={{ ...styles.th, ...styles.thSticky }}>Section</th>
            <th style={{ ...styles.th, ...styles.thSticky }}>Priority</th>
            <th style={{ ...styles.th, ...styles.thSticky }}>Due</th>
            <th style={{ ...styles.th, ...styles.thSticky }}>Status</th>
            <th style={{ ...styles.th, ...styles.thSticky }}>Progress</th>
            <th style={{ ...styles.th, ...styles.thSticky }}>External</th>
            <th style={{ ...styles.th, ...styles.thSticky }}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {tasks.map((task) => {
            const overdue = isOverdue(task);
            const progress = calcProgress(task);
            const subs = safeSubtasks(task);
            const open = expanded.has(task.id);
            const canEdit = canEditAny || canEditTask(task);

            return (
              <React.Fragment key={task.id}>
                <tr style={{ background: overdue ? "rgba(244,63,94,0.10)" : "transparent" }}>
                  <td style={styles.td}>
                    <div style={styles.taskCell}>
                      <button
                        type="button"
                        onClick={() => toggleExpand(task.id)}
                        style={styles.expandBtn}
                        title={open ? "Collapse" : "Expand"}
                      >
                        {open ? "▾" : "▸"}
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

                  <td style={styles.td}><Badge>{task.owner}</Badge></td>
                  <td style={styles.td}><Badge>{task.section || "Other"}</Badge></td>
                  <td style={styles.td}><Badge>{task.priority}</Badge></td>
                  <td style={styles.td}>{task.dueDate}</td>
                  <td style={styles.td}><Badge>{task.status}</Badge></td>
                  <td style={styles.td}><ProgressBar value={progress} /></td>
                  <td style={styles.td}>{task.externalStakeholders || "-"}</td>

                  <td style={styles.td}>
                    {canEdit ? (
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <button onClick={() => toggleExpand(task.id)} style={styles.linkBtn}>
                          {open ? "Hide" : "Details"}
                        </button>
                        {onEdit && (
                          <button onClick={() => onEdit(task.id)} style={styles.linkBtn}>
                            Edit
                          </button>
                        )}
                        <button onClick={() => onDelete(task.id)} style={{ ...styles.linkBtn, color: "#fca5a5" }}>
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span style={styles.muted}>View only</span>
                    )}
                  </td>
                </tr>

                <tr>
                  <td colSpan={9} style={{ ...styles.td, paddingTop: 0, paddingBottom: 0 }}>
                    <Collapse open={open}>
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
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Collapse>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  empty: { padding: 18, textAlign: "center", color: "rgba(226,232,240,0.75)" },

  // Desktop table container (scrollable)
  tableWrap: {
    overflow: "auto",
    maxHeight: "70vh",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 980 },

  th: {
    textAlign: "left",
    padding: 12,
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(226,232,240,0.85)",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
  },
  thSticky: {
    position: "sticky",
    top: 0,
    zIndex: 5,
    backdropFilter: "blur(8px)",
  },

  td: {
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    verticalAlign: "top",
    fontSize: 13,
    color: "#e5e7eb",
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

  taskCell: { display: "grid", gridTemplateColumns: "20px 1fr", gap: 10, alignItems: "start" },
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

  linkBtn: { background: "transparent", border: "none", cursor: "pointer", padding: 0, color: "#93c5fd", fontWeight: 900 },

  muted: { fontSize: 12, color: "rgba(226,232,240,0.55)" },

  pbWrap: {
    position: "relative",
    height: 22,
    minWidth: 120,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  pbFill: { height: "100%", background: "linear-gradient(90deg, #60a5fa, #34d399)" },
  pbText: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#e5e7eb" },

  detailCard: {
    marginTop: 10,
    marginBottom: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: 12,
  },
  detailHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 },
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

  subRow: { display: "grid", gridTemplateColumns: "18px 1fr 34px", gap: 10, alignItems: "center" },
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

  // Mobile cards
  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    padding: 14,
  },
  cardOverdue: { boxShadow: "0 0 0 1px rgba(244,63,94,0.25) inset" },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" },
  cardTitle: { fontWeight: 950, color: "#f8fafc", fontSize: 15 },
  cardMeta: { display: "flex", gap: 8, flexWrap: "wrap" },
  cardRow: { display: "grid", gridTemplateColumns: "90px 1fr", gap: 10, marginTop: 10, alignItems: "center" },
  cardLabel: { color: "rgba(226,232,240,0.70)", fontSize: 12, fontWeight: 900 },
  cardActions: { marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" },
};
