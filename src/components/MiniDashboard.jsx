import { useEffect, useMemo, useRef } from "react";

export default function MiniDashboard({ tasks = [] }) {
  const now = new Date();

  const counts = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => String(t.status).toLowerCase() === "done").length;
    const inProgress = tasks.filter((t) => String(t.status).toLowerCase() === "in progress").length;
    const overdue = tasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d < now && String(t.status).toLowerCase() !== "done";
    }).length;
    return { total, done, inProgress, overdue };
  }, [tasks]);

  const items = useMemo(
    () => [
      { key: "total", label: "Total Tasks", value: counts.total, icon: "📌", accent: "blue" },
      { key: "overdue", label: "Overdue", value: counts.overdue, icon: "🔴", accent: "red" },
      { key: "inProgress", label: "In Progress", value: counts.inProgress, icon: "⏳", accent: "amber" },
      { key: "done", label: "Done", value: counts.done, icon: "✅", accent: "green" },
    ],
    [counts]
  );

  const prevRef = useRef({});
  const cardRefs = useRef({});

  useEffect(() => {
    for (const it of items) {
      const prev = prevRef.current[it.key];
      if (prev !== undefined && prev !== it.value) {
        const el = cardRefs.current[it.key];
        el?.animate?.(
          [
            { transform: "scale(1)", filter: "brightness(1)" },
            { transform: "scale(1.025)", filter: "brightness(1.08)" },
            { transform: "scale(1)", filter: "brightness(1)" },
          ],
          { duration: 320, easing: "ease-out" }
        );
      }
      prevRef.current[it.key] = it.value;
    }
  }, [items]);

  const ACCENT = {
    blue:  { border: "rgba(77,124,255,0.50)",  glow: "rgba(77,124,255,0.18)",  text: "#4d7cff" },
    red:   { border: "rgba(239,68,68,0.50)",   glow: "rgba(239,68,68,0.16)",   text: "#f87171" },
    amber: { border: "rgba(245,158,11,0.50)",  glow: "rgba(245,158,11,0.16)",  text: "#fbbf24" },
    green: { border: "rgba(34,197,94,0.50)",   glow: "rgba(34,197,94,0.16)",   text: "#4ade80" },
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
      {items.map((it) => {
        const a = ACCENT[it.accent];
        return (
          <div
            key={it.key}
            ref={(n) => (cardRefs.current[it.key] = n)}
            className="dtt-card"
            style={{
              padding: 18,
              border: `1px solid ${a.border}`,
              backgroundImage: `radial-gradient(480px 160px at 0% 0%, ${a.glow}, transparent 65%)`,
              minHeight: 96,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>{it.icon}</span>
              <span style={{ fontWeight: 800, fontSize: 13, color: "var(--muted)", letterSpacing: 0.2 }}>
                {it.label}
              </span>
            </div>
            <div style={{ fontWeight: 900, fontSize: 32, lineHeight: 1, color: "var(--text)" }}>
              {it.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}