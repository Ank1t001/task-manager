function isOverdue(task) {
  if (!task?.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(task.dueDate + "T00:00:00");
  const notDone = task.status !== "Done";
  return due < today && notDone;
}

function Badge({ text }) {
  return <span style={styles.badge}>{text}</span>;
}

function PriorityBadge({ p }) {
  const map = {
    High: { bg: "#fee2e2", border: "#fecaca", color: "#991b1b" },
    Medium: { bg: "#fef9c3", border: "#fde68a", color: "#854d0e" },
    Low: { bg: "#dcfce7", border: "#bbf7d0", color: "#166534" },
  };
  const s = map[p] || map.Medium;
  return (
    <span style={{ ...styles.badge, background: s.bg, borderColor: s.border, color: s.color }}>
      {p}
    </span>
  );
}

function StatusBadge({ s }) {
  const map = {
    "To Do": { bg: "#e5e7eb", border: "#d1d5db", color: "#111827" },
    "In Progress": { bg: "#dbeafe", border: "#bfdbfe", color: "#1d4ed8" },
    Blocked: { bg: "#ffe4e6", border: "#fecdd3", color: "#9f1239" },
    Done: { bg: "#dcfce7", border: "#bbf7d0", color: "#166534" },
  };
  const st = map[s] || map["To Do"];
  return (
    <span style={{ ...styles.badge, background: st.bg, borderColor: st.border, color: st.color }}>
      {s}
    </span>
  );
}

export default function TaskTable({ tasks, onEdit, onDelete }) {
  if (!tasks.length) return <div style={{ color: "#6b7280" }}>No tasks yet.</div>;

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {["Task", "Owner", "Section", "Priority", "Due", "Status", "External stakeholders", "Actions"].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {tasks.map((t) => {
            const overdue = isOverdue(t);
            return (
              <tr key={t.id} style={{ background: overdue ? "#fff1f2" : "white" }}>
                <td style={styles.td}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ fontWeight: 700, color: "#111827" }}>{t.taskName}</div>
                    {overdue && (
                      <span style={{ ...styles.badge, background: "#fecdd3", borderColor: "#fda4af", color: "#9f1239" }}>
                        Overdue
                      </span>
                    )}
                  </div>
                </td>

                <td style={styles.td}><Badge text={t.owner} /></td>

                <td style={styles.td}>
                  <Badge text={t.section || "Other"} />
                </td>

                <td style={styles.td}><PriorityBadge p={t.priority} /></td>
                <td style={styles.td}>{t.dueDate}</td>
                <td style={styles.td}><StatusBadge s={t.status} /></td>
                <td style={styles.td}>{t.externalStakeholders || <span style={{ color: "#9ca3af" }}>—</span>}</td>

                <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                  <button onClick={() => onEdit(t.id)} style={styles.linkBtn}>Edit</button>
                  <button onClick={() => onDelete(t.id)} style={{ ...styles.linkBtn, color: "#b91c1c" }}>
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
  tableWrap: { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12 },
  table: { width: "100%", borderCollapse: "collapse", background: "white" },
  th: { textAlign: "left", padding: 12, fontSize: 12, color: "#374151", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" },
  td: { padding: 12, borderBottom: "1px solid #f1f5f9", verticalAlign: "top", fontSize: 13 },
  badge: { display: "inline-block", padding: "4px 8px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#f3f4f6", color: "#111827", fontSize: 12, fontWeight: 600 },
  linkBtn: { background: "transparent", border: "none", cursor: "pointer", padding: 0, marginRight: 10, color: "#1d4ed8", fontWeight: 700 },
};
