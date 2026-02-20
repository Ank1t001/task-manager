// src/App.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import TaskForm from "./components/TaskForm.jsx";
import TaskTable from "./components/TaskTable.jsx";
import Modal from "./components/Modal.jsx";
import MiniDashboard from "./components/MiniDashboard.jsx";
import KanbanBoard from "./components/KanbanBoard.jsx";
import ProjectView from "./components/ProjectView.jsx";
import Dashboard from "./components/Dashboard.jsx";
import ActivityFeed from "./components/ActivityFeed.jsx";
import NotificationsBadge from "./components/NotificationsBadge.jsx";

// ─── helpers ────────────────────────────────────────────────────────────────
function parseStagesText(text) {
  return String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .reduce((acc, line) => {
      const [stageName = "", stageOwnerEmail = ""] = line.split("|").map((p) => p.trim());
      if (stageName && !acc.find((s) => s.stageName.toLowerCase() === stageName.toLowerCase()))
        acc.push({ stageName, stageOwnerEmail: stageOwnerEmail.toLowerCase() });
      return acc;
    }, []);
}

// ─── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const { isAuthenticated, user, isLoading, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();

  // ── global state ──
  const [tasks, setTasks]         = useState([]);
  const [projects, setProjects]   = useState([]);
  const [apiError, setApiError]   = useState("");
  const [activeTab, setActiveTab] = useState("tasks");
  const [viewMode, setViewMode]   = useState("table");
  const [theme, setTheme]         = useState(() => localStorage.getItem("theme") || "light");

  // ── panels ──
  const [activityOpen, setActivityOpen] = useState(false);

  // ── task modal ──
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask]   = useState(null);

  // ── project modal ──
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject]   = useState(null);
  const [projName, setProjName]               = useState("");
  const [projOwnerName, setProjOwnerName]     = useState("");
  const [projOwnerEmail, setProjOwnerEmail]   = useState("");
  const [projStagesText, setProjStagesText]   = useState("");
  const [projSaving, setProjSaving]           = useState(false);

  // ── delete project confirm ──
  const [deletingProject, setDeletingProject] = useState(null);

  // ── open project detail ──
  const [openProject, setOpenProject] = useState(null);

  // ── task filters ──
  const [query, setQuery]               = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [ownerFilter, setOwnerFilter]   = useState("All");
  const [dateFilter, setDateFilter]     = useState("All");   // "All"|"Today"|"Yesterday"|"This Week"|"This Month"|"Custom"
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo]     = useState("");

  const audience     = import.meta.env.VITE_AUTH0_AUDIENCE;
  const organization = import.meta.env.VITE_AUTH0_ORG_ID;
  const redirectUri  = import.meta.env.VITE_AUTH0_REDIRECT_URI || `${window.location.origin}/`;
  const apiBase      = "/api";

  // apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // ── auth helpers ──
  async function getToken() {
    return getAccessTokenSilently({
      authorizationParams: { audience, organization, scope: "openid profile email" },
    });
  }

  async function fetchJSON(path, opts = {}) {
    const token = await getToken();
    const res = await fetch(`${apiBase}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) { const t = await res.text(); throw new Error(`API ${res.status}: ${t.slice(0, 400)}`); }
    return ct.includes("application/json") ? res.json() : res.text();
  }

  // ── load data ──
  const loadTasks = useCallback(async () => {
    setApiError("");
    if (!isAuthenticated) { setTasks([]); return; }
    try {
      const d = await fetchJSON("/tasks");
      const tasks = (d?.tasks || []).map(t => ({
        ...t,
        taskName:             t.title       || t.taskName || "",
        projectName:          t.project     || t.projectName || "",
        section:              t.type        || t.section || "",
        externalStakeholders: t.stakeholder || t.externalStakeholders || "",
        assignedTo:           t.assignedTo  || "",
        assignedToEmail:      t.assignedToEmail || "",
      }));
      setTasks(tasks);
    }
    catch (e) { setApiError(String(e?.message || e)); setTasks([]); }
  }, [isAuthenticated]);

  const loadProjects = useCallback(async () => {
    if (!isAuthenticated) { setProjects([]); return; }
    try { const d = await fetchJSON("/projects?archived=0"); setProjects(Array.isArray(d?.projects) ? d.projects : []); }
    catch { setProjects([]); }
  }, [isAuthenticated]);

  useEffect(() => { if (!isLoading) { loadTasks(); loadProjects(); } }, [isLoading, isAuthenticated]);

  // ── task CRUD ──
  async function handleCreateTask(formData) {
    try {
      await fetchJSON("/tasks", { method: "POST", body: JSON.stringify(formData) });
      setShowTaskForm(false); setEditingTask(null); await loadTasks();
    } catch (e) { alert("Create failed: " + e.message); }
  }
  async function handleEditTask(formData) {
    try {
      await fetchJSON(`/tasks/${editingTask.id}`, { method: "PUT", body: JSON.stringify(formData) });
      setShowTaskForm(false); setEditingTask(null); await loadTasks();
    } catch (e) { alert("Update failed: " + e.message); }
  }
  async function handleDeleteTask(taskId) {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    try { await fetchJSON(`/tasks/${taskId}`, { method: "DELETE" }); await loadTasks(); }
    catch (e) { alert("Delete failed: " + e.message); }
  }

  // ── project CRUD ──
  function openCreateProject() {
    setEditingProject(null);
    setProjName(""); setProjOwnerName(user?.name || ""); setProjOwnerEmail(user?.email || ""); setProjStagesText("");
    setShowProjectForm(true);
  }
  function openEditProject(p) {
    setEditingProject(p);
    setProjName(p.name || ""); setProjOwnerName(p.ownerName || ""); setProjOwnerEmail(p.ownerEmail || ""); setProjStagesText("");
    setShowProjectForm(true);
  }
  async function handleSaveProject() {
    const name = projName.trim();
    const ownerEmail = projOwnerEmail.trim().toLowerCase();
    const ownerName  = projOwnerName.trim();
    if (!name) return alert("Project name is required.");
    if (!ownerEmail) return alert("Owner email is required.");
    const stages = parseStagesText(projStagesText);
    try {
      setProjSaving(true);
      if (editingProject) {
        await fetchJSON("/projects", { method: "PUT", body: JSON.stringify({ name: editingProject.name, newName: name, ownerEmail, ownerName }) });
      } else {
        await fetchJSON("/projects", { method: "POST", body: JSON.stringify({ name, ownerEmail, ownerName, stages }) });
      }
      setShowProjectForm(false);
      await loadProjects();
    } catch (e) { alert("Save failed: " + e.message); }
    finally { setProjSaving(false); }
  }
  async function handleDeleteProject(p) {
    try {
      await fetchJSON("/projects", { method: "DELETE", body: JSON.stringify({ name: p.name }) });
      setDeletingProject(null);
      await loadProjects();
    } catch (e) { alert("Delete failed: " + e.message); }
  }

  // ── derived ──
  const allOwnerOptions = useMemo(() => ["All", ...[...new Set(tasks.map(t => t.owner).filter(Boolean))].sort()], [tasks]);
  const allTypeOptions  = useMemo(() => ["All", ...[...new Set(tasks.map(t => t.section).filter(Boolean))].sort()], [tasks]);

  const filteredTasks = useMemo(() => {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    function inRange(task) {
      if (dateFilter === "All") return true;
      const raw = task.dueDate || task.createdAt || "";
      if (!raw) return dateFilter === "All";
      const d = new Date(raw.slice(0, 10));
      if (isNaN(d.getTime())) return false;

      if (dateFilter === "Today") {
        return d >= today && d < new Date(today.getTime() + 86400000);
      }
      if (dateFilter === "Yesterday") {
        const yest = new Date(today.getTime() - 86400000);
        return d >= yest && d < today;
      }
      if (dateFilter === "This Week") {
        const dayOfWeek = today.getDay(); // 0=Sun
        const weekStart = new Date(today.getTime() - dayOfWeek * 86400000);
        const weekEnd   = new Date(weekStart.getTime() + 7 * 86400000);
        return d >= weekStart && d < weekEnd;
      }
      if (dateFilter === "This Month") {
        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
      }
      if (dateFilter === "Custom") {
        const from = customDateFrom ? new Date(customDateFrom) : null;
        const to   = customDateTo   ? new Date(new Date(customDateTo).getTime() + 86400000) : null;
        if (from && d < from) return false;
        if (to   && d >= to)  return false;
        return true;
      }
      return true;
    }

    return tasks.filter(t => {
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      if (ownerFilter  !== "All" && t.owner  !== ownerFilter)  return false;
      if (!inRange(t)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (![t.taskName, t.description, t.section, t.externalStakeholders].join(" ").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, ownerFilter, query, dateFilter, customDateFrom, customDateTo]);

  const userInitial = (user?.name || user?.email || "?")[0].toUpperCase();

  async function handleLogin() {
    await loginWithRedirect({ authorizationParams: { audience, organization, redirect_uri: redirectUri, scope: "openid profile email" } });
  }
  function handleLogout() { logout({ logoutParams: { returnTo: window.location.origin } }); }

  // ── project detail view ──
  if (openProject) {
    return (
      <div className="dtt-page">
        <div className="dtt-shell">
          <ProjectView
            projectName={openProject.name}
            projectOwnerName={openProject.ownerName}
            projectOwnerEmail={openProject.ownerEmail}
            projectArchived={openProject.archived}
            meEmail={user?.email}
            meName={user?.name}
            userIsAdmin={true}
            onBack={() => setOpenProject(null)}
            onProjectChanged={() => { loadProjects(); setOpenProject(null); }}
            onEditTask={(t) => { setEditingTask(t); setShowTaskForm(true); }}
            onCreateTaskInStage={(opts) => { setEditingTask({ projectName: opts.projectName, stage: opts.stage }); setShowTaskForm(true); }}
            getToken={getToken}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dtt-page">
      <div className="dtt-shell">

        {/* ── HEADER ── */}
        <header className="dtt-card" style={{ padding: "16px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: "linear-gradient(135deg, #4d7cff 0%, #a855f7 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, boxShadow: "0 4px 16px rgba(77,124,255,0.45)",
              }}>📋</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: "-0.3px", lineHeight: 1.15 }}>Digital Team Task Tracker</div>
                {isAuthenticated && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{user?.email || user?.name}</div>}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="dtt-iconBtn" title="Toggle theme" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{ fontSize: 16 }}>
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
              {isAuthenticated && (
                <>
                  <NotificationsBadge getToken={getToken} userEmail={user?.email} />
                  <button className="dtt-iconBtn" title="Activity Feed" onClick={() => setActivityOpen(true)} style={{ fontSize: 18 }}>⚡</button>
                </>
              )}

              {isAuthenticated && (
                <>
                  <button className="dtt-btn" onClick={() => { loadTasks(); loadProjects(); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 14px" }}>
                    <span style={{ fontSize: 15 }}>↻</span> Refresh
                  </button>
                  {activeTab === "tasks" && (
                    <button className="dtt-btnPrimary" onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                      style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", fontWeight: 900, fontSize: 14, borderRadius: 12 }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Task
                    </button>
                  )}
                  {activeTab === "projects" && (
                    <button className="dtt-btnPrimary" onClick={openCreateProject}
                      style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", fontWeight: 900, fontSize: 14, borderRadius: 12 }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> New Project
                    </button>
                  )}
                </>
              )}

              {!isAuthenticated ? (
                <button className="dtt-btnPrimary" onClick={handleLogin} style={{ padding: "10px 20px", fontWeight: 900 }}>Sign In</button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 999, background: "linear-gradient(135deg, #4d7cff, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#fff", flexShrink: 0 }}>
                    {userInitial}
                  </div>
                  <button className="dtt-btn" onClick={handleLogout} style={{ fontSize: 13 }}>Sign Out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── ERROR ── */}
        {apiError && (
          <div style={{ padding: "14px 18px", borderRadius: 14, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.40)", color: "#fca5a5", fontSize: 13, whiteSpace: "pre-wrap" }}>
            ⚠️ {apiError}
          </div>
        )}

        {/* ── NOT AUTH ── */}
        {!isAuthenticated && !isLoading && (
          <div className="dtt-card" style={{ textAlign: "center", padding: "56px 24px" }}>
            <div style={{ fontSize: 44, marginBottom: 18 }}>🔒</div>
            <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 10 }}>Welcome back</div>
            <div style={{ color: "var(--muted)", marginBottom: 28, fontSize: 14 }}>Sign in to access your team's tasks and projects.</div>
            <button className="dtt-btnPrimary" onClick={handleLogin} style={{ padding: "12px 32px", fontWeight: 900, fontSize: 15, borderRadius: 14 }}>Sign In</button>
          </div>
        )}

        {isLoading && (
          <div className="dtt-card" style={{ textAlign: "center", padding: "40px 24px", color: "var(--muted)" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>Loading…
          </div>
        )}

        {/* ── MAIN ── */}
        {isAuthenticated && !isLoading && (
          <>
            {/* Nav tabs */}
            <div className="dtt-card" style={{ padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="dtt-tabs">
                  <button className={`dtt-tab${activeTab === "tasks" ? " dtt-tabActive" : ""}`} onClick={() => setActiveTab("tasks")}
                    style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    ✅ Tasks
                  </button>
                  <button className={`dtt-tab${activeTab === "projects" ? " dtt-tabActive" : ""}`} onClick={() => setActiveTab("projects")}
                    style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    📁 Projects <span className="dtt-pill" style={{ marginLeft: 4, padding: "2px 8px", fontSize: 11 }}>{projects.length}</span>
                  </button>
                  <button className={`dtt-tab${activeTab === "dashboard" ? " dtt-tabActive" : ""}`} onClick={() => setActiveTab("dashboard")}
                    style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    📊 Dashboard
                  </button>
                </div>
              </div>
            </div>

            {/* ── TASKS TAB ── */}
            {activeTab === "tasks" && (
              <>
                <MiniDashboard tasks={tasks} />

                <div className="dtt-card" style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="dtt-tabs">
                      <button className={`dtt-tab${viewMode === "table" ? " dtt-tabActive" : ""}`} onClick={() => setViewMode("table")}
                        style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>⊞ Table</button>
                      <button className={`dtt-tab${viewMode === "kanban" ? " dtt-tabActive" : ""}`} onClick={() => setViewMode("kanban")}
                        style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>⋮⋮⋮ Kanban</button>
                    </div>
                    <div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>
                      {filteredTasks.length} of {tasks.length} task{tasks.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                {viewMode === "kanban"
                  ? <KanbanBoard tasks={filteredTasks} />
                  : <TaskTable
                      tasks={filteredTasks}
                      allOwnerOptions={allOwnerOptions}
                      allTypeOptions={allTypeOptions}
                      query={query} setQuery={setQuery}
                      statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                      ownerFilter={ownerFilter} setOwnerFilter={setOwnerFilter}
                      dateFilter={dateFilter} setDateFilter={setDateFilter}
                      customDateFrom={customDateFrom} setCustomDateFrom={setCustomDateFrom}
                      customDateTo={customDateTo} setCustomDateTo={setCustomDateTo}
                      onEdit={(t) => { setEditingTask(t); setShowTaskForm(true); }}
                      onDelete={handleDeleteTask}
                      canEditAny={true}
                      canEditTask={() => true}
                    />
                }
              </>
            )}

            {/* ── DASHBOARD TAB ── */}
            {activeTab === "dashboard" && (
              <Dashboard tasks={tasks} projects={projects} />
            )}

            {/* ── PROJECTS TAB ── */}
            {activeTab === "projects" && (
              <ProjectsPanel
                projects={projects}
                onOpen={(p) => setOpenProject(p)}
                onEdit={openEditProject}
                onDelete={(p) => setDeletingProject(p)}
              />
            )}
          </>
        )}

        {/* ── ADD/EDIT TASK MODAL ── */}
        <Modal open={showTaskForm} onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
          title={editingTask?.id ? "Edit Task" : "New Task"}
          subtitle={editingTask?.id ? `Editing: ${editingTask.taskName}` : "Add a new task to your board"}>
          <TaskForm
            mode={editingTask?.id ? "edit" : "create"}
            initialTask={editingTask}
            onSubmit={editingTask?.id ? handleEditTask : handleCreateTask}
            onCancel={() => { setShowTaskForm(false); setEditingTask(null); }}
            getToken={getToken}
          />
        </Modal>

        {/* ── CREATE / EDIT PROJECT MODAL ── */}
        <Modal open={showProjectForm} onClose={() => setShowProjectForm(false)}
          title={editingProject ? "Edit Project" : "New Project"}
          subtitle={editingProject ? `Editing: ${editingProject.name}` : "Create a new project for your team"}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontWeight: 900, fontSize: 13 }}>Project Name *</label>
                <input className="dtt-input" value={projName} onChange={e => setProjName(e.target.value)} placeholder="e.g. EMIFT Campaign" autoFocus />
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontWeight: 900, fontSize: 13 }}>Owner Name *</label>
                <input className="dtt-input" value={projOwnerName} onChange={e => setProjOwnerName(e.target.value)} placeholder="e.g. Ankit" />
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontWeight: 900, fontSize: 13 }}>Owner Email *</label>
              <input className="dtt-input" type="email" value={projOwnerEmail} onChange={e => setProjOwnerEmail(e.target.value)} placeholder="owner@example.com" />
            </div>

            {!editingProject && (
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontWeight: 900, fontSize: 13 }}>Stages <span style={{ color: "var(--muted)", fontWeight: 600 }}>(optional — one per line)</span></label>
                <textarea className="dtt-input" rows={5} value={projStagesText} onChange={e => setProjStagesText(e.target.value)}
                  placeholder={"Stage Name | owner@email.com\n\nExample:\nAds Campaigns | sheelp@equiton.com\nCopy | vanessa@equiton.com\nCreative | ankit@digijabber.com"}
                  style={{ resize: "vertical", fontFamily: "monospace", fontSize: 12 }} />
                <div className="dtt-muted" style={{ fontSize: 11 }}>Format: Stage Name | owner@email.com — you can also add/edit stages inside the project after creation.</div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <button className="dtt-btn" onClick={() => setShowProjectForm(false)} disabled={projSaving}>Cancel</button>
              <button className="dtt-btnPrimary" onClick={handleSaveProject} disabled={projSaving}
                style={{ padding: "9px 22px", fontWeight: 900 }}>
                {projSaving ? "Saving…" : editingProject ? "Save Changes" : "Create Project"}
              </button>
            </div>
          </div>
        </Modal>

        {/* ── DELETE PROJECT CONFIRM MODAL ── */}
        <Modal open={!!deletingProject} onClose={() => setDeletingProject(null)}
          title="Delete Project" subtitle="This action cannot be undone.">
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.30)", fontSize: 14 }}>
              Are you sure you want to delete <b>"{deletingProject?.name}"</b>?
              <br /><span style={{ color: "var(--muted)", fontSize: 13 }}>All stages and associated data for this project will be removed.</span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="dtt-btn" onClick={() => setDeletingProject(null)}>Cancel</button>
              <button onClick={() => handleDeleteProject(deletingProject)}
                style={{ borderRadius: 12, padding: "9px 22px", border: "1px solid rgba(239,68,68,0.50)", background: "rgba(239,68,68,0.18)", color: "#fca5a5", cursor: "pointer", fontWeight: 900, fontSize: 13 }}>
                Delete Project
              </button>
            </div>
          </div>
        </Modal>

      </div>
      <ActivityFeed open={activityOpen} onClose={() => setActivityOpen(false)} getToken={getToken} />
    </div>
  );
}

// ─── Projects Panel ──────────────────────────────────────────────────────────
function ProjectsPanel({ projects, onOpen, onEdit, onDelete }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter(p =>
      p.name?.toLowerCase().includes(needle) ||
      p.ownerEmail?.toLowerCase().includes(needle) ||
      p.ownerName?.toLowerCase().includes(needle)
    );
  }, [projects, q]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="dtt-card" style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input className="dtt-input" placeholder="Search projects…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 340 }} />
          {q && <button className="dtt-btn" onClick={() => setQ("")}>Clear</button>}
          <span className="dtt-muted" style={{ marginLeft: "auto", fontSize: 12 }}>{filtered.length} project{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="dtt-card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>No projects yet</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Create a project to get started. Projects appear in the task form dropdown.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map(p => (
            <div key={p.name} className="dtt-card"
              style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: "linear-gradient(135deg, rgba(77,124,255,0.30), rgba(168,85,247,0.30))",
                border: "1px solid rgba(77,124,255,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>📁</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15 }}>{p.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
                  Owner: <b>{p.ownerName || p.ownerEmail}</b>
                  {p.ownerName && p.ownerEmail ? ` · ${p.ownerEmail}` : ""}
                  {Number(p.archived) === 1 ? <span className="dtt-pill" style={{ marginLeft: 8 }}>Archived</span> : null}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button className="dtt-btn" onClick={() => onOpen(p)}
                  style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>Open →</button>
                <button className="dtt-btn" onClick={() => onEdit(p)}
                  style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>✏️ Edit</button>
                <button onClick={() => onDelete(p)}
                  style={{ borderRadius: 12, padding: "8px 12px", border: "1px solid rgba(239,68,68,0.40)", background: "rgba(239,68,68,0.10)", color: "#fca5a5", cursor: "pointer", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}