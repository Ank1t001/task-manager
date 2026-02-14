// src/components/StageEditor.jsx
import { useEffect, useState } from "react";

export default function StageEditor({ open, projectName, initialStages = [], onClose, onSaved }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    setSaving(false);
    setText((initialStages || []).join("\n"));
  }, [open, initialStages]);

  async function save() {
    const stages = text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!projectName?.trim()) return;

    if (stages.length === 0) {
      setErr("Please add at least one stage.");
      return;
    }

    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, stages }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Save failed (${res.status}) ${t}`);
      }
      onSaved?.(stages);
      onClose?.();
    } catch (e) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 1000, fontSize: 16 }}>Edit stages for {projectName}</div>
      <div className="dtt-muted">One stage per line. Order here becomes the stage order.</div>

      <textarea
        className="dtt-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        style={{ resize: "vertical" }}
        placeholder={`Ads Campaigns\nCopy\nCreative\nLanding Page\nCompliance`}
      />

      {err ? <div className="dtt-muted" style={{ color: "crimson" }}>{err}</div> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button className="dtt-btn" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="dtt-btnPrimary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Stages"}
        </button>
      </div>
    </div>
  );
}