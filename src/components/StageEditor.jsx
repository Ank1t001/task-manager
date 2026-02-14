// src/components/StageEditor.jsx
import { useEffect, useState } from "react";

export default function StageEditor({ open, projectName, initialStages = [], onClose, onSaved }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;

    setErr("");
    setSaving(false);

    const init = (initialStages || []).map((s) => ({
      stageName: String(s.stageName || s || "").trim(),
      stageOwnerEmail: String(s.stageOwnerEmail || "").trim().toLowerCase(),
    }));

    setRows(init.length ? init : [{ stageName: "", stageOwnerEmail: "" }]);
  }, [open, initialStages]);

  function updateRow(i, key, val) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, [key]: val } : x)));
  }

  function addRow() {
    setRows((r) => [...r, { stageName: "", stageOwnerEmail: "" }]);
  }

  function removeRow(i) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function save() {
    const clean = [];
    const seen = new Set();

    for (const r of rows) {
      const name = String(r.stageName || "").trim();
      const owner = String(r.stageOwnerEmail || "").trim().toLowerCase();
      if (!name) continue;
      const k = name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      clean.push({ stageName: name, stageOwnerEmail: owner });
    }

    if (!projectName?.trim()) return;
    if (clean.length === 0) {
      setErr("Please add at least one stage.");
      return;
    }

    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, stages: clean }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Save failed (${res.status}) ${t}`);
      }
      onSaved?.(clean);
      onClose?.();
    } catch (e) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 1000, fontSize: 16 }}>Edit stages for {projectName}</div>
      <div className="dtt-muted">Stage owner can see all tasks in that stage (even if not assigned).</div>

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1.4fr auto",
              gap: 10,
              alignItems: "center",
            }}
          >
            <input
              className="dtt-input"
              value={r.stageName}
              onChange={(e) => updateRow(i, "stageName", e.target.value)}
              placeholder="Stage name (e.g., Creative)"
            />
            <input
              className="dtt-input"
              value={r.stageOwnerEmail}
              onChange={(e) => updateRow(i, "stageOwnerEmail", e.target.value)}
              placeholder="Stage owner email (optional)"
            />
            <button className="dtt-btn" type="button" onClick={() => removeRow(i)} disabled={rows.length <= 1}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <button className="dtt-btn" type="button" onClick={addRow}>
        + Add stage
      </button>

      {err ? <div className="dtt-muted" style={{ color: "crimson" }}>{err}</div> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button className="dtt-btn" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="dtt-btnPrimary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Stages"}
        </button>
      </div>
    </div>
  );
}