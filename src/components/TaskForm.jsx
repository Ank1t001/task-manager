import { useMemo, useState } from "react";
import { OWNER_OPTIONS } from "../config/owners";
import { SECTION_OPTIONS } from "../config/sections";

const PRIORITY_OPTIONS = ["Low", "Medium", "High"];
const STATUS_OPTIONS = ["To Do", "In Progress", "Blocked", "Done"];

export default function TaskForm({
  initialTask,
  onSubmit,
  onCancel,
  canEdit = true,
  theme = "dark",
}) {
  const dark = theme === "dark";

  const initialSection = SECTION_OPTIONS.includes(initialTask?.section)
    ? initialTask.section
    : "Other";

  const [taskName, setTaskName] = useState(initialTask?.taskName || "");
  const [owner, setOwner] = useState(initialTask?.owner || "");
  const [section, setSection] = useState(initialSection);
  const [customSection, setCustomSection] = useState(
    initialSection === "Other" ? (initialTask?.section || "") : ""
  );
  const [priority, setPriority] = useState(initialTask?.priority || "Medium");
  const [dueDate, setDueDate] = useState(initialTask?.dueDate || "");
  const [status, setStatus] = useState(initialTask?.status || "To Do");
  const [externalStakeholders, setExternalStakeholders] = useState(
    initialTask?.externalStakeholders || ""
  );
  const [error, setError] = useState("");

  const isEditing = useMemo(() => Boolean(initialTask?.id), [initialTask]);

  const s = styles(dark);

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!taskName.trim()) return setError("Task Name is required.");
    if (!owner) return setError("Owner is required.");
    if (!dueDate) return setError("Due date is required.");

    const finalSection = section === "Other" ? (customSection.trim() || "Other") : section;

    onSubmit({
      id: initialTask?.id,
      taskName: taskName.trim(),
      owner,
      section: finalSection,
      priority,
      dueDate,
      status,
      externalStakeholders: externalStakeholders.trim(),
      subtasks: initialTask?.subtasks || [],
      createdAt: initialTask?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
      {!canEdit && (
        <div style={s.alert}>
          You’re in <strong>view mode</strong>. Login to add tasks.
        </div>
      )}

      {error && (
        <div style={s.alertWarn}>
          <strong>Fix:</strong> {error}
        </div>
      )}

      <label style={s.label}>
        Task Name
        <input
          style={s.input}
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          disabled={!canEdit}
        />
      </label>

      <label style={s.label}>
        Owner
        <select style={s.input} value={owner} onChange={(e) => setOwner(e.target.value)} disabled={!canEdit}>
          <option value="">Select owner</option>
          {OWNER_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={s.label}>
          Section
          <select style={s.input} value={section} onChange={(e) => setSection(e.target.value)} disabled={!canEdit}>
            {SECTION_OPTIONS.map((sec) => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>
        </label>

        <label style={s.label}>
          Specify Section (if Other)
          <input
            style={s.input}
            value={customSection}
            onChange={(e) => setCustomSection(e.target.value)}
            placeholder="Type custom section..."
            disabled={!canEdit || section !== "Other"}
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={s.label}>
          Priority
          <select style={s.input} value={priority} onChange={(e) => setPriority(e.target.value)} disabled={!canEdit}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>

        <label style={s.label}>
          Due date
          <input
            style={s.input}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={!canEdit}
          />
        </label>
      </div>

      <label style={s.label}>
        Status
        <select style={s.input} value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canEdit}>
          {STATUS_OPTIONS.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </label>

      <label style={s.label}>
        External Stakeholders
        <input
          style={s.input}
          value={externalStakeholders}
          onChange={(e) => setExternalStakeholders(e.target.value)}
          placeholder="e.g., Vanessa, Compliance"
          disabled={!canEdit}
        />
      </label>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {onCancel && (
          <button type="button" onClick={onCancel} style={s.secondaryBtn}>
            Cancel
          </button>
        )}
        <button type="submit" style={s.primaryBtn} disabled={!canEdit}>
          {isEditing ? "Update Task" : "Add Task"}
        </button>
      </div>
    </form>
  );
}

function styles(dark) {
  const border = dark ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.14)";
  const bg = dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.95)";
  const text = dark ? "#EAF0FF" : "#0f172a";
  const label = dark ? "rgba(226,232,240,0.80)" : "rgba(15,23,42,0.72)";

  return {
    label: { display: "grid", gap: 6, fontSize: 13, color: label, fontWeight: 800 },
    input: {
      padding: "10px 12px",
      borderRadius: 12,
      border: `1px solid ${border}`,
      outline: "none",
      background: bg,
      color: text,
    },
    primaryBtn: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "none",
      background: "linear-gradient(135deg, rgba(99,102,241,0.95), rgba(168,85,247,0.95))",
      color: "white",
      cursor: "pointer",
      fontWeight: 950,
    },
    secondaryBtn: {
      padding: "10px 14px",
      borderRadius: 12,
      border: `1px solid ${border}`,
      background: bg,
      color: text,
      cursor: "pointer",
      fontWeight: 900,
    },
    alert: {
      background: dark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.10)",
      border: "1px solid rgba(59,130,246,0.25)",
      padding: 10,
      borderRadius: 12,
      color: dark ? "#bfdbfe" : "#1e3a8a",
      fontWeight: 800,
      fontSize: 12,
    },
    alertWarn: {
      background: dark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.12)",
      border: "1px solid rgba(245,158,11,0.25)",
      padding: 10,
      borderRadius: 12,
      color: dark ? "#fde68a" : "#7c2d12",
      fontWeight: 800,
      fontSize: 12,
    },
  };
}
