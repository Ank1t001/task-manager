import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";

// If you have these components in your repo, keep them.
// If not, remove them and render JSON / simple UI instead.
import MiniDashboard from "./MiniDashboard.jsx";
import TaskTable from "./TaskTable.jsx";
import KanbanBoard from "./KanbanBoard.jsx";
import Projects from "./Projects.jsx";
import Modal from "./Modal.jsx";
import TaskForm from "./TaskForm.jsx";

const APP_VERSION = "v13.1-auth0";

function safeStr(v) {
  return (v ?? "").toString();
}

export default function App() {
  const {
    isLoading,
    isAuthenticated,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently
  } = useAuth0();

  const [theme, setTheme] = useState("light");
  const [tab, setTab] = useState("dashboard");

  const [tenant, setTenant] = useState(null); // { tenantId, role }
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState("");

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const displayName = useMemo(() => {
    if (!user) return "Not signed in";
    return user.name || user.email || "User";
  }, [user]);

  // Light UI default
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const apiFetch = useCallback(
    async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set("Content-Type", "application/json");

      if (isAuthenticated) {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE
          }
        });
        headers.set("Authorization", `Bearer ${token}`);
      }

      const res = await fetch(path, { ...options, headers });
      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }

      if (!res.ok) {
        const msg = json?.error || json?.message || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }

      return json;
    },
    [getAccessTokenSilently, isAuthenticated]
  );

  // Bootstrap tenant on login (creates tenant + membership if first time)
  useEffect(() => {
    (async () => {
      if (!isAuthenticated) {
        setTenant(null);
        return;
      }
      try {
        const t = await apiFetch("/api/tenants/bootstrap", {
          method: "POST",
          body: JSON.stringify({ name: "My Workspace" })
        });
        setTenant(t);
      } catch (e) {
        // If bootstrap fails, still let UI show but API calls will fail
        setTenant(null);
        console.error("bootstrap failed:", e);
      }
    })();
  }, [apiFetch, isAuthenticated]);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    setTasksError("");
    try {
      const data = await apiFetch("/api/tasks");
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      setTasks([]);
      setTasksError(e.message || "Failed to load tasks");
    } finally {
      setLoadingTasks(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (isAuthenticated && tenant?.tenantId) loadTasks();
    if (!isAuthenticated) {
      setTasks([]);
      setTasksError("");
    }
  }, [isAuthenticated, tenant?.tenantId, loadTasks]);

  const handleLogin = async (e) => {
    e?.preventDefault?.();
    await loginWithRedirect({
      authorizationParams: {
        redirect_uri:
          import.meta.env.VITE_AUTH0_REDIRECT_URI || window.location.origin + "/",
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        scope: "openid profile email"
      }
    });
  };

  const handleLogout = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin + "/"
      }
    });
  };

  const createTask = async (payload) => {
    const created = await apiFetch("/api/tasks", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setShowTaskModal(false);
    setEditingTask(null);
    await loadTasks();
    return created;
  };

  const updateTask = async (payload) => {
    const updated = await apiFetch(`/api/tasks?id=${encodeURIComponent(payload.id)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    setShowTaskModal(false);
    setEditingTask(null);
    await loadTasks();
    return updated;
  };

  const deleteTask = async (id) => {
    await apiFetch(`/api/tasks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadTasks();
  };

  const canEditAny = tenant?.role === "owner" || tenant?.role === "admin";
  const canEditTask = (t) => canEditAny || safeStr(t.ownerEmail).toLowerCase() === safeStr(user?.email).toLowerCase();

  return (
    <div className="appShell">
      <header className="topHeader">
        <div>
          <div className="appTitle">Digital Team Task Tracker</div>
          <div className="appSub">
            Signed in: {displayName} • {APP_VERSION}
          </div>
        </div>

        <div className="topActions">
          <button className="btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>

          {!isAuthenticated ? (
            <button className="btnPrimary" onClick={handleLogin}>
              Login
            </button>
          ) : (
            <button className="btn" onClick={handleLogout}>
              Logout
            </button>
          )}

          <span className="pill">{tasks.length} tasks</span>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === "dashboard" ? "tab active" : "tab"} onClick={() => setTab("dashboard")}>
          Dashboard
        </button>
        <button className={tab === "tasks" ? "tab active" : "tab"} onClick={() => setTab("tasks")}>
          Tasks
        </button>
        <button className={tab === "kanban" ? "tab active" : "tab"} onClick={() => setTab("kanban")}>
          Kanban
        </button>
        <button className={tab === "projects" ? "tab active" : "tab"} onClick={() => setTab("projects")}>
          Projects
        </button>

        <div style={{ flex: 1 }} />
        <button
          className="btnPrimary"
          onClick={() => {
            setEditingTask(null);
            setShowTaskModal(true);
          }}
        >
          + New Task
        </button>
      </nav>

      <main className="content">
        {!isLoading && tasksError ? (
          <div className="errorBar">Tasks API Error: {tasksError}</div>
        ) : null}

        {tab === "dashboard" && (
          <MiniDashboard
            tasks={tasks}
            myEmail={safeStr(user?.email)}
            myName={safeStr(user?.name || user?.email || "Me")}
          />
        )}

        {tab === "tasks" && (
          <TaskTable
            tasks={tasks}
            loading={loadingTasks}
            canEditAny={canEditAny}
            canEditTask={canEditTask}
            onEdit={(t) => {
              setEditingTask(t);
              setShowTaskModal(true);
            }}
            onDelete={(id) => deleteTask(id)}
          />
        )}

        {tab === "kanban" && (
          <KanbanBoard
            tasks={tasks}
            onUpdateTask={(t) => updateTask(t)}
            canEditAny={canEditAny}
            canEditTask={canEditTask}
          />
        )}

        {tab === "projects" && (
          <Projects
            tasks={tasks}
            canEditAny={canEditAny}
            myEmail={safeStr(user?.email)}
          />
        )}
      </main>

      {showTaskModal && (
        <Modal
          title={editingTask ? "Edit Task" : "Create a new task"}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
        >
          <TaskForm
            initialTask={editingTask}
            onCancel={() => {
              setShowTaskModal(false);
              setEditingTask(null);
            }}
            onSubmit={async (t) => {
              if (editingTask?.id) return updateTask({ ...editingTask, ...t });
              return createTask(t);
            }}
            canEditAny={canEditAny}
            myEmail={safeStr(user?.email)}
            myName={safeStr(user?.name || user?.email || "Me")}
          />
        </Modal>
      )}
    </div>
  );
}