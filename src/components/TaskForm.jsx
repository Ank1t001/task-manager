import { useState } from "react";

export default function TaskForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    title: "",
    owner: "Ankit",
    priority: "Medium",
    dueDate: "",
    status: "Open",
    externalStakeholders: "",
  });

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;

    onSubmit?.({
      ...form,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <form className="taskForm" onSubmit={handleSubmit}>
      {/* TITLE */}
      <div className="formGroup">
        <label>Task Name</label>
        <input
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Enter task name"
          autoFocus
        />
      </div>

      {/* GRID */}
      <div className="formGrid">
        <div className="formGroup">
          <label>Owner</label>
          <select
            value={form.owner}
            onChange={(e) => update("owner", e.target.value)}
          >
            <option>Ankit</option>
            <option>Team</option>
          </select>
        </div>

        <div className="formGroup">
          <label>Priority</label>
          <select
            value={form.priority}
            onChange={(e) => update("priority", e.target.value)}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>

        <div className="formGroup">
          <label>Status</label>
          <select
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option>Open</option>
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
      </div>

      {/* EXTERNAL */}
      <div className="formGroup">
        <label>External Stakeholders</label>
        <input
          value={form.externalStakeholders}
          onChange={(e) =>
            update("externalStakeholders", e.target.value)
          }
          placeholder="Vendor, agency, partner"
        />
      </div>

      {/* ACTIONS */}
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
