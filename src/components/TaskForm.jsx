import { useState } from "react";
import { OWNER_OPTIONS } from "../config/owners";
import { SECTION_OPTIONS } from "../config/sections";

export default function TaskForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    taskName: "",
    owner: OWNER_OPTIONS?.[0] || "Ankit",
    section: SECTION_OPTIONS?.[0] || "Other", // stored key stays "section" for compatibility
    priority: "Medium",
    dueDate: "",
    status: "To Do",
    externalStakeholders: "",
  });

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.taskName.trim()) return;
    onSubmit?.(form);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ fontWeight: 900 }}>Task Name</label>
        <input
          className="dtt-input"
          value={form.taskName}
          onChange={(e) => update("taskName", e.target.value)}
          placeholder="Enter task name"
          autoFocus
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Owner</label>
          <select
            className="dtt-select"
            value={form.owner}
            onChange={(e) => update("owner", e.target.value)}
          >
            {OWNER_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Type</label>
          <select
            className="dtt-select"
            value={form.section}
            onChange={(e) => update("section", e.target.value)}
          >
            {SECTION_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Priority</label>
          <select
            className="dtt-select"
            value={form.priority}
            onChange={(e) => update("priority", e.target.value)}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Status</label>
          <select
            className="dtt-select"
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option>To Do</option>
            <option>In Progress</option>
            <option>Blocked</option>
            <option>Done</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Due Date</label>
          <input
            className="dtt-input"
            type="date"
            value={form.dueDate}
            onChange={(e) => update("dueDate", e.target.value)}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>External Stakeholders</label>
          <input
            className="dtt-input"
            value={form.externalStakeholders}
            onChange={(e) => update("externalStakeholders", e.target.value)}
            placeholder="Vendor, agency, partner"
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
        <button type="button" className="dtt-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="dtt-btnPrimary">
          Create Task
        </button>
      </div>
    </form>
  );
}