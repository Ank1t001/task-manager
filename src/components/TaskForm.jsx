// src/components/TaskForm.jsx
import { useEffect, useMemo, useState } from "react";
import { OWNER_OPTIONS } from "../config/owners";
import { SECTION_OPTIONS } from "../config/sections";

const STATUS_OPTIONS = ["To Do", "In Progress", "Done"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High"];

// ✅ FIXED STAGES ONLY (always)
const FIXED_STAGE_OPTIONS = [
  "Brief/Kickoff",
  "Research/Strategy",
  "Creative/Concept",
  "Production",
  "Internal Review",
  "Compliance Review",
  "Revisions",
  "Approval",
  "Launch/Execution",
];

export default function TaskForm({ onSubmit, onCancel, initialTask = null, mode = "create" }) {
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
      projectName: "",
      stage: "",
    }),
    []
  );

  const [form, setForm] = useState(defaultForm);

  // Projects dropdown
  const [projects, setProjects] = useState([]); // [{name, ...}]

  // Prefill
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
      projectName: initialTask.projectName || "",
      stage: initialTask.stage || "",
    });
  }, [initialTask, defaultForm]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // ✅ Load projects for dropdown (only)
  useEffect(() => {
    let alive = true;
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects?archived=0", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setProjects(Array.isArray(data?.projects) ? data.projects : []);
      } catch {
        // ignore
      }
    }
    loadProjects();
    return () => (alive = false);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();

    if (!form.projectName?.trim()) return alert("Please select a project.");
    if (!form.stage?.trim()) return alert("Please select a stage.");
    if (!form.taskName.trim()) return alert("Task Name is required.");

    onSubmit?.({
      ...form,
      projectName: form.projectName.trim(),
      stage: form.stage.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
      {/* Project + Stage */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Project Name</label>

          <select
            className="dtt-select"
            value={form.projectName}
            onChange={(e) => {
              update("projectName", e.target.value);
              update("stage", ""); // reset stage when project changes
            }}
          >
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Stage</label>

          <select
            className="dtt-select"
            value={form.stage}
            onChange={(e) => update("stage", e.target.value)}
            disabled={!form.projectName}
          >
            <option value="">{!form.projectName ? "Select project first" : "Select stage"}</option>

            {FIXED_STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

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

      {/* Owner / Type / Priority / Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Owner</label>
          <select className="dtt-select" value={form.owner} onChange={(e) => update("owner", e.target.value)}>
            {(OWNER_OPTIONS || ["Ankit"]).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Type</label>
          <select className="dtt-select" value={form.section} onChange={(e) => update("section", e.target.value)}>
            {(SECTION_OPTIONS || ["Other"]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Priority</label>
          <select className="dtt-select" value={form.priority} onChange={(e) => update("priority", e.target.value)}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Status</label>
          <select className="dtt-select" value={form.status} onChange={(e) => update("status", e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Due Date / Stakeholders */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Due Date</label>
          <input className="dtt-input" type="date" value={form.dueDate} onChange={(e) => update("dueDate", e.target.value)} />
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

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
        <button type="button" className="dtt-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="dtt-btnPrimary">
          {mode === "edit" ? "Save Changes" : "Create Task"}
        </button>
      </div>
    </form>
  );
}