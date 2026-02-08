import { useState } from "react";

const OWNER_OPTIONS = ["Ankit", "Team Member 1", "Team Member 2"]; // set your fixed owners
const PRIORITY_OPTIONS = ["Low", "Medium", "High"];
const STATUS_OPTIONS = ["To Do", "In Progress", "Blocked", "Done"];

export default function TaskForm({ initialTask, onSubmit, onCancel }) {
  const [taskName, setTaskName] = useState(initialTask?.taskName || "");
  const [owner, setOwner] = useState(initialTask?.owner || "");
  const [priority, setPriority] = useState(initialTask?.priority || "Medium");
  const [dueDate, setDueDate] = useState(initialTask?.dueDate || "");
  const [status, setStatus] = useState(initialTask?.status || "To Do");
  const [externalStakeholders, setExternalStakeholders] = useState(initialTask?.externalStakeholders || "");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!taskName.trim()) return setError("Task Name is required.");
    if (!owner) return setError("Owner is required.");
    if (!dueDate) return setError("Due date is required.");

    onSubmit({
      id: initialTask?.id,
      taskName: taskName.trim(),
      owner,
      priority,
      dueDate,
      status,
      externalStakeholders: externalStakeholders.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
      {error && (
        <div style={{ background: "#ffe8e8", border: "1px solid #ffb3b3", padding: 10, borderRadius: 8 }}>
          {error}
        </div>
      )}

      <label>
        Task Name
        <input value={taskName} onChange={(e) => setTaskName(e.target.value)} style={{ width: "100%", padding: 8 }} />
      </label>

      <label>
        Owner
        <select value={owner} onChange={(e) => setOwner(e.target.value)} style={{ width: "100%", padding: 8 }}>
          <option value="">Select owner</option>
          {OWNER_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>

      <label>
        Priority
        <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ width: "100%", padding: 8 }}>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>

      <label>
        Due date
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: "100%", padding: 8 }} />
      </label>

      <label>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%", padding: 8 }}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <label>
        External Stakeholders
        <input
          value={externalStakeholders}
          onChange={(e) => setExternalStakeholders(e.target.value)}
          placeholder="e.g., Mads (Compliance), Lawyer"
          style={{ width: "100%", padding: 8 }}
        />
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={{ padding: "10px 12px", cursor: "pointer" }}>
          {initialTask ? "Update Task" : "Add Task"}
        </button>
        {initialTask && (
          <button type="button" onClick={onCancel} style={{ padding: "10px 12px", cursor: "pointer" }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
