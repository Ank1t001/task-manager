import React, { useEffect } from "react";

export default function Modal({ open, title, subtitle, onClose, children, footer }) {
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
    <div style={styles.backdrop} onMouseDown={onClose}>
      <div style={styles.sheet} onMouseDown={(e) => e.stopPropagation()}>
        {/* Brand header bar */}
        <div style={styles.brandBar}>
          <div style={styles.brandDot} />
          <div style={{ display: "grid", gap: 2 }}>
            <div style={styles.brandTitle}>Digital Team Task Tracker</div>
            <div style={styles.brandSub}>Internal tool • Navy & Gold theme</div>
          </div>

          <button style={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={styles.header}>
          <div>
            <div style={styles.title}>{title}</div>
            {subtitle ? <div style={styles.sub}>{subtitle}</div> : null}
          </div>
        </div>

        <div style={styles.body}>{children}</div>

        {footer ? <div style={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}

const NAVY_900 = "#071321";
const NAVY_800 = "#0B1E33";
const NAVY_700 = "#102A46";
const GOLD = "#D4AF37";

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background:
      "radial-gradient(900px 600px at 20% 0%, rgba(59,130,246,0.18) 0%, transparent 60%), rgba(2,6,23,0.72)",
    display: "grid",
    placeItems: "center",
    padding: 16,
    zIndex: 50,
  },

  sheet: {
    width: "min(760px, 100%)",
    maxHeight: "86vh",
    overflow: "auto",
    borderRadius: 18,
    border: "1px solid rgba(212,175,55,0.22)",
    background:
      "linear-gradient(180deg, rgba(11,30,51,0.96), rgba(7,19,33,0.96))",
    boxShadow: "0 26px 70px rgba(0,0,0,0.45)",
  },

  brandBar: {
    padding: 14,
    borderBottom: "1px solid rgba(212,175,55,0.18)",
    background:
      "linear-gradient(90deg, rgba(16,42,70,0.95), rgba(7,19,33,0.95))",
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

  brandTitle: { color: "#F8FAFC", fontWeight: 950, letterSpacing: 0.2 },
  brandSub: { color: "rgba(226,232,240,0.70)", fontSize: 12 },

  close: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    cursor: "pointer",
    padding: "8px 10px",
    fontWeight: 900,
    color: "#EAF0FF",
  },

  header: {
    padding: 16,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(11,30,51,0.55), rgba(7,19,33,0))",
  },

  title: { fontSize: 16, fontWeight: 950, color: "#F8FAFC" },
  sub: { marginTop: 6, fontSize: 12, color: "rgba(226,232,240,0.75)" },

  body: { padding: 16 },
  footer: {
    padding: 16,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    background:
      "linear-gradient(0deg, rgba(11,30,51,0.40), rgba(7,19,33,0))",
  },
};
