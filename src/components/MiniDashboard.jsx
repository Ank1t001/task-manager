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
    gap: 12,
  },
  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(8px)",
    padding: "14px 14px",
  },
  top: { display: "flex", alignItems: "center", gap: 10 },
  icon: { fontSize: 16 },
  label: { fontSize: 13, fontWeight: 900, color: "rgba(226,232,240,0.88)" },
  value: { marginTop: 10, fontSize: 26, fontWeight: 1000, color: "#f8fafc" },
};
