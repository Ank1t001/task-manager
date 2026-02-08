import { useMemo, useState } from "react";
import { OWNER_OPTIONS } from "../config/owners";
import { SECTION_OPTIONS } from "../config/sections";

const PRIORITY_OPTIONS = ["Low", "Medium", "High"];
const STATUS_OPTIONS = ["To Do", "In Progress", "Blocked", "Done"];

export default function TaskForm({ initialTask, onSubmit, onCancel }) {
  const [taskName, setTaskName] = useState(initialTask?.taskName || "");
  const [owner, setOwner] = useState(initialTask?.owner || "");
  const [priority, setPriority] = useState(initialTask?.priority || "Medium");
  const [dueDate, setDueDate] = useState(initialTask?.dueDate || "");
  const [status, setStatus] = useState(initialTask?.status || "To Do");
  const [externalStakeholders, setExternalStakeholders] = useState(
    initialTask?.externalStakeholders || ""
  );
  const [error, setError] = useState("");

  // Section logic: fixed list + allow custom input when "Other" is selected
  const initialSection = SECTION_OPTIONS.includes(initialTask?.section)
    ? initialTask.section
    : "Other";

  const [section, setSection] = useState(initialSection);
  const [customSection, setCustomSection] = useState(
    initialSection === "Other" ? initialTask?.section || "" : ""
  );

  const isEditing = useMemo(() => Boolean(initialTask?.id), [initialTask]);

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!taskName.trim()) return setError("Task Name is required.");
    if (!owner) return setError("Owner is required.");
    if (!dueDate) return setError("Due date is required.");

    if (section === "Other" && !customSection.trim()) {
      return setError("Please type a custom section name (or choose a section).");
    }

    const finalSection =
      section === "Other" ? customSection.trim() || "Other" : section;

    onSubmit({
      id: initialTask?.id,
      taskName: taskName.trim(),
      owner,
      section: finalSection,
      priority,
      dueDate,
      status,
      externalStakeholders: externalStakeholders.trim(),
      createdAt: initialTask?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
      {error && (
        <div style={styles.alert}>
          <strong>Fix:</strong> {error}
        </div>
      )}

      <label style={styles.label}>
        Task Name
        <input
          style={styles.input}
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
        />
      </label>

      <label style={styles.label}>
        Owner
        <select
          style={styles.input}
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        >
          <option value="">Select owner</option>
          {OWNER_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>

      <label style={styles.label}>
        Section
        <select
          style={styles.input}
          value={section}
          onChange={(e) => setSection(e.target.value)}
        >
          {SECTION_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      {section === "Other" && (
        <label style={styles.label}>
          Specify Section
          <input
            style={styles.input}
            value={customSection}
            onChange={(e) => setCustomSection(e.target.value)}
            placeholder="Type custom section name"
          />
        </label>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={styles.label}>
          Priority
          <select
            style={styles.input}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Due date
          <input
            style={styles.input}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
      </div>

      <label style={styles.label}>
        Status
        <select
          style={styles.input}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label style={styles.label}>
        External Stakeholders
        <input
          style={styles.input}
          value={externalStakeholders}
          onChange={(e) => setExternalStakeholders(e.target.value)}
          placeholder="e.g., Mads (Compliance), Lawyer"
        />
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={styles.primaryBtn}>
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
  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    outline: "none",
    background: "white",
  },
  primaryBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    cursor: "pointer",
    fontWeight: 600,
  },
  secondaryBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "white",
    cursor: "pointer",
    fontWeight: 600,
  },
  alert: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    padding: 10,
    borderRadius: 10,
    color: "#7c2d12",
  },
};
