// src/components/TaskForm.jsx
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
      section: "Other", // UI label: Type (existing)
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

  // project suggestions + stages
  const [projectSuggestions, setProjectSuggestions] = useState([]);
  const [stageOptions, setStageOptions] = useState([]);
  const [loadingStages, setLoadingStages] = useState(false);

  // Prefill on edit
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

  // Load project suggestions
  useEffect(() => {
    let alive = true;
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setProjectSuggestions(Array.isArray(data?.projects) ? data.projects : []);
      } catch {
        // ignore
      }
    }
    loadProjects();
    return () => (alive = false);
  }, []);

  // Load stages when projectName changes
  useEffect(() => {
    let alive = true;

    async function loadStages(projectName) {
      if (!projectName?.trim()) {
        setStageOptions([]);
        return;
      }
      setLoadingStages(true);
      try {
        const res = await fetch(`/api/stages?projectName=${encodeURIComponent(projectName.trim())}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setStageOptions([]);
          return;
        }
        const data = await res.json();
        if (!alive) return;
        const list = Array.isArray(data?.stages) ? data.stages : [];
        setStageOptions(list.map((x) => x.stageName).filter(Boolean));
      } finally {
        if (!alive) return;
        setLoadingStages(false);
      }
    }

    loadStages(form.projectName);
    return () => (alive = false);
  }, [form.projectName]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.taskName.trim()) return;

    onSubmit?.({
      ...form,
      projectName: form.projectName.trim(),
      stage: form.stage.trim(),
    });
  }

  const stageHasOptions = stageOptions.length > 0;

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
      {/* Project + Stage */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Project Name</label>
          <input
            className="dtt-input"
            value={form.projectName}
            onChange={(e) => update("projectName", e.target.value)}
            placeholder="e.g., EMIFT"
            list="projectSuggestions"
          />
          <datalist id="projectSuggestions">
            {projectSuggestions.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Stage</label>

          {stageHasOptions ? (
            <select
              className="dtt-select"
              value={form.stage}
              onChange={(e) => update("stage", e.target.value)}
              disabled={loadingStages}
            >
              <option value="">{loadingStages ? "Loading stages…" : "Select stage"}</option>
              {stageOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="dtt-input"
              value={form.stage}
              onChange={(e) => update("stage", e.target.value)}
              placeholder={form.projectName ? "No stages found. Type stage name…" : "Select project first"}
              disabled={!form.projectName}
            />
          )}
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

      {/* Row: Owner / Type / Priority / Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Owner</label>
          <select className="dtt-select" value={form.owner} onChange={(e) => update("owner", e.target.value)}>
            {OWNER_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Type</label>
          <select className="dtt-select" value={form.section} onChange={(e) => update("section", e.target.value)}>
            {SECTION_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Priority</label>
          <select className="dtt-select" value={form.priority} onChange={(e) => update("priority", e.target.value)}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Status</label>
          <select className="dtt-select" value={form.status} onChange={(e) => update("status", e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row: Due Date / External Stakeholders */}
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