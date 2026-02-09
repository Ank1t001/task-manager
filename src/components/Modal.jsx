import { useEffect } from "react";

export default function Modal({ open, onClose, title, subtitle, children, footer }) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="dtt-modalBackdrop" role="dialog" aria-modal="true">
      <div className="dtt-modalOverlay" onClick={onClose} />
      <div className="dtt-modalCard">
        <div className="dtt-modalHeader">
          <div>
            {title ? <div className="dtt-modalTitle">{title}</div> : null}
            {subtitle ? <div className="dtt-modalSubtitle">{subtitle}</div> : null}
          </div>
          <button className="dtt-iconBtn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="dtt-modalBody">{children}</div>

        {footer ? <div className="dtt-modalFooter">{footer}</div> : null}
      </div>
    </div>
  );
}