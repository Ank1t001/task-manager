import { useEffect, useMemo, useState } from "react";
import { OWNER_OPTIONS } from "../config/owners";
import { SECTION_OPTIONS } from "../config/sections";

const STATUS_OPTIONS = ["To Do", "In Progress", "Done"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High"];

export default function TaskForm({ onSubmit, onCancel, initialTask = null, mode = "create" }) {
  const isEdit = mode === "edit";

  const defaultForm = useMemo(
    () => ({
      taskName: "",
      description: "",
      owner: "Ankit",
      section: "Other", // UI label: Type
      priority: "Medium",
      dueDate: "",
      status: "To Do",
      externalStakeholders: "",
    }),
    []
  );

  const [form, setForm] = useState(defaultForm);

  // ✅ Prefill when editing
  useEffect(() => {
    if (!initialTask) {
      setForm(defaultForm);
      return;
    }

    setForm({
      taskName: initialTask.taskName || "",
      description: initialTask.description || "",
      owner: initialTask.owner || "Ankit",
      section: initialTask.section || "Other",
      priority: initialTask.priority || "Medium",
      dueDate: initialTask.dueDate || "",
      status: initialTask.status || "To Do",
      externalStakeholders: initialTask.externalStakeholders || "",
    });
  }, [initialTask, defaultForm]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.taskName.trim()) return;

    // return form values only; App.jsx will merge id/sortOrder/etc if editing
    onSubmit?.(form);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
      {/* Task Name */}
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

      {/* Task Description */}
      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ fontWeight: 900 }}>Task Description</label>
        <textarea
          className="dtt-input"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Add details, context, links, notes…"
          rows={3}
          style={{ resize: "vertical" }}
        />
      </div>

      {/* Row: Owner / Type / Priority / Status */}
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
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Status</label>
          <select
            className="dtt-select"
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row: Due Date / External Stakeholders */}
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

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
        <button type="button" className="dtt-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="dtt-btnPrimary">
          {isEdit ? "Save Changes" : "Create Task"}
        </button>
      </div>
    </form>
  );
}