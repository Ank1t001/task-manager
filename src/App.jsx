// src/App.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import MiniDashboard from "./components/MiniDashboard";
import TaskTable from "./components/TaskTable";
import TaskForm from "./components/TaskForm";
import Modal from "./components/Modal";
import KanbanBoard from "./components/KanbanBoard";
import Projects from "./components/Projects";
import ProjectView from "./components/ProjectView";

const ADMIN_EMAIL = "ankit@digijabber.com";
const BUILD_VERSION = "v13.0-crm-projects";

// Auth0
// NOTE: main.jsx must wrap <App /> with <Auth0Provider ... />

const FIXED_STAGES = [
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

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

function downloadCSV(filename, rows) {
  const escape = (s) => {
    const str = String(s ?? "");
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const headers = [
    "Task Name",
    "Description",
    "Owner",
    "Owner Email",
    "Type",
    "Priority",
    "Status",
    "Due Date",
    "Stakeholders",
    "Project",
    "Stage",
    "Created At",
    "Updated At",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((t) =>
      [
        t.taskName,
        t.description,
        t.owner,
        t.ownerEmail,
        t.section,
        t.priority,
        t.status,
        t.dueDate,
        t.externalStakeholders,
        t.projectName,
        t.stage,
        t.createdAt,
        t.updatedAt,
      ]
        .map(escape)
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// DB row -> UI task
function dbRowToUiTask(r) {
  return {
    id: r.id,
    taskName: r.taskName ?? r.taskname ?? r.task_name ?? r.task ?? "",
    description: r.description ?? "",
    owner: r.owner ?? "",
    ownerEmail: r.ownerEmail ?? r.owneremail ?? "",
    section: r.type ?? r.section ?? "Other",
    priority: r.priority ?? "Medium",
    status: r.status ?? "To Do",
    dueDate: r.dueDate ?? "",
    externalStakeholders: r.externalStakeholders ?? "",
    projectName: r.projectName ?? "",
    stage: r.stage ?? "",
    createdAt: r.createdAt ?? "",
    updatedAt: r.updatedAt ?? "",
    sortOrder: typeof r.sortOrder === "number" ? r.sortOrder : r.sortOrder ? Number(r.sortOrder) : 0,
  };
}

// UI task -> API payload
function uiTaskToDbPayload(t) {
  return {
    id: t.id,
    taskName: t.taskName,
    description: t.description || "",
    owner: t.owner || "",
    ownerEmail: t.ownerEmail || "",
    type: t.section || "Other",
    priority: t.priority || "Medium",
    status: t.status || "To Do",
    dueDate: t.dueDate || "",
    externalStakeholders: t.externalStakeholders || "",
    projectName: t.projectName || "",
    stage: t.stage || "",
    sortOrder: typeof t.sortOrder === "number" ? t.sortOrder : 0,
  };
}

export default function App() {
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const getToken = async () => {
    if (!isAuthenticated) return "";
    return await getAccessTokenSilently().catch(() => "");
  };

  const apiFetch = async (url, opts = {}) => {
    const token = await getToken();
    const headers = { ...(opts.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...opts, headers });
  };

  // Auth / user
  const [isAuthed, setIsAuthed] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("Member");

  // UI state
  const [darkMode, setDarkMode] = useState(false);
  const [tab, setTab] = useState("dashboard");

  // Tasks
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Projects
  const [selectedProject, setSelectedProject] = useState(null);
  const [stageOwnerCache, setStageOwnerCache] = useState({});

  // --- Auth0: Login/Logout handlers ---
  function handleLogin() {
    loginWithRedirect();
  }
  function handleLogout() {
    logout({ logoutParams: { returnTo: window.location.origin } });
  }

  function handleExportCSV() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`tasks_${stamp}.csv`, tableFilteredTasks);
  }

  // Load /api/me (Auth0 JWT)
  async function loadMe() {
    try {
      const res = await apiFetch("/api/me", { cache: "no-store" });
      if (res.status === 401) {
        setIsAuthed(false);
        setUserEmail("");
        setUserName("");
        setRole("Member");
        return;
      }
      const data = await res.json();
      const email = normalizeEmail(data?.email || user?.email || "");
      const name = String(data?.name || user?.name || email || "Unknown");
      setIsAuthed(true);
      setUserEmail(email);
      setUserName(name);
      setRole(email === normalizeEmail(ADMIN_EMAIL) ? "Admin" : "Member");
    } catch {
      setIsAuthed(false);
      setUserEmail("");
      setUserName("");
      setRole("Member");
    }
  }

  async function loadTasks() {
    try {
      setLoadingTasks(true);
      setTasksError("");

      const res = await apiFetch("/api/tasks", { cache: "no-store" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to load tasks (${res.status}) ${txt}`);
      }

      const data = await res.json();
      const uiTasks = Array.isArray(data) ? data.map(dbRowToUiTask) : [];
      setTasks(uiTasks);

      // refresh stage owner cache for any projects we see
      const projects = Array.from(
        new Set(uiTasks.map((t) => (t.projectName || "").trim()).filter(Boolean))
      );
      if (projects.length) {
        void loadStageOwners(projects);
      }
    } catch (e) {
      setTasks([]);
      setTasksError(e?.message || "Failed to load tasks");
    } finally {
      setLoadingTasks(false);
    }
  }

  async function loadStageOwners(projectNames) {
    try {
      const nextCache = { ...stageOwnerCache };

      for (const projectName of projectNames) {
        if (nextCache[projectName]) continue; // already cached

        const res = await apiFetch(
          `/api/stages?projectName=${encodeURIComponent(projectName)}`,
          { cache: "no-store" }
        );
        if (!res.ok) continue;
        const data = await res.json();
        const stages = Array.isArray(data?.stages) ? data.stages : [];

        const map = {};
        for (const s of stages) {
          const stageName = String(s.stageName || "").trim();
          const stageOwnerEmail = normalizeEmail(s.stageOwnerEmail || "");
          if (stageName) map[stageName] = stageOwnerEmail;
        }
        nextCache[projectName] = map;
      }

      setStageOwnerCache(nextCache);
    } catch {
      // ignore
    }
  }

  // Only load after Auth0 login
  useEffect(() => {
    if (!isAuthenticated) {
      setIsAuthed(false);
      setUserEmail("");
      setUserName("");
      setRole("Member");
      setTasks([]);
      setTasksError("");
      return;
    }
    void loadMe();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setTasks([]);
      setTasksError("");
      return;
    }
    void loadTasks();
  }, [isAuthenticated]);

  async function createTask(uiTask) {
    const payload = uiTaskToDbPayload(uiTask);
    const res = await apiFetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Create failed (${res.status}) ${t}`);
    }
  }

  async function updateTask(uiTask) {
    const payload = uiTaskToDbPayload(uiTask);
    const res = await apiFetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Update failed (${res.status}) ${t}`);
    }
  }

  async function deleteTask(id) {
    const res = await apiFetch(`/api/tasks?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Delete failed (${res.status}) ${t}`);
    }
  }

  const ownerOptions = useMemo(() => {
    const set = new Set(tasks.map((t) => t.owner).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [tasks]);

  const typeOptions = useMemo(() => {
    const set = new Set(tasks.map((t) => t.section).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [tasks]);

  // Base filtered tasks (global)
  const baseFilteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q) {
        const hay = [
          t.taskName,
          t.description,
          t.owner,
          t.ownerEmail,
          t.section,
          t.status,
          t.priority,
          t.externalStakeholders,
          t.projectName,
          t.stage,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      if (ownerFilter !== "All" && t.owner !== ownerFilter) return false;
      if (typeFilter !== "All" && t.section !== typeFilter) return false;

      if (dateFrom && (!t.dueDate || t.dueDate < dateFrom)) return false;
      if (dateTo && (!t.dueDate || t.dueDate > dateTo)) return false;

      return true;
    });
  }, [tasks, query, statusFilter, ownerFilter, typeFilter, dateFrom, dateTo]);

  const tableFilteredTasks = baseFilteredTasks;

  const canEditAny = role === "Admin";
  const canEditTask = (t) => {
    if (canEditAny) return true;
    const my = normalizeEmail(userEmail);
    return my && normalizeEmail(t.ownerEmail) === my;
  };

  const headerSignedIn = isAuthenticated
    ? `${userEmail || user?.email || "Unknown"} (${role}: ${userName || user?.name || "Unknown"})`
    : "Not signed in";

  return (
    <div className={darkMode ? "dtt dtt-dark" : "dtt"}>
      <div className="dtt-shell">
        <header className="dtt-header">
          <div>
            <div className="dtt-title">Digital Team Task Tracker</div>
            <div className="dtt-subtitle">
              Signed in: {headerSignedIn} • {BUILD_VERSION}
            </div>
          </div>

          <div className="dtt-header-actions">
            <button className="dtt-btn" onClick={() => setDarkMode((v) => !v)}>
              {darkMode ? "Light Mode" : "Dark Mode"}
            </button>

            {!isAuthenticated ? (
              <button className="dtt-btn dtt-btn-primary" onClick={handleLogin} disabled={isLoading}>
                Login
              </button>
            ) : (
              <button className="dtt-btn" onClick={handleLogout}>
                Logout
              </button>
            )}

            <button className="dtt-btn" onClick={handleExportCSV} disabled={!isAuthenticated}>
              Export CSV
            </button>

            <div className="dtt-pill">{tableFilteredTasks.length} tasks</div>
          </div>
        </header>

        {tasksError ? (
          <div className="dtt-error">
            Tasks API Error: {tasksError}
          </div>
        ) : null}

        <div className="dtt-tabs">
          <button className={tab === "dashboard" ? "dtt-tab active" : "dtt-tab"} onClick={() => setTab("dashboard")}>
            Dashboard
          </button>
          <button className={tab === "tasks" ? "dtt-tab active" : "dtt-tab"} onClick={() => setTab("tasks")}>
            Tasks
          </button>
          <button className={tab === "kanban" ? "dtt-tab active" : "dtt-tab"} onClick={() => setTab("kanban")}>
            Kanban
          </button>
          <button className={tab === "projects" ? "dtt-tab active" : "dtt-tab"} onClick={() => setTab("projects")}>
            Projects
          </button>

          <div className="dtt-tabs-spacer" />

          <button
            className="dtt-btn dtt-btn-primary"
            onClick={() => {
              setEditingTask(null);
              setShowModal(true);
            }}
            disabled={!isAuthenticated}
          >
            + New Task
          </button>
        </div>

        {tab === "dashboard" && (
          <MiniDashboard
            tasks={tableFilteredTasks}
            currentOwner={userName || "Unknown"}
            dateFrom={dateFrom}
            dateTo={dateTo}
            setDateFrom={setDateFrom}
            setDateTo={setDateTo}
          />
        )}

        {tab === "tasks" && (
          <TaskTable
            tasks={tableFilteredTasks}
            loading={loadingTasks}
            query={query}
            setQuery={setQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            ownerFilter={ownerFilter}
            setOwnerFilter={setOwnerFilter}
            ownerOptions={ownerOptions}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            typeOptions={typeOptions}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            onEdit={(t) => {
              setEditingTask(t);
              setShowModal(true);
            }}
            onDelete={async (id) => {
              try {
                await deleteTask(id);
                await loadTasks();
              } catch (e) {
                setTasksError(e?.message || "Delete failed");
              }
            }}
            canEditTask={canEditTask}
            canEditAny={canEditAny}
          />
        )}

        {tab === "kanban" && (
          <>
            {loadingTasks ? (
              <div className="dtt-muted">Loading tasks…</div>
            ) : (
              <KanbanBoard
                tasks={tableFilteredTasks}
                onUpdateTask={async (t) => {
                  try {
                    await updateTask(t);
                    await loadTasks();
                  } catch (e) {
                    setTasksError(e?.message || "Update failed");
                  }
                }}
                canEditAny={canEditAny}
                canEditTask={canEditTask}
              />
            )}
          </>
        )}

        {tab === "projects" && (
          <>
            {!selectedProject ? (
              <Projects
                onOpenProject={(p) => setSelectedProject(p)}
                canEditAny={canEditAny}
              />
            ) : (
              <ProjectView
                project={selectedProject}
                fixedStages={FIXED_STAGES}
                onBack={() => setSelectedProject(null)}
                canEditAny={canEditAny}
              />
            )}
          </>
        )}

        <Modal open={showModal} onClose={() => setShowModal(false)}>
          <TaskForm
            mode={editingTask ? "edit" : "create"}
            fixedStages={FIXED_STAGES}
            task={editingTask}
            onCancel={() => setShowModal(false)}
            onSave={async (t) => {
              try {
                if (editingTask) {
                  await updateTask(t);
                } else {
                  await createTask(t);
                }
                setShowModal(false);
                await loadTasks();
              } catch (e) {
                setTasksError(e?.message || "Save failed");
              }
            }}
            canEditAny={canEditAny}
            canEditTask={canEditTask}
            currentUserName={userName || "Unknown"}
            currentUserEmail={userEmail || ""}
          />
        </Modal>
      </div>
    </div>
  );
}