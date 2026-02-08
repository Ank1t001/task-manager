export default function MiniDashboard({ counts }) {
  const items = [
    { label: "Overdue", value: counts.overdue, icon: "🔴" },
    { label: "In Progress", value: counts.inProgress, icon: "⏳" },
    { label: "Blocked", value: counts.blocked, icon: "🚫" },
    { label: "Done", value: counts.done, icon: "✅" },
  ];

  return (
    <div style={styles.wrap}>
      {items.map((it) => (
        <div key={it.label} style={styles.card}>
          <div style={styles.top}>
            <span style={styles.icon}>{it.icon}</span>
            <span style={styles.label}>{it.label}</span>
          </div>
          <div style={styles.value}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  wrap: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 12,
  },
  card: {
    border: "1px solid #e5e7eb",
    background: "rgba(255,255,255,0.85)",
    borderRadius: 14,
    padding: "10px 12px",
  },
  top: { display: "flex", alignItems: "center", gap: 8 },
  icon: { fontSize: 16 },
  label: { fontSize: 12, fontWeight: 800, color: "#374151" },
  value: { marginTop: 6, fontSize: 20, fontWeight: 900, color: "#111827" },
};
