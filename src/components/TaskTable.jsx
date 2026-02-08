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

function ProgressBar({ value }) {
  return (
    <div style={styles.pbWrap} title={`${value}% complete`}>
      <div style={{ ...styles.pbFill, width: `${value}%` }} />
      <div style={styles.pbText}>{value}%</div>
    </div>
  );
}

function Badge({ text }) {
  return <span style={styles.badge}>{text}</span>;
}

export default function TaskTable({ tasks, onEdit, onDelete, canEditAny, canEditTask }) {
  if (!tasks.length) return <div style={{ color: "#6b7280" }}>No tasks yet.</div>;

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {["Task", "Owner", "Section", "Priority", "Due", "Status", "Progress", "External stakeholders", "Actions"].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {tasks.map((t) => {
            const overdue = isOverdue(t);
            const progress = calcProgress(t);
            const canEditThis = canEditAny || canEditTask(t);

            return (
              <tr key={t.id} style={{ background: overdue ? "#fff1f2" : "white" }}>
                <td style={styles.td}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900, color: "#111827" }}>{t.taskName}</div>
                    {overdue && <span style={{ ...styles.badge, background: "#fecdd3", borderColor: "#fda4af", color: "#9f1239" }}>Overdue</span>}
                  </div>
                </td>

                <td style={styles.td}><Badge text={t.owner} /></td>
                <td style={styles.td}><Badge text={t.section || "Other"} /></td>
                <td style={styles.td}><Badge text={t.priority} /></td>
                <td style={styles.td}>{t.dueDate}</td>
                <td style={styles.td}><Badge text={t.status} /></td>
                <td style={styles.td}><ProgressBar value={progress} /></td>
                <td style={styles.td}>{t.externalStakeholders || <span style={{ color: "#9ca3af" }}>—</span>}</td>

                <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                  <button onClick={() => onEdit(t.id)} style={styles.linkBtn} disabled={!canEditThis}>Edit</button>
                  <button onClick={() => onDelete(t.id)} style={{ ...styles.linkBtn, color: "#b91c1c" }} disabled={!canEditThis}>
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  tableWrap: { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12, background: "white" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: 12, fontSize: 12, color: "#374151", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" },
  td: { padding: 12, borderBottom: "1px solid #f1f5f9", verticalAlign: "top", fontSize: 13, color: "#111827" },
  badge: { display: "inline-block", padding: "4px 8px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#f3f4f6", color: "#111827", fontSize: 12, fontWeight: 800 },
  linkBtn: { background: "transparent", border: "none", cursor: "pointer", padding: 0, marginRight: 10, color: "#1d4ed8", fontWeight: 900 },
  pbWrap: { position: "relative", height: 22, borderRadius: 999, border: "1px solid #e5e7eb", background: "#f3f4f6", overflow: "hidden", minWidth: 120 },
  pbFill: { height: "100%", background: "#bfdbfe" },
  pbText: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#111827" },
};
