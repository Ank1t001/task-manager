import { useState } from "react";
import { OWNER_OPTIONS } from "../owners"; // ✅ uses your existing owner list

export default function TaskForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    taskName: "",
    owner: "Ankit",
    section: "Other",
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

    onSubmit?.({
      ...form,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <form className="taskForm" onSubmit={handleSubmit}>
      <div className="formGroup">
        <label>Task Name</label>
        <input
          value={form.taskName}
          onChange={(e) => update("taskName", e.target.value)}
          placeholder="Enter task name"
          autoFocus
        />
      </div>

      <div className="formGrid">
        <div className="formGroup">
          <label>Owner</label>
          <select value={form.owner} onChange={(e) => update("owner", e.target.value)}>
            {OWNER_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div className="formGroup">
          <label>Priority</label>
          <select value={form.priority} onChange={(e) => update("priority", e.target.value)}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>

        <div className="formGroup">
          <label>Status</label>
          <select value={form.status} onChange={(e) => update("status", e.target.value)}>
            <option>To Do</option>
            <option>In Progress</option>
            <option>Blocked</option>
            <option>Done</option>
          </select>
        </div>

        <div className="formGroup">
          <label>Due Date</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => update("dueDate", e.target.value)}
          />
        </div>

        <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
          <label>Section</label>
          <input
            value={form.section}
            onChange={(e) => update("section", e.target.value)}
            placeholder="Ads / Creative / Compliance Review / etc."
          />
        </div>
      </div>

      <div className="formGroup">
        <label>External Stakeholders</label>
        <input
          value={form.externalStakeholders}
          onChange={(e) => update("externalStakeholders", e.target.value)}
          placeholder="Vendor, agency, partner"
        />
      </div>

      <div className="formActions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary">
          Create Task
        </button>
      </div>
    </form>
  );
}