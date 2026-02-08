export default function TaskTable({ tasks, onEdit, onDelete }) {
  if (!tasks.length) return <div style={{ color: "#666" }}>No tasks yet.</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Task Name", "Owner", "Priority", "Due Date", "Status", "External Stakeholders", "Actions"].map((h) => (
              <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{t.taskName}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{t.owner}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{t.priority}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{t.dueDate}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{t.status}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{t.externalStakeholders}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: 8, whiteSpace: "nowrap" }}>
                <button onClick={() => onEdit(t.id)} style={{ marginRight: 8, cursor: "pointer" }}>Edit</button>
                <button onClick={() => onDelete(t.id)} style={{ cursor: "pointer" }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
