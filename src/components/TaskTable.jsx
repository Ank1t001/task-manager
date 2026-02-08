import { useMemo, useState } from "react";

function isOverdue(task) {
  if (!task?.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate + "T00:00:00");
  return due < today && task.status !== "Done";
}

function calcProgress(task) {
  const st = Array.isArray(task?.subtasks) ? task.subtasks : [];
  if (st.length === 0) return task.status === "Done" ? 100 : 0;
  const done = st.filter((x) => x.done).length;
  return Math.round((done / st.length) * 100);
}

function chipStyles(theme) {
  const dark = theme === "dark";
  return {
    chip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      borderRadius: 999,
      border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(15,23,42,0.12)",
      background: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.90)",
      color: dark ? "rgba(226,232,240,0.92)" : "rgba(15,23,42,0.86)",
      fontSize: 12,
      fontWeight: 800,
      whiteSpace: "nowrap",
    },
  };
}

function badge(theme, type) {
  const dark = theme === "dark";
  const map = {
    Low: dark
      ? { bg: "rgba(59,130,246,0.12)", br: "rgba(59,130,246,0.28)", tx: "rgba(226,232,240,0.92)" }
      : { bg: "rgba(59,130,246,0.10)", br: "rgba(59,130,246,0.25)", tx: "rgba(15,23,42,0.88)" },
    Medium: dark
      ? { bg: "rgba(245,158,11,0.12)", br: "rgba(245,158,11,0.28)", tx: "rgba(226,232,240,0.92)" }
      : { bg: "rgba(245,158,11,0.10)", br: "rgba(245,158,11,0.25)", tx: "rgba(15,23,42,0.88)" },
    High: dark
      ? { bg: "rgba(239,68,68,0.12)", br: "rgba(239,68,68,0.28)", tx: "rgba(226,232,240,0.92)" }
      : { bg: "rgba(239,68,68,0.10)", br: "rgba(239,68,68,0.25)", tx: "rgba(15,23,42,0.88)" },

    "To Do": dark
      ? { bg: "rgba(148,163,184,0.10)", br: "rgba(148,163,184,0.24)", tx: "rgba(226,232,240,0.92)" }
      : { bg: "rgba(148,163,184,0.12)", br: "rgba(148,163,184,0.25)", tx: "rgba(15,23,42,0.88)" },
    "In Progress": dark
      ? { bg: "rgba(59,130,246,0.12)", br: "rgba(59,130,246,0.28)", tx: "rgba(226,232,240,0.92)" }
      : { bg: "rgba(59,130,246,0.10)", br: "rgba(59,130,246,0.25)", tx: "rgba(15,23,42,0.88)" },
    Blocked: dark
      ? { bg: "rgba(249,115,22,0.12)", br: "rgba(249,115,22,0.28)", tx: "rgba(226,232,240,0.92)" }
      : { bg: "rgba(249,115,22,0.10)", br: "rgba(249,115,22,0.25)", tx: "rgba(15,23,42,0.88)" },
    Done: dark
      ? { bg: "rgba(34,197,94,0.12)", br: "rgba(34,197,94,0.28)", tx: "rgba(226,232,240,0.92)" }
      : { bg: "rgba(34,197,94,0.10)", br: "rgba(34,197,94,0.25)", tx: "rgba(15,23,42,0.88)" },
  };

  const v = map[type] || (dark
    ? { bg: "rgba(255,255,255,0.06)", br: "rgba(255,255,255,0.12)", tx: "rgba(226,232,240,0.9)" }
    : { bg: "rgba(255,255,255,0.90)", br: "rgba(15,23,42,0.12)", tx: "rgba(15,23,42,0.86)" });

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${v.br}`,
    background: v.bg,
    color: v.tx,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}

export default function TaskTable({
  tasks,
  onDelete,
  onUpdateTask,
  canEditAny,
  canEditTask,
  theme = "dark",
}) {
  const dark = theme === "dark";
  const s = styles(dark);
  const chip = chipStyles(theme);

  const [expanded, setExpanded] = useState(() => new Set());

  function toggleRow(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateSubtasks(task, nextSubtasks) {
    const updated = {
      ...task,
      subtasks: nextSubtasks,
      updatedAt: new Date().toISOString(),
    };
    onUpdateTask(updated);
  }

  return (
    <div style={s.wrap}>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, width: 54 }} />
              <th style={s.th}>Task</th>
              <th style={s.th}>Owner</th>
              <th style={s.th}>Section</th>
              <th style={s.th}>Priority</th>
              <th style={s.th}>Due</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Progress</th>
              <th style={s.th}>External</th>
              <th style={{ ...s.th, width: 160 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td style={s.empty} colSpan={10}>
                  No tasks found.
                </td>
              </tr>
            ) : (
              tasks.map((t) => {
                const isOpen = expanded.has(t.id);
                const overdue = isOverdue(t);
                const progress = calcProgress(t);
                const st = Array.isArray(t.subtasks) ? t.subtasks : [];
                const editable = canEditAny || canEditTask?.(t);

                return (
                  <>
                    <tr key={t.id} style={overdue ? s.rowOverdue : s.row}>
                      <td style={s.td}>
                        <button
                          type="button"
                          onClick={() => toggleRow(t.id)}
                          style={s.expandBtn}
                          title={isOpen ? "Collapse" : "Expand"}
                        >
                          {isOpen ? "▾" : "▸"}
                        </button>
                      </td>

                      <td style={s.td}>
                        <div style={{ fontWeight: 950, color: dark ? "#EAF0FF" : "#0f172a" }}>
                          {t.taskName}
                        </div>
                        <div style={s.muted}>
                          {st.length ? `${st.filter((x) => x.done).length}/${st.length} subtasks` : "No subtasks"}
                        </div>
                      </td>

                      <td style={s.td}>
                        <span style={chip.chip}>{t.owner || "—"}</span>
                      </td>

                      <td style={s.td}>
                        <span style={chip.chip}>{t.section || "Other"}</span>
                      </td>

                      <td style={s.td}>
                        <span style={badge(theme, t.priority)}>{t.priority}</span>
                      </td>

                      <td style={s.td}>
                        <span style={{ fontWeight: 800, color: overdue ? (dark ? "#FCA5A5" : "#B91C1C") : s.text }}>
                          {t.dueDate || "—"}
                        </span>
                      </td>

                      <td style={s.td}>
                        <span style={badge(theme, t.status)}>{t.status}</span>
                      </td>

                      <td style={s.td}>
                        <div style={s.progressWrap}>
                          <div style={{ ...s.progressFill, width: `${progress}%` }} />
                          <div style={s.progressText}>{progress}%</div>
                        </div>
                      </td>

                      <td style={s.td}>
                        <span style={s.text}>{t.externalStakeholders || "—"}</span>
                      </td>

                      <td style={s.td}>
                        <div style={s.actions}>
                          <button
                            style={s.linkBtn}
                            type="button"
                            onClick={() => toggleRow(t.id)}
                          >
                            Details
                          </button>

                          <button
                            style={{ ...s.linkBtn, ...(editable ? {} : s.disabledBtn) }}
                            type="button"
                            onClick={() => editable && onDelete?.(t.id)}
                            disabled={!editable}
                            title={!editable ? "You can only delete your own tasks" : "Delete task"}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isOpen ? (
                      <tr key={`${t.id}-details`}>
                        <td style={s.detailCell} colSpan={10}>
                          <div style={s.detailBox}>
                            <div style={s.detailTitle}>Sub-tasks</div>

                            {st.length === 0 ? (
                              <div style={s.muted}>No subtasks yet.</div>
                            ) : (
                              <div style={{ display: "grid", gap: 10 }}>
                                {st.map((sub, idx) => (
                                  <label key={idx} style={s.subRow}>
                                    <input
                                      type="checkbox"
                                      checked={Boolean(sub.done)}
                                      disabled={!editable}
                                      onChange={(e) => {
                                        if (!editable) return;
                                        const next = st.map((x, i) =>
                                          i === idx ? { ...x, done: e.target.checked } : x
                                        );
                                        updateSubtasks(t, next);
                                      }}
                                    />
                                    <input
                                      value={sub.title || ""}
                                      disabled={!editable}
                                      placeholder="Sub-task..."
                                      style={s.subInput}
                                      onChange={(e) => {
                                        if (!editable) return;
                                        const next = st.map((x, i) =>
                                          i === idx ? { ...x, title: e.target.value } : x
                                        );
                                        updateSubtasks(t, next);
                                      }}
                                    />
                                    {editable && (
                                      <button
                                        type="button"
                                        style={s.smallBtn}
                                        onClick={() => {
                                          const next = st.filter((_, i) => i !== idx);
                                          updateSubtasks(t, next);
                                        }}
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </label>
                                ))}
                              </div>
                            )}

                            {editable && (
                              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  style={s.smallBtn}
                                  onClick={() => updateSubtasks(t, [...st, { title: "", done: false }])}
                                >
                                  + Add sub-task
                                </button>

                                <div style={s.muted}>
                                  Progress auto-calculated: <strong style={{ color: s.text }}>{calcProgress(t)}%</strong>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function styles(dark) {
  const text = dark ? "rgba(226,232,240,0.92)" : "#0f172a";
  const muted = dark ? "rgba(226,232,240,0.62)" : "rgba(15,23,42,0.62)";

  return {
    text,
    wrap: { width: "100%" },

    tableWrap: {
      width: "100%",
      overflowX: "auto",
      borderRadius: 16,
      border: dark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(15,23,42,0.10)",
      background: dark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.78)",
    },

    table: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: 0,
      minWidth: 1040,
    },

    th: {
      textAlign: "left",
      padding: "12px 12px",
      fontSize: 12,
      fontWeight: 950,
      color: muted,
      position: "sticky",
      top: 0,
      zIndex: 2,
      background: dark
        ? "linear-gradient(180deg, rgba(11,30,51,0.92), rgba(7,19,33,0.92))"
        : "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,247,255,0.96))",
      borderBottom: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(15,23,42,0.08)",
    },

    td: {
      padding: "12px 12px",
      borderBottom: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.06)",
      color: text,
      verticalAlign: "middle",
      background: "transparent",
    },

    row: {
      background: "transparent",
    },

    rowOverdue: {
      background: dark ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.06)",
    },

    muted: { marginTop: 4, fontSize: 12, color: muted },

    empty: {
      padding: 18,
      color: muted,
      textAlign: "center",
    },

    expandBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(15,23,42,0.12)",
      background: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.95)",
      cursor: "pointer",
      fontWeight: 950,
      color: text,
    },

    progressWrap: {
      width: 160,
      position: "relative",
      borderRadius: 999,
      border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(15,23,42,0.12)",
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.90)",
      overflow: "hidden",
      height: 28,
    },
    progressFill: {
      position: "absolute",
      top: 0,
      left: 0,
      bottom: 0,
      background: "linear-gradient(90deg, rgba(59,130,246,0.85), rgba(34,197,94,0.85))",
    },
    progressText: {
      position: "relative",
      zIndex: 1,
      height: "100%",
      display: "grid",
      placeItems: "center",
      fontWeight: 950,
      fontSize: 12,
      color: dark ? "#0b1220" : "#0b1220",
    },

    actions: { display: "flex", gap: 10, alignItems: "center" },

    linkBtn: {
      border: "none",
      background: "transparent",
      cursor: "pointer",
      fontWeight: 950,
      color: dark ? "rgba(147,197,253,0.95)" : "rgba(37,99,235,0.95)",
      padding: 0,
    },

    disabledBtn: {
      opacity: 0.45,
      cursor: "not-allowed",
    },

    detailCell: {
      padding: 0,
      borderBottom: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.06)",
    },

    detailBox: {
      padding: 14,
      background: dark ? "rgba(255,255,255,0.03)" : "rgba(245,247,255,0.78)",
    },

    detailTitle: {
      fontWeight: 950,
      marginBottom: 10,
      color: text,
    },

    subRow: {
      display: "grid",
      gridTemplateColumns: "24px 1fr auto",
      gap: 10,
      alignItems: "center",
    },

    subInput: {
      padding: "10px 12px",
      borderRadius: 12,
      border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(15,23,42,0.12)",
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.98)",
      color: dark ? "rgba(226,232,240,0.92)" : "#0f172a",
      outline: "none",
      width: "100%",
    },

    smallBtn: {
      padding: "10px 12px",
      borderRadius: 12,
      border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(15,23,42,0.12)",
      background: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.95)",
      cursor: "pointer",
      fontWeight: 950,
      color: text,
    },
  };
}
