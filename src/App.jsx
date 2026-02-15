// src/App.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import MiniDashboard from "./MiniDashboard.jsx";
import TaskTable from "./TaskTable.jsx";
import Modal from "./Modal.jsx";
import TaskForm from "./TaskForm.jsx";

const APP_VERSION = "v13.0-auth0-fix";

function normalizeUser(u) {
  if (!u) return { name: "Unknown", email: "" };
  return {
    name: u.name || u.nickname || (u.email ? u.email.split("@")[0] : "Unknown"),
    email: u.email || "",
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

  const me = useMemo(() => normalizeUser(user), [user]);

  const [tab, setTab] = useState("dashboard");

  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [apiError, setApiError] = useState("");

  const [darkMode, setDarkMode] = useState(false);

  // Modal state for create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Filters (table)
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");

  async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");

    if (isAuthenticated) {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(path, { ...options, headers });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${res.status} ${txt}`);
    }
    return res;
  }

  async function loadTasks() {
    setLoadingTasks(true);
    setApiError("");
    try {
      const res = await apiFetch("/api/tasks", { method: "GET" });
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      setTasks([]);
      setApiError(String(e.message || e));
    } finally {
      setLoadingTasks(false);
    }
  }

  useEffect(() => {
    // keep UI light by default unless user toggles
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  useEffect(() => {
    // Only load tasks after auth is resolved
    if (!isLoading && isAuthenticated) loadTasks();
    if (!isLoading && !isAuthenticated) {
      setTasks([]);
      setApiError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated]);

  const canEditAny = false; // SaaS: later drive from roles/claims
  const canEditTask = (t) => (t?.ownerEmail || "").toLowerCase() === (me.email || "").toLowerCase();

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      const matchesQ =
        !q ||
        (t.taskName || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.type || t.section || "").toLowerCase().includes(q) ||
        (t.externalStakeholders || "").toLowerCase().includes(q);

      const matchesStatus = statusFilter === "All" || (t.status || "") === statusFilter;
      const matchesOwner = ownerFilter === "All" || (t.owner || "") === ownerFilter;

      return matchesQ && matchesStatus && matchesOwner;
    });
  }, [tasks, query, statusFilter, ownerFilter]);

  const ownerOptions = useMemo(() => {
    const set = new Set(["All"]);
    tasks.forEach((t) => t.owner && set.add(t.owner));
    return Array.from(set);
  }, [tasks]);

  const typeOptions = useMemo(() => {
    const set = new Set(["All"]);
    tasks.forEach((t) => (t.type || t.section) && set.add(t.type || t.section));
    return Array.from(set);
  }, [tasks]);

  async function handleDelete(id) {
    if (!id) return;
    try {
      await apiFetch(`/api/tasks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadTasks();
    } catch (e) {
      setApiError(String(e.message || e));
    }
  }

  function handleEdit(task) {
    setEditingTask(task);
    setModalOpen(true);
  }

  function handleNew() {
    setEditingTask(null);
    setModalOpen(true);
  }

  async function handleSaveTask(payload) {
    try {
      if (editingTask?.id) {
        // update
        await apiFetch(`/api/tasks?id=${encodeURIComponent(editingTask.id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        // create
        await apiFetch("/api/tasks", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      setEditingTask(null);
      await loadTasks();
    } catch (e) {
      setApiError(String(e.message || e));
    }
  }

  async function exportCSV() {
    try {
      const rows = tasks;
      const cols = ["taskName", "description", "owner", "ownerEmail", "type", "priority", "status", "dueDate", "externalStakeholders"];
      const escape = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
      const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => escape(r[c])).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tasks.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setApiError(String(e.message || e));
    }
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="dtt-shell">
        {/* Header */}
        <div className="dtt-header">
          <div>
            <div className="dtt-title">Digital Team Task Tracker</div>
            <div className="dtt-muted">
              Signed in: {isAuthenticated ? `${me.email} (${me.name})` : "Not signed in"} • {APP_VERSION}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="dtt-btn" onClick={() => setDarkMode((v) => !v)}>
              {darkMode ? "Light Mode" : "Dark Mode"}
            </button>

            {!isAuthenticated ? (
              <button className="dtt-btn dtt-btn-primary" onClick={() => loginWithRedirect()}>
                Login
              </button>
            ) : (
              <button
                className="dtt-btn"
                onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
              >
                Logout
              </button>
            )}

            <button className="dtt-btn" disabled={!isAuthenticated} onClick={exportCSV}>
              Export CSV
            </button>

            <span className="dtt-pill">{tasks.length} tasks</span>
          </div>
        </div>

        {/* Tabs + action */}
        <div className="dtt-tabs-row">
          <div style={{ display: "flex", gap: 10 }}>
            <button className={`dtt-tab ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>
              Dashboard
            </button>
            <button className={`dtt-tab ${tab === "tasks" ? "active" : ""}`} onClick={() => setTab("tasks")}>
              Tasks
            </button>
            <button className={`dtt-tab ${tab === "kanban" ? "active" : ""}`} onClick={() => setTab("kanban")}>
              Kanban
            </button>
            <button className={`dtt-tab ${tab === "projects" ? "active" : ""}`} onClick={() => setTab("projects")}>
              Projects
            </button>
          </div>

          <button className="dtt-btn dtt-btn-primary" disabled={!isAuthenticated} onClick={handleNew}>
            + New Task
          </button>
        </div>

        {/* API error */}
        {apiError ? (
          <div className="dtt-alert">
            <strong>Tasks API Error:</strong> {apiError}
          </div>
        ) : null}

        {/* Views */}
        {tab === "dashboard" && (
          <MiniDashboard
            tasks={tasks}
            me={me}
          />
        )}

        {tab === "tasks" && (
          <>
            {loadingTasks ? <div className="dtt-muted">Loading tasks…</div> : null}
            <TaskTable
              tasks={filteredTasks}
              allOwnerOptions={ownerOptions}
              allTypeOptions={typeOptions}
              query={query}
              setQuery={setQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              ownerFilter={ownerFilter}
              setOwnerFilter={setOwnerFilter}
              onDelete={handleDelete}
              onEdit={handleEdit}
              canEditAny={canEditAny}
              canEditTask={canEditTask}
            />
          </>
        )}

        {tab === "kanban" && (
          <div className="dtt-card" style={{ padding: 18 }}>
            <div className="dtt-muted">Kanban view can stay as-is for now (auth is the priority).</div>
          </div>
        )}

        {tab === "projects" && (
          <div className="dtt-card" style={{ padding: 18 }}>
            <div className="dtt-muted">Projects view can stay as-is for now (auth + tenant isolation first).</div>
          </div>
        )}
      </div>

      {/* Modal (Create/Edit) */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingTask(null); }}>
        <TaskForm
          mode={editingTask ? "edit" : "create"}
          initialTask={editingTask}
          currentUser={me}
          onCancel={() => { setModalOpen(false); setEditingTask(null); }}
          onSave={handleSaveTask}
        />
      </Modal>
    </div>
  );
}