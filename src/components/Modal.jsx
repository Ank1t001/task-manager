import { useEffect } from "react";

export default function Modal({
  open = true,
  onClose,
  title,
  subtitle,
  children,
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);

    // lock background scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="dtt-modalBackdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        // close when clicking backdrop
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="dtt-modalPanel">
        <div className="dtt-modalHeader">
          <div>
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="dtt-iconBtn" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="dtt-modalBody">{children}</div>
      </div>
    </div>
  );
}
