export default function MiniDashboard({ counts, theme = "dark" }) {
  const dark = theme === "dark";
  const s = styles(dark);

  const items = [
    { key: "overdue", label: "Overdue", value: counts?.overdue ?? 0, emoji: "🔴", accent: "red" },
    { key: "inProgress", label: "In Progress", value: counts?.inProgress ?? 0, emoji: "⏳", accent: "amber" },
    { key: "blocked", label: "Blocked", value: counts?.blocked ?? 0, emoji: "🚫", accent: "orange" },
    { key: "done", label: "Done", value: counts?.done ?? 0, emoji: "✅", accent: "green" },
  ];

  return (
    <div style={s.grid}>
      {items.map((it) => (
        <div key={it.key} style={{ ...s.card, ...sAccent(dark, it.accent) }}>
          <div style={s.top}>
            <span style={s.icon}>{it.emoji}</span>
            <span style={s.label}>{it.label}</span>
          </div>
          <div style={s.value}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function styles(dark) {
  return {
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: 12,
    },
    card: {
      borderRadius: 16,
      padding: 14,
      border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(15,23,42,0.10)",
      background: dark
        ? "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))"
        : "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.92))",
      boxShadow: dark ? "0 10px 24px rgba(0,0,0,0.28)" : "0 12px 24px rgba(15,23,42,0.10)",
      position: "relative",
      overflow: "hidden",
      minHeight: 92,
    },
    top: { display: "flex", alignItems: "center", gap: 10 },
    icon: { fontSize: 18 },
    label: {
      fontWeight: 950,
      fontSize: 13,
      color: dark ? "rgba(226,232,240,0.85)" : "rgba(15,23,42,0.78)",
      letterSpacing: 0.2,
    },
    value: {
      marginTop: 10,
      fontSize: 28,
      fontWeight: 1000,
      color: dark ? "#EAF0FF" : "#0f172a",
    },
  };
}

function sAccent(dark, accent) {
  const glow = {
    red: dark ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.14)",
    amber: dark ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.12)",
    orange: dark ? "rgba(249,115,22,0.18)" : "rgba(249,115,22,0.12)",
    green: dark ? "rgba(34,197,94,0.18)" : "rgba(34,197,94,0.12)",
  }[accent];

  const stroke = {
    red: "rgba(239,68,68,0.35)",
    amber: "rgba(245,158,11,0.35)",
    orange: "rgba(249,115,22,0.35)",
    green: "rgba(34,197,94,0.35)",
  }[accent];

  return {
    boxShadow: dark
      ? `0 10px 24px rgba(0,0,0,0.28), 0 0 0 1px rgba(212,175,55,0.06)`
      : `0 12px 24px rgba(15,23,42,0.10), 0 0 0 1px rgba(99,102,241,0.06)`,
    border: dark ? `1px solid rgba(255,255,255,0.12)` : `1px solid rgba(15,23,42,0.10)`,
    backgroundImage: dark
      ? `radial-gradient(500px 180px at 20% 0%, ${glow} 0%, transparent 55%),
         linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))`
      : `radial-gradient(520px 190px at 20% 0%, ${glow} 0%, transparent 60%),
         linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.92))`,
    outline: `1px solid ${stroke}`,
    outlineOffset: -1,
  };
}
