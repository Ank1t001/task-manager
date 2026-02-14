import { useEffect, useMemo, useRef } from "react";

export default function MiniDashboard({ title, counts, theme = "light" }) {
  const dark = theme === "dark";
  const s = styles(dark);

  const items = useMemo(
    () => [
      { key: "total", label: "Total Tasks", value: counts?.total ?? 0, emoji: "📌", accent: "blue" },
      { key: "overdue", label: "Overdue", value: counts?.overdue ?? 0, emoji: "🔴", accent: "red" },
      { key: "inProgress", label: "In Progress", value: counts?.inProgress ?? 0, emoji: "⏳", accent: "amber" },
      { key: "done", label: "Done", value: counts?.done ?? 0, emoji: "✅", accent: "green" },
    ],
    [counts]
  );

  const prevRef = useRef({});
  const cardRefs = useRef({});

  useEffect(() => {
    for (const it of items) {
      const prev = prevRef.current[it.key];
      const next = it.value;

      if (prev !== undefined && prev !== next) {
        const el = cardRefs.current[it.key];
        if (el?.animate) {
          el.animate(
            [
              { transform: "scale(1)", filter: "brightness(1)" },
              { transform: "scale(1.02)", filter: "brightness(1.05)" },
              { transform: "scale(1)", filter: "brightness(1)" },
            ],
            { duration: 320, easing: "ease-out" }
          );
        }
      }
      prevRef.current[it.key] = next;
    }
  }, [items]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {title ? <div style={{ fontWeight: 950, fontSize: 16, marginLeft: 2 }}>{title}</div> : null}

      <div style={s.grid}>
        {items.map((it) => (
          <div
            key={it.key}
            ref={(node) => (cardRefs.current[it.key] = node)}
            style={{ ...s.card, ...accentCard(dark, it.accent) }}
          >
            <div style={s.top}>
              <span style={s.icon}>{it.emoji}</span>
              <span style={s.label}>{it.label}</span>
            </div>
            <div style={s.value}>{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function styles(dark) {
  return {
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: 14,
    },
    card: {
      borderRadius: 18,
      padding: 16,
      minHeight: 98,
      position: "relative",
      overflow: "hidden",
      background: dark
        ? "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))"
        : "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.92))",
      boxShadow: dark ? "0 12px 24px rgba(0,0,0,0.28)" : "0 14px 26px rgba(15,23,42,0.12)",
    },
    top: { display: "flex", alignItems: "center", gap: 10 },
    icon: { fontSize: 18 },
    label: {
      fontWeight: 950,
      fontSize: 14,
      color: dark ? "rgba(255,255,255,0.88)" : "rgba(15,23,42,0.82)",
      letterSpacing: 0.2,
    },
    value: {
      marginTop: 12,
      fontSize: 30,
      fontWeight: 1000,
      color: dark ? "#FFFFFF" : "#0f172a",
    },
  };
}

function accentCard(dark, accent) {
  const glow = {
    blue: dark ? "rgba(99,102,241,0.20)" : "rgba(99,102,241,0.18)",
    red: dark ? "rgba(239,68,68,0.22)" : "rgba(239,68,68,0.18)",
    amber: dark ? "rgba(245,158,11,0.22)" : "rgba(245,158,11,0.18)",
    green: dark ? "rgba(34,197,94,0.22)" : "rgba(34,197,94,0.18)",
  }[accent];

  const border = {
    blue: "rgba(99,102,241,0.55)",
    red: "rgba(239,68,68,0.55)",
    amber: "rgba(245,158,11,0.55)",
    green: "rgba(34,197,94,0.55)",
  }[accent];

  return {
    border: `1px solid ${border}`,
    backgroundImage: dark
      ? `radial-gradient(520px 190px at 15% 0%, ${glow} 0%, transparent 60%),
         linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))`
      : `radial-gradient(560px 200px at 15% 0%, ${glow} 0%, transparent 62%),
         linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.92))`,
  };
}