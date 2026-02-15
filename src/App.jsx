import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import MiniDashboard from "./components/MiniDashboard";
import TaskTable from "./components/TaskTable";
import TaskForm from "./components/TaskForm";
import Modal from "./components/Modal";

const BUILD_VERSION = "v13.1-auth0";
const ADMIN_EMAIL = "ankit@digijabber.com";

const normalizeEmail = (v = "") => String(v || "").trim().toLowerCase();

// ✅ Overdue rule (your latest definition)
function isOverdue(task) {
  const status = String(task?.status || "").trim();
  if (!task?.dueDate) return false;

  const overdueStatuses = new Set(["To Do", "In Progress"]); // Blocked removed per your latest requirement
  if (!overdueStatuses.has(status)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(String(task.dueDate) + "T00:00:00");
  return due < today;
}

function downloadCSV(filename, rows) {
  const headers = ["Task Name", "Description", "Owner", "Type", "Priority", "Due Date", "Status", "Stakeholders", "Project", "Stage"];
  const escape = (v) => {
    const s = String(v ?? "");
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [
    headers.join(","),
    ...rows.map((t) =>
      [
        t.taskName,
        t.description,
        t.owner,
        t.type ?? t.section,
        t.priority,
        t.dueDate,
        t.status,
        t.externalStakeholders,
        t.projectName,
        t.stage,
      ].map(escape).join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const { isAuthenticated, isLoading, user, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();

  const [theme, setTheme] = useState("light");
  const [tab, setTab] = useState("dashboard");
  const [showModal, setShowModal] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [tasksError, setTasksError] = useState("");

  // filters for TaskTable
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");

  const userEmail = normalizeEmail(user?.email || "");
  const userName = user?.name || (userEmail ? userEmail.split("@")[0] : "Unknown");
  const isAdmin = userEmail === normalizeEmail(ADMIN_EMAIL);

  const canEditAny = isAdmin;
  const canEditTask = useCallback(
    (task) => {
      if (isAdmin) return true;
      return normalizeEmail(task?.ownerEmail || "") === userEmail;
    },
    [isAdmin, userEmail]
  );

  const authFetch = useCallback(
    async (url, opts = {}) => {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const headers = new Headers(opts.headers || {});
      headers.set("Authorization", `Bearer ${token}`);
      headers.set("Content-Type", headers.get("Content-Type") || "application/json");

      return fetch(url, { ...opts, headers, cache: "no-store" });
    },
    [getAccessTokenSilently]
  );

  // Load tasks
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setTasksError("");

      if (!isAuthenticated) {
        setTasks([]);
        return;
      }

      try {
        // optional: confirm auth works
        const meRes = await authFetch("/api/me");
        if (!meRes.ok) throw new Error(`ME ${meRes.status}`);
        // const me = await meRes.json();

        const res = await authFetch("/api/tasks");
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Tasks API Error: ${res.status} ${txt}`);
        }
        const data = await res.json();
        if (!cancelled) setTasks(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          setTasks([]);
          setTasksError(String(e?.message || e));
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authFetch]);

  // derived sets
  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      const matchesQuery =
        !q ||
        String(t.taskName || "").toLowerCase().includes(q) ||
        String(t.description || "").toLowerCase().includes(q) ||
        String(t.type || t.section || "").toLowerCase().includes(q) ||
        String(t.externalStakeholders || "").toLowerCase().includes(q);

      const matchesStatus = statusFilter === "All" || String(t.status) === statusFilter;
      const matchesOwner = ownerFilter === "All" || String(t.owner) === ownerFilter;

      return matchesQuery && matchesStatus && matchesOwner;
    });
  }, [tasks, query, statusFilter, ownerFilter]);

  const allOwnerOptions = useMemo(() => {
    const set = new Set(["All"]);
    for (const t of tasks) if (t.owner) set.add(t.owner);
    return Array.from(set);
  }, [tasks]);

  const allTypeOptions = useMemo(() => {
    const set = new Set(["All"]);
    for (const t of tasks) set.add(t.type || t.section || "Other");
    return Array.from(set);
  }, [tasks]);

  // dashboard counts (Blocked removed everywhere)
  const teamCounts = useMemo(() => {
    const total = tasks.length;
    const overdue = tasks.filter((t) => isOverdue(t)).length;
    const inProgress = tasks.filter((t) => String(t.status) === "In Progress" && !isOverdue(t)).length;
    const done = tasks.filter((t) => String(t.status) === "Done").length;
    return { total, overdue, inProgress, done };
  }, [tasks]);

  const myTasks = useMemo(() => {
    if (!userEmail) return [];
    return tasks.filter((t) => normalizeEmail(t.ownerEmail || "") === userEmail);
  }, [tasks, userEmail]);

  const myCounts = useMemo(() => {
    const total = myTasks.length;
    const overdue = myTasks.filter((t) => isOverdue(t)).length;
    const inProgress = myTasks.filter((t) => String(t.status) === "In Progress" && !isOverdue(t)).length;
    const done = myTasks.filter((t) => String(t.status) === "Done").length;
    return { total, overdue, inProgress, done };
  }, [myTasks]);

  // CRUD
  async function createTask(payload) {
    const res = await authFetch("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(await res.text());
    const out = await res.json();
    // refresh quickly
    setTasks((prev) => [out.task, ...prev]);
  }

  async function updateTask(id, payload) {
    const res = await authFetch(`/api/tasks?id=${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(await res.text());
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...payload } : t)));
  }

  async function deleteTask(id) {
    const res = await authFetch(`/api/tasks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function handleLogin() {
    loginWithRedirect();
  }

  function handleLogout() {
    logout({ logoutParams: { returnTo: window.location.origin + "/" } });
  }

  function handleExportCSV() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`tasks_${stamp}.csv`, filteredTasks);
  }

  return (
    <div className="dtt-page" data-theme={theme}>
      <div className="dtt-shell">
        {/* HEADER */}
        <div className="dtt-card">
          <div className="dtt-titleRow" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="dtt-dot" />
                <div className="dtt-h1">Digital Team Task Tracker</div>
              </div>

              <div className="dtt-muted" style={{ marginTop: 6 }}>
                Signed in: {isAuthenticated ? userEmail : "Not signed in"} • {BUILD_VERSION}
              </div>

              {tasksError ? (
                <div style={{ marginTop: 10, color: "rgba(220,38,38,0.95)", fontWeight: 800 }}>
                  {tasksError}
                </div>
              ) : null}
            </div>

            <div className="dtt-actions">
              <button className="dtt-btn" onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}>
                {theme === "light" ? "Dark Mode" : "Light Mode"}
              </button>

              {!isAuthenticated ? (
                <button className="dtt-btnPrimary" onClick={handleLogin} disabled={isLoading}>
                  Login
                </button>
              ) : (
                <>
                  <button className="dtt-btn" onClick={handleLogout}>
                    Logout
                  </button>
                  <button className="dtt-btn" onClick={handleExportCSV}>
                    Export CSV
                  </button>
                </>
              )}

              <span className="dtt-pill">{tasks.length} tasks</span>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="dtt-tabsRow">
          <div className="dtt-tabs">
            <button className={`dtt-tab ${tab === "dashboard" ? "dtt-tabActive" : ""}`} onClick={() => setTab("dashboard")}>
              Dashboard
            </button>
            <button className={`dtt-tab ${tab === "tasks" ? "dtt-tabActive" : ""}`} onClick={() => setTab("tasks")}>
              Tasks
            </button>
          </div>

          <button className="dtt-btnPrimary" onClick={() => setShowModal(true)} disabled={!isAuthenticated}>
            + New Task
          </button>
        </div>

        {/* CONTENT */}
        <div className="dtt-card">
          {tab === "dashboard" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <MiniDashboard title="Overall Team" counts={teamCounts} theme={theme} />
              <MiniDashboard title="My Tasks" counts={myCounts} theme={theme} />
            </div>
          ) : (
            <TaskTable
              tasks={filteredTasks}
              allOwnerOptions={allOwnerOptions}
              allTypeOptions={allTypeOptions}
              query={query}
              setQuery={setQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              ownerFilter={ownerFilter}
              setOwnerFilter={setOwnerFilter}
              onDelete={(id) => deleteTask(id).catch((e) => setTasksError(String(e.message || e)))}
              onEdit={(task) => {
                // prefilled edit modal handled inside TaskForm if you already wired it;
                // simplest approach: open modal and pass initialTask.
                setShowModal(task);
              }}
              canEditAny={canEditAny}
              canEditTask={canEditTask}
            />
          )}
        </div>

        {/* MODAL */}
        {!!showModal && (
          <Modal onClose={() => setShowModal(false)}>
            <TaskForm
              initialTask={typeof showModal === "object" ? showModal : null}
              isEdit={typeof showModal === "object"}
              onCancel={() => setShowModal(false)}
              onSubmit={async (payload) => {
                try {
                  if (typeof showModal === "object") {
                    await updateTask(showModal.id, payload);
                  } else {
                    await createTask(payload);
                  }
                  setShowModal(false);
                } catch (e) {
                  setTasksError(String(e.message || e));
                }
              }}
            />
          </Modal>
        )}
      </div>
    </div>
  );
}