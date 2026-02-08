function isOverdue(task) {
  if (!task?.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(task.dueDate + "T00:00:00");
  const notDone = task.status !== "Done";
  return due < today && notDone;
}

function calcProgress(task) {
  const st = Array.isArray(task?.subtasks) ? task.subtasks : [];
  if (st.length === 0) {
    return task.status === "Done" ? 100 : 0;
  }
  const done = st.filter((x) => x.done).length;
  return Math.round((done / st.length) * 100);
}

function Badge({ text }) {
  return <span style={styles.badge}>{text}</span>;
}

function ProgressBar({ value }) {
  return (
    <div style={styles.pbWrap} title={`${value}% complete`}>
      <div style={{ ...styles.pbFill, width: `${value}%` }} />
      <div style={styles.pbText}>{value}%</div>
    </div>
  );
}

export default function TaskTable({ tasks, onEdit, onDelete, isAdmin }) {
  if (!tasks.length) return <div style={{ color: "#94a3b8" }}>No tasks yet.</div>;

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {["Task", "Owner", "Section", "Priority", "Due", "Status", "Progress", "External stakeholders", "Actions"].map(
              (h) => (
                <th key={h} style={styles.th}>
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {tasks.map((t) => {
            const overdue = isOverdue(t);
            const progress = calcProgress(t);

            return (
              <tr key={t.id} style={{ background: overdue ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.02)" }}>
                <td style={styles.td}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900, color: "#e2e8f0" }}>{t.taskName}</div>
                    {overdue && <span style={{ ...styles.badge, borderColor: "rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.10)", color: "#fecaca" }}>Overdue</span>}
                  </div>
                </td>

                <td style={styles.td}><Badge text={t.owner} /></td>
                <td style={styles.td}><Badge text={t.section || "Other"} /></td>
                <td style={styles.td}><Badge text={t.priority} /></td>
                <td style={styles.td}>{t.dueDate}</td>
                <td style={styles.td}><Badge text={t.status} /></td>

                <td style={styles.td}>
                  <ProgressBar value={progress} />
                </td>

                <td style={styles.td}>
                  {t.externalStakeholders || <span style={{ color: "#94a3b8" }}>—</span>}
                </td>

                <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                  <button onClick={() => onEdit(t.id)} style={styles.linkBtn} disabled={!isAdmin}>
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(t.id)}
                    style={{ ...styles.linkBtn, color: "#fecaca" }}
                    disabled={!isAdmin}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {!isAdmin && (
        <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12 }}>
          Viewer mode: only Admin (Ankit) can edit/delete.
        </div>
      )}
    </div>
  );
}

const styles = {
  tableWrap: {
    overflowX: "auto",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    background: "rgba(255,255,255,0.03)",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: 12,
    fontSize: 12,
    color: "#cbd5e1",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  },
  td: {
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    verticalAlign: "top",
    fontSize: 13,
    color: "#e2e8f0",
  },
  badge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: 800,
  },
  linkBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    marginRight: 10,
    color: "#bfdbfe",
    fontWeight: 900,
  },
  pbWrap: {
    position: "relative",
    height: 22,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    overflow: "hidden",
    minWidth: 120,
  },
  pbFill: {
    height: "100%",
    background: "rgba(191,219,254,0.55)",
  },
  pbText: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 900,
    color: "#e2e8f0",
  },
};
