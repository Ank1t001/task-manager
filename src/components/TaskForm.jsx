import { useMemo, useState } from "react";
import { OWNER_OPTIONS } from "../config/owners";
import { SECTION_OPTIONS } from "../config/sections";

const PRIORITY_OPTIONS = ["Low", "Medium", "High"];
const STATUS_OPTIONS = ["To Do", "In Progress", "Blocked", "Done"];

function normalizeSubtasks(initialTask) {
  const st = initialTask?.subtasks;
  if (!Array.isArray(st)) return [];
  return st
    .filter((x) => x && typeof x.title === "string")
    .map((x) => ({ id: x.id || crypto.randomUUID(), title: x.title, done: Boolean(x.done) }));
}

export default function TaskForm({ initialTask, onSubmit, onCancel, canEdit, isAdmin }) {
  const [taskName, setTaskName] = useState(initialTask?.taskName || "");
  const [owner, setOwner] = useState(initialTask?.owner || "");
  const [priority, setPriority] = useState(initialTask?.priority || "Medium");
  const [dueDate, setDueDate] = useState(initialTask?.dueDate || "");
  const [status, setStatus] = useState(initialTask?.status || "To Do");
  const [externalStakeholders, setExternalStakeholders] = useState(
    initialTask?.externalStakeholders || ""
  );
  const [error, setError] = useState("");

  // Section logic: fixed list + custom when "Other"
  const initialSection = SECTION_OPTIONS.includes(initialTask?.section)
    ? initialTask.section
    : "Other";

  const [section, setSection] = useState(initialSection);
  const [customSection, setCustomSection] = useState(
    initialSection === "Other" ? initialTask?.section || "" : ""
  );

  // Subtasks
  const [subtasks, setSubtasks] = useState(() => normalizeSubtasks(initialTask));

  const isEditing = useMemo(() => Boolean(initialTask?.id), [initialTask]);

  function addSubtask() {
    setSubtasks((prev) => [...prev, { id: crypto.randomUUID(), title: "", done: false }]);
  }
  function updateSubtask(id, patch) {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removeSubtask(id) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!taskName.trim()) return setError("Task Name is required.");
    if (!owner) return setError("Owner is required.");
    if (!dueDate) return setError("Due date is required.");
    if (section === "Other" && !customSection.trim()) {
      return setError("Please type a custom section name (or choose a section).");
    }

    const finalSection = section === "Other" ? customSection.trim() || "Other" : section;

    const cleanedSubtasks = subtasks
      .map((s) => ({ ...s, title: (s.title || "").trim() }))
      .filter((s) => s.title.length > 0);

    onSubmit({
      id: initialTask?.id,
      taskName: taskName.trim(),
      owner,
      section: finalSection,
      priority,
      dueDate,
      status,
      externalStakeholders: externalStakeholders.trim(),
      subtasks: cleanedSubtasks,
      createdAt: initialTask?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
      {!canEdit && (
        <div style={styles.alertInfo}>
          View-only mode. Log in (Access) to edit your tasks.
        </div>
      )}

      {error && (
        <div style={styles.alertWarn}>
          <strong>Fix:</strong> {error}
        </div>
      )}

      <label style={styles.label}>
        Task Name
        <input style={styles.input} value={taskName} onChange={(e) => setTaskName(e.target.value)} disabled={!canEdit} />
      </label>

      <label style={styles.label}>
        Owner
        <select style={styles.input} value={owner} onChange={(e) => setOwner(e.target.value)} disabled={!canEdit || (!isAdmin && isEditing)}>
          <option value="">Select owner</option>
          {OWNER_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>

      <label style={styles.label}>
        Section
        <select style={styles.input} value={section} onChange={(e) => setSection(e.target.value)} disabled={!canEdit}>
          {SECTION_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      {section === "Other" && (
        <label style={styles.label}>
          Specify Section
          <input style={styles.input} value={customSection} onChange={(e) => setCustomSection(e.target.value)} disabled={!canEdit} />
        </label>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={styles.label}>
          Priority
          <select style={styles.input} value={priority} onChange={(e) => setPriority(e.target.value)} disabled={!canEdit}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Due date
          <input style={styles.input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!canEdit} />
        </label>
      </div>

      <label style={styles.label}>
        Status
        <select style={styles.input} value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canEdit}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <label style={styles.label}>
        External Stakeholders
        <input style={styles.input} value={externalStakeholders} onChange={(e) => setExternalStakeholders(e.target.value)} disabled={!canEdit} />
      </label>

      <div style={styles.subtasksCard}>
        <div style={styles.subtasksHeader}>
          <div style={{ fontWeight: 900 }}>Task Breakdown (Sub-tasks)</div>
          <button type="button" onClick={addSubtask} style={styles.smallBtn} disabled={!canEdit}>
            + Add sub-task
          </button>
        </div>

        {subtasks.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>No sub-tasks yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {subtasks.map((s, idx) => (
              <div key={s.id} style={styles.subtaskRow}>
                <input type="checkbox" checked={s.done} onChange={(e) => updateSubtask(s.id, { done: e.target.checked })} disabled={!canEdit} />
                <input
                  style={{ ...styles.input, margin: 0 }}
                  value={s.title}
                  onChange={(e) => updateSubtask(s.id, { title: e.target.value })}
                  placeholder={`Sub-task ${idx + 1}`}
                  disabled={!canEdit}
                />
                <button type="button" onClick={() => removeSubtask(s.id)} style={styles.dangerBtn} disabled={!canEdit}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={styles.primaryBtn} disabled={!canEdit}>
          {isEditing ? "Update Task" : "Add Task"}
        </button>
        {isEditing && (
          <button type="button" onClick={onCancel} style={styles.secondaryBtn}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

const styles = {
  label: { display: "grid", gap: 6, fontSize: 13, color: "#1f2937" },
  input: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", outline: "none", background: "white" },
  primaryBtn: { padding: "10px 12px", borderRadius: 10, border: "1px solid #111827", background: "#111827", color: "white", cursor: "pointer", fontWeight: 800 },
  secondaryBtn: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: "pointer", fontWeight: 800 },
  alertWarn: { background: "#fff7ed", border: "1px solid #fed7aa", padding: 10, borderRadius: 10, color: "#7c2d12" },
  alertInfo: { background: "#eff6ff", border: "1px solid #bfdbfe", padding: 10, borderRadius: 10, color: "#1d4ed8", fontWeight: 700 },
  subtasksCard: { border: "1px solid #e5e7eb", background: "#f9fafb", borderRadius: 14, padding: 12 },
  subtasksHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, color: "#111827" },
  subtaskRow: { display: "grid", gridTemplateColumns: "18px 1fr 34px", gap: 8, alignItems: "center" },
  smallBtn: { padding: "8px 10px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: "pointer", fontWeight: 800 },
  dangerBtn: { width: 34, height: 34, borderRadius: 10, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", cursor: "pointer", fontWeight: 900 },
};
