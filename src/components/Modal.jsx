import React, { useEffect } from "react";

export default function Modal({ open, title, subtitle, onClose, children, footer, theme = "dark" }) {
  const dark = theme === "dark";
  const s = styles(dark);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={s.backdrop} onMouseDown={onClose}>
      <div style={s.sheet} onMouseDown={(e) => e.stopPropagation()}>
        <div style={s.brandBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={s.brandDot} />
            <div style={{ display: "grid", gap: 2 }}>
              <div style={s.brandTitle}>Digital Team Task Tracker</div>
              <div style={s.brandSub}>Internal tool</div>
            </div>
          </div>

          <button style={s.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={s.header}>
          <div style={s.title}>{title}</div>
          {subtitle ? <div style={s.sub}>{subtitle}</div> : null}
        </div>

        <div style={s.body}>{children}</div>

        {footer ? <div style={s.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}

function styles(dark) {
  const NAVY_900 = "#071321";
  const NAVY_800 = "#0B1E33";
  const GOLD = "#D4AF37";

  const text = dark ? "#F8FAFC" : "#0f172a";
  const sub = dark ? "rgba(226,232,240,0.74)" : "rgba(15,23,42,0.62)";

  return {
    backdrop: {
      position: "fixed",
      inset: 0,
      background: dark
        ? "radial-gradient(900px 600px at 20% 0%, rgba(59,130,246,0.18) 0%, transparent 60%), rgba(2,6,23,0.72)"
        : "rgba(15,23,42,0.40)",
      display: "grid",
      placeItems: "center",
      padding: 16,
      zIndex: 50,
    },

    sheet: {
      width: "min(980px, 100%)",
      maxHeight: "88vh",
      overflow: "auto",
      borderRadius: 18,
      border: dark ? "1px solid rgba(212,175,55,0.22)" : "1px solid rgba(15,23,42,0.12)",
      background: dark
        ? `linear-gradient(180deg, rgba(11,30,51,0.96), rgba(7,19,33,0.96))`
        : `linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.90))`,
      boxShadow: dark ? "0 26px 70px rgba(0,0,0,0.45)" : "0 26px 70px rgba(15,23,42,0.18)",
    },

    brandBar: {
      padding: 14,
      borderBottom: dark ? "1px solid rgba(212,175,55,0.18)" : "1px solid rgba(15,23,42,0.10)",
      background: dark
        ? `linear-gradient(90deg, rgba(16,42,70,0.95), rgba(7,19,33,0.95))`
        : `linear-gradient(90deg, rgba(255,255,255,0.96), rgba(245,247,255,0.96))`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },

    brandDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      background: GOLD,
      boxShadow: "0 0 0 4px rgba(212,175,55,0.12)",
    },

    brandTitle: { color: text, fontWeight: 950, letterSpacing: 0.2 },
    brandSub: { color: sub, fontSize: 12 },

    close: {
      borderRadius: 12,
      border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(15,23,42,0.12)",
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)",
      cursor: "pointer",
      padding: "8px 10px",
      fontWeight: 900,
      color: text,
    },

    header: {
      padding: 16,
      borderBottom: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(15,23,42,0.08)",
      background: dark
        ? "linear-gradient(180deg, rgba(11,30,51,0.55), rgba(7,19,33,0))"
        : "linear-gradient(180deg, rgba(245,247,255,0.85), rgba(255,255,255,0))",
    },

    title: { fontSize: 16, fontWeight: 950, color: text },
    sub: { marginTop: 6, fontSize: 12, color: sub },

    body: { padding: 16 },

    footer: {
      padding: 16,
      borderTop: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(15,23,42,0.08)",
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      flexWrap: "wrap",
      background: dark
        ? "linear-gradient(0deg, rgba(11,30,51,0.40), rgba(7,19,33,0))"
        : "linear-gradient(0deg, rgba(245,247,255,0.65), rgba(255,255,255,0))",
    },
  };
}
