// src/components/TaskForm.jsx
import { useEffect, useMemo, useState } from "react";
import { OWNER_OPTIONS } from "../config/owners";
import { SECTION_OPTIONS } from "../config/sections";
import TaskAttachments from "./TaskAttachments";

const STATUS_OPTIONS   = ["To Do", "In Progress", "Done"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High"];

const FIXED_STAGE_OPTIONS = [
  "Brief/Kickoff",
  "Strategy",
  "Creative/Concept",
  "Production",
  "Internal Review",
  "Compliance Review",
  "Revisions (If Any)",
  "Approval",
  "Launch/Execution",
];

// Map owner name → email (extend as needed)
const OWNER_EMAILS = {
  "Ankit":    "ankit@digijabber.com",
  "Sheel":    "sheelp@equiton.com",
  "Jacob":    "jacob@equiton.com",
  "Aditi":    "aditi@equiton.com",
  "Vanessa":  "vanessa@equiton.com",
  "Mandeep":  "mandeep@equiton.com",
};

export default function TaskForm({ onSubmit, onCancel, initialTask = null, mode = "create", getToken }) {
  const isEdit = mode === "edit";

  const defaultForm = useMemo(() => ({
    taskName: "", description: "", owner: "Ankit", section: "Other",
    priority: "Medium", dueDate: "", status: "To Do",
    externalStakeholders: "", projectName: "", stage: "",
    assignedTo: "", assignedToEmail: "",
  }), []);

  const [form, setForm]           = useState(defaultForm);
  const [projects, setProjects]   = useState([]);
  const [assignMode, setAssignMode] = useState("dropdown"); // "dropdown" | "email"
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName]   = useState("");

  // Prefill
  useEffect(() => {
    if (!initialTask) { setForm(defaultForm); return; }
    const f = {
      taskName:             initialTask.taskName || "",
      description:          initialTask.description || "",
      owner:                initialTask.owner || "Ankit",
      section:              initialTask.section || initialTask.type || "Other",
      priority:             initialTask.priority || "Medium",
      dueDate:              initialTask.dueDate || "",
      status:               initialTask.status || "To Do",
      externalStakeholders: initialTask.externalStakeholders || "",
      projectName:          initialTask.projectName || "",
      stage:                initialTask.stage || "",
      assignedTo:           initialTask.assignedTo || "",
      assignedToEmail:      initialTask.assignedToEmail || "",
    };
    setForm(f);
    if (f.assignedToEmail && !OWNER_EMAILS[f.assignedTo]) {
      setAssignMode("email");
      setCustomEmail(f.assignedToEmail);
      setCustomName(f.assignedTo);
    }
  }, [initialTask, defaultForm]);

  // Pre-fill project+stage when opened from "Add Task in Stage"
  useEffect(() => {
    if (initialTask?.projectName && !initialTask?.id) {
      setForm(f => ({ ...f, projectName: initialTask.projectName || "", stage: initialTask.stage || "" }));
    }
  }, [initialTask]);

  function update(key, value) { setForm(f => ({ ...f, [key]: value })); }

  // Load projects with auth
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const token = getToken ? await getToken() : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch("/api/projects?archived=0", { headers, cache: "no-store" });
        if (!res.ok || !alive) return;
        const d = await res.json();
        setProjects(Array.isArray(d?.projects) ? d.projects : []);
      } catch {}
    }
    load();
    return () => (alive = false);
  }, [getToken]);

  // Resolve assignee from current mode
  function resolvedAssignee() {
    if (assignMode === "email") {
      return { assignedTo: customName.trim(), assignedToEmail: customEmail.trim().toLowerCase() };
    }
    const name = form.assignedTo;
    return { assignedTo: name, assignedToEmail: OWNER_EMAILS[name] || "" };
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.projectName?.trim()) return alert("Please select a project.");
    if (!form.stage?.trim())       return alert("Please select a stage.");
    if (!form.taskName.trim())     return alert("Task Name is required.");
    const { assignedTo, assignedToEmail } = resolvedAssignee();
    onSubmit?.({ ...form, taskName: form.taskName.trim(), projectName: form.projectName.trim(), stage: form.stage.trim(), assignedTo, assignedToEmail });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>

      {/* ── Project + Stage ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Project Name</label>
          <select className="dtt-select" value={form.projectName}
            onChange={e => { update("projectName", e.target.value); update("stage", ""); }}>
            <option value="">✓ Select project</option>
            {projects.length === 0 && <option disabled>Loading…</option>}
            {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Stage</label>
          <select className="dtt-select" value={form.stage}
            onChange={e => update("stage", e.target.value)} disabled={!form.projectName}>
            <option value="">{!form.projectName ? "Select project first" : "Select stage"}</option>
            {FIXED_STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* ── Task Name ── */}
      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ fontWeight: 900 }}>Task Name</label>
        <input className="dtt-input" value={form.taskName}
          onChange={e => update("taskName", e.target.value)} placeholder="Enter task name" autoFocus />
      </div>

      {/* ── Description ── */}
      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ fontWeight: 900 }}>Task Description</label>
        <textarea className="dtt-input" value={form.description}
          onChange={e => update("description", e.target.value)}
          placeholder="Add details, context, links, notes…" rows={3} style={{ resize: "vertical" }} />
      </div>

      {/* ── Owner / Type / Priority / Status ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Owner</label>
          <select className="dtt-select" value={form.owner} onChange={e => update("owner", e.target.value)}>
            {(OWNER_OPTIONS || ["Ankit"]).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Type</label>
          <select className="dtt-select" value={form.section} onChange={e => update("section", e.target.value)}>
            {(SECTION_OPTIONS || ["Other"]).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Priority</label>
          <select className="dtt-select" value={form.priority} onChange={e => update("priority", e.target.value)}>
            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Status</label>
          <select className="dtt-select" value={form.status} onChange={e => update("status", e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* ── Due Date / Stakeholders ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>Due Date</label>
          <input className="dtt-input" type="date" value={form.dueDate} onChange={e => update("dueDate", e.target.value)} />
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 900 }}>External Stakeholders</label>
          <input className="dtt-input" value={form.externalStakeholders}
            onChange={e => update("externalStakeholders", e.target.value)} placeholder="Vendor, agency, partner" />
        </div>
      </div>

      {/* ── Assignee ── */}
      <div style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid var(--border)", background: "rgba(77,124,255,0.05)", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <label style={{ fontWeight: 900, fontSize: 14 }}>👤 Assign Task To</label>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button"
              onClick={() => setAssignMode("dropdown")}
              style={{ borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 900, cursor: "pointer",
                border: `1px solid ${assignMode === "dropdown" ? "rgba(77,124,255,0.6)" : "var(--border)"}`,
                background: assignMode === "dropdown" ? "rgba(77,124,255,0.2)" : "transparent",
                color: assignMode === "dropdown" ? "#93c5fd" : "var(--muted)" }}>
              Team Member
            </button>
            <button type="button"
              onClick={() => setAssignMode("email")}
              style={{ borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 900, cursor: "pointer",
                border: `1px solid ${assignMode === "email" ? "rgba(77,124,255,0.6)" : "var(--border)"}`,
                background: assignMode === "email" ? "rgba(77,124,255,0.2)" : "transparent",
                color: assignMode === "email" ? "#93c5fd" : "var(--muted)" }}>
              Custom Email
            </button>
          </div>
        </div>

        {assignMode === "dropdown" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontWeight: 700, fontSize: 13 }}>Team Member</label>
              <select className="dtt-select" value={form.assignedTo} onChange={e => update("assignedTo", e.target.value)}>
                <option value="">— Unassigned —</option>
                {OWNER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {form.assignedTo && (
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontWeight: 700, fontSize: 13 }}>Email</label>
                <input className="dtt-input" readOnly value={OWNER_EMAILS[form.assignedTo] || "—"}
                  style={{ opacity: 0.7, cursor: "default" }} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontWeight: 700, fontSize: 13 }}>Name</label>
              <input className="dtt-input" value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Full name" />
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontWeight: 700, fontSize: 13 }}>Email *</label>
              <input className="dtt-input" type="email" value={customEmail} onChange={e => setCustomEmail(e.target.value)} placeholder="email@example.com" />
            </div>
          </div>
        )}

        {/* Current assignee preview */}
        {(form.assignedTo || customEmail) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(77,124,255,0.12)", border: "1px solid rgba(77,124,255,0.3)" }}>
            <div style={{ width: 28, height: 28, borderRadius: 999, background: "linear-gradient(135deg, #4d7cff, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, color: "#fff", flexShrink: 0 }}>
              {(assignMode === "dropdown" ? form.assignedTo : customName || customEmail)?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 13 }}>
                {assignMode === "dropdown" ? (form.assignedTo || "Unassigned") : (customName || "Custom")}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {assignMode === "dropdown" ? (OWNER_EMAILS[form.assignedTo] || "") : customEmail}
              </div>
            </div>
            <button type="button" onClick={() => { update("assignedTo", ""); setCustomEmail(""); setCustomName(""); }}
              style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        )}
      </div>

      {/* ── Attachments (edit mode only) ── */}
      {isEdit && initialTask?.id && (
        <div style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
          <TaskAttachments taskId={initialTask.id} getToken={getToken} />
        </div>
      )}
      {!isEdit && (
        <div style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)", color: "var(--muted)", fontSize: 12 }}>
          💡 You can attach files after creating the task by editing it.
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
        <button type="button" className="dtt-btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="dtt-btnPrimary">
          {isEdit ? "Save Changes" : "Create Task"}
        </button>
      </div>
    </form>
  );
}