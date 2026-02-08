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
        <div style={styles.header}>
          <div>
            <div style={styles.title}>{title}</div>
            {subtitle ? <div style={styles.sub}>{subtitle}</div> : null}
          </div>
          <button style={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={styles.body}>{children}</div>

        {footer ? <div style={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.65)",
    display: "grid",
    placeItems: "center",
    padding: 16,
    zIndex: 50,
  },
  sheet: {
    width: "min(720px, 100%)",
    maxHeight: "85vh",
    overflow: "auto",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 22px 60px rgba(0,0,0,0.35)",
  },
  header: {
    padding: 16,
    borderBottom: "1px solid rgba(15,23,42,0.12)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: 12,
  },
  title: { fontSize: 16, fontWeight: 950, color: "#0f172a" },
  sub: { marginTop: 6, fontSize: 12, color: "rgba(15,23,42,0.70)" },
  close: {
    borderRadius: 10,
    border: "1px solid rgba(15,23,42,0.15)",
    background: "rgba(255,255,255,0.9)",
    cursor: "pointer",
    padding: "8px 10px",
    fontWeight: 900,
    color: "#0f172a",
  },
  body: { padding: 16 },
  footer: {
    padding: 16,
    borderTop: "1px solid rgba(15,23,42,0.12)",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
};
