import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import MiniDashboard from "./MiniDashboard";
import TaskTable from "./TaskTable";
import KanbanBoard from "./KanbanBoard";
import Projects from "./Projects";
import Modal from "./Modal";
import TaskForm from "./TaskForm";

const APP_VERSION = "v13.1-auth0-fixed";

export default function App() {
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const [tab, setTab] = useState("dashboard"); // dashboard | tasks | kanban | projects
  const [tasks, setTasks] = useState([]);
  const [me, setMe] = useState(null);
  const [apiError, setApiError] = useState("");

  const [darkMode, setDarkMode] = useState(false); // default LIGHT
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);

  // ---- Authenticated API helper (Bearer token)
  const apiFetch = async (path, options = {}) => {
    const token = await getAccessTokenSilently();
    const res = await fetch(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg = typeof data === "object" && data?.error ? data.error : res.statusText;
      throw new Error(`${res.status} ${msg}`);
    }
    return data;
  };

  // ---- On login: bootstrap tenant + load /me + /tasks
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setApiError("");

      if (!isAuthenticated) {
        setMe(null);
        setTasks([]);
        return;
      }

      try {
        // Ensure tenant exists (idempotent)
        await apiFetch("/api/tenants/bootstrap", {
          method: "POST",
          body: JSON.stringify({ name: "My Workspace" }),
        });

        const meData = await apiFetch("/api/me");
        const tasksData = await apiFetch("/api/tasks");

        if (!cancelled) {
          setMe(meData);
          setTasks(Array.isArray(tasksData) ? tasksData : []);
        }
      } catch (e) {
        if (!cancelled) {
          setApiError(String(e.message || e));
          setMe(null);
          setTasks([]);
        }
      }
    };

    if (!isLoading) run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading]);

  const signedInLabel = useMemo(() => {
    if (!isAuthenticated) return "Not signed in";
    const nm = user?.name || user?.email || "User";
    const role = me?.role ? String(me.role) : "member";
    return `${nm} (${role})`;
  }, [isAuthenticated, user, me]);

  // ---- Metrics (Total / Overdue / In Progress / Done)
  const metrics = useMemo(() => {
    const total = tasks.length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = tasks.filter((t) => {
      const s = (t.status || "").toLowerCase();
      const due = (t.dueDate || "").trim();
      if (!due) return false;
      const d = new Date(`${due}T00:00:00`);
      return d < today && (s === "to do" || s === "todo" || s === "in progress" || s === "blocked");
    }).length;

    const inProgress = tasks.filter((t) => {
      const s = (t.status || "").toLowerCase();
      if (s !== "in progress") return false;
      // exclude overdue
      const due = (t.dueDate || "").trim();
      if (!due) return true;
      const d = new Date(`${due}T00:00:00`);
      return d >= today;
    }).length;

    const done = tasks.filter((t) => (t.status || "").toLowerCase() === "done").length;

    return { total, overdue, inProgress, done };
  }, [tasks]);

  const handleLogin = async () => {
    await loginWithRedirect();
  };

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin + "/" } });
  };

  const openNewTask = () => {
    setEditTask(null);
    setShowTaskModal(true);
  };

  const openEditTask = (t) => {
    setEditTask(t);
    setShowTaskModal(true);
  };

  const saveTask = async (payload) => {
    try {
      if (!isAuthenticated) throw new Error("Please login first.");

      if (payload.id) {
        await apiFetch("/api/tasks", { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
      }

      const tasksData = await apiFetch("/api/tasks");
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setShowTaskModal(false);
      setEditTask(null);
    } catch (e) {
      setApiError(String(e.message || e));
    }
  };

  const deleteTask = async (id) => {
    try {
      await apiFetch(`/api/tasks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const tasksData = await apiFetch("/api/tasks");
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (e) {
      setApiError(String(e.message || e));
    }
  };

  return (
    <div className={darkMode ? "app dark" : "app"}>
      <div className="shell">
        <header className="topbar">
          <div>
            <div className="title">Digital Team Task Tracker</div>
            <div className="sub">
              Signed in: {signedInLabel} • {APP_VERSION}
            </div>
          </div>

          <div className="top-actions">
            <button className="btn" type="button" onClick={() => setDarkMode((v) => !v)}>
              {darkMode ? "Light Mode" : "Dark Mode"}
            </button>

            {!isAuthenticated ? (
              <button className="btn primary" type="button" onClick={handleLogin}>
                Login
              </button>
            ) : (
              <button className="btn" type="button" onClick={handleLogout}>
                Logout
              </button>
            )}

            <div className="pill">{tasks.length} tasks</div>
          </div>
        </header>

        {apiError ? <div className="error">API Error: {apiError}</div> : null}

        <div className="tabs">
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

          <div className="tabs-right">
            <button className="btn primary" type="button" onClick={openNewTask} disabled={!isAuthenticated}>
              + New Task
            </button>
          </div>
        </div>

        {tab === "dashboard" && (
          <MiniDashboard
            tasks={tasks}
            meEmail={user?.email || ""}
            metrics={metrics}
          />
        )}

        {tab === "tasks" && (
          <TaskTable
            tasks={tasks}
            onEdit={openEditTask}
            onDelete={deleteTask}
            canEditAny={me?.role === "owner"}
            currentUserEmail={user?.email || ""}
          />
        )}

        {tab === "kanban" && (
          <KanbanBoard
            tasks={tasks}
            onUpdateTask={saveTask}
            canEditAny={me?.role === "owner"}
            currentUserEmail={user?.email || ""}
          />
        )}

        {tab === "projects" && <Projects />}

        {showTaskModal && (
          <Modal onClose={() => setShowTaskModal(false)} title={editTask ? "Edit task" : "Create a new task"}>
            <TaskForm
              initial={editTask}
              onCancel={() => setShowTaskModal(false)}
              onSave={saveTask}
              currentUser={{
                name: user?.name || "",
                email: user?.email || "",
                role: me?.role || "member",
              }}
            />
          </Modal>
        )}
      </div>
    </div>
  );
}