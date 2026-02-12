import { useEffect, useMemo, useState } from "react";
import MiniDashboard from "./components/MiniDashboard";
import TaskTable from "./components/TaskTable";
import TaskForm from "./components/TaskForm";
import Modal from "./components/Modal";

const ADMIN_EMAIL = "ankit@digijabber.com";
const BUILD_VERSION = "v8.0-d1-backed";

// Email -> Display name mapping
const TEAM_MAP = {
  "ankit@digijabber.com": "Ankit",
  "ankit@equiton.com": "Ankit",
  "sheelp@equiton.com": "Sheel",
  "aditi@equiton.com": "Aditi",
  "jacob@equiton.com": "Jacob",
  "vanessa@equiton.com": "Vanessa",
  "mandeep@equiton.com": "Mandeep",
};

const normalizeEmail = (v = "") => String(v).trim().toLowerCase();

/** -----------------------------
 *  Dashboard metric rules helpers
 *  ----------------------------- */
function statusKey(status = "") {
  // "To-do", "To Do" -> "todo" | "In progress" -> "inprogress"
  return String(status).trim().toLowerCase().replace(/[\s-]+/g, "");
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dueDateAsDate(dueDate) {
  if (!dueDate) return null; // YYYY-MM-DD
  const d = new Date(`${dueDate}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function isPastDue(task) {
  const due = dueDateAsDate(task?.dueDate);
  if (!due) return false; // no due date => NOT overdue
  return due < startOfToday(); // yesterday or earlier
}

function isOverdueBucket(task) {
  const s = statusKey(task?.status);
  const active = s === "todo" || s === "inprogress" || s === "blocked";
  return active && isPastDue(task);
}

function computeDashboardCounts(taskList) {
  // Critical Rule: past due + (todo/inprogress/blocked) MUST be overdue and excluded elsewhere
  let overdue = 0;
  let inProgress = 0;
  let blocked = 0;
  let done = 0;

  for (const t of taskList) {
    const s = statusKey(t?.status);

    if (isOverdueBucket(t)) {
      overdue++;
      continue;
    }

    if (s === "done") {
      done++;
      continue;
    }

    // Not overdue (today/future or empty dueDate)
    if (s === "inprogress") inProgress++;
    else if (s === "blocked") blocked++;
  }

  return { overdue, inProgress, blocked, done };
}

/** -----------------------------
 *  Map DB row <-> UI task object
 *  DB uses: type
 *  UI uses: section (label shown as "Type" in UI)
 *  ----------------------------- */
function dbRowToUiTask(row) {
  return {
    id: row.id,
    taskName: row.taskName || "",
    description: row.description || "",
    owner: row.owner || "Ankit",
    ownerEmail: row.ownerEmail || "",
    section: row.type || "Other", // map DB type -> UI section
    priority: row.priority || "Medium",
    status: row.status || "To Do",
    dueDate: row.dueDate || "",
    externalStakeholders: row.externalStakeholders || "",
    createdAt: row.createdAt || "",
    updatedAt: row.updatedAt || "",
  };
}

function uiTaskToDbPayload(task) {
  return {
    id: task.id,
    taskName: task.taskName || "",
    description: task.description || "",
    owner: task.owner || "",
    ownerEmail: task.ownerEmail || "",
    type: task.section || "Other", // map UI section -> DB type
    priority: task.priority || "Medium",
    status: task.status || "To Do",
    dueDate: task.dueDate || "",
    externalStakeholders: task.externalStakeholders || "",
  };
}

/** -----------------------------
 *  CSV Export
 *  ----------------------------- */
function downloadCSV(filename, rows) {
  const headers = [
    "Task Name",
    "Task Description",
    "Owner",
    "Owner Email",
    "Type",
    "Priority",
    "Due Date",
    "Status",
    "External Stakeholders",
    "Created At",
    "Updated At",
  ];

  const escape = (v) => {
    const s = String(v ?? "");
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((t) =>
      [
        t.taskName,
        t.description,
        t.owner,
        t.ownerEmail,
        t.section, // Type
        t.priority,
        t.dueDate,
        t.status,
        t.externalStakeholders,
        t.createdAt,
        t.updatedAt,
      ]
        .map(escape)
        .join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
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
  const [theme, setTheme] = useState(localStorage.getItem("dtt_theme") || "light");
  const [tab, setTab] = useState("dashboard");
  const [tasks, setTasks] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("Member");
  const [isAuthed, setIsAuthed] = useState(false);

  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState("");

  // Theme
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("dtt_theme", theme);
  }, [theme]);

  /** -----------------------------
   *  Identity from /api/me
   *  ----------------------------- */
  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });

        if (res.status === 401) {
          if (!alive) return;
          setIsAuthed(false);
          setUserEmail("");
          setUserName("");
          setRole("Member");
          return;
        }

        const data = await res.json();
        const email = normalizeEmail(data?.email);

        if (!alive) return;

        setIsAuthed(true);
        setUserEmail(email);

        const isAdmin = email === normalizeEmail(ADMIN_EMAIL);
        setRole(isAdmin ? "Admin" : "Member");

        const mapped = TEAM_MAP[email];
        const fallback = email ? email.split("@")[0] : "Member";
        setUserName(mapped || fallback);
      } catch {
        if (!alive) return;
        setIsAuthed(false);
        setUserEmail("");
        setUserName("");
        setRole("Member");
      }
    }

    loadMe();
    return () => {
      alive = false;
    };
  }, []);

  /** -----------------------------
   *  Load tasks from D1 via /api/tasks
   *  ----------------------------- */
  async function loadTasks() {
    try {
      setLoadingTasks(true);
      setTasksError("");

      const res = await fetch("/api/tasks", { cache: "no-store" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to load tasks (${res.status}) ${txt}`);
      }

      const data = await res.json();
      const uiTasks = Array.isArray(data) ? data.map(dbRowToUiTask) : [];
      setTasks(uiTasks);
    } catch (e) {
      setTasks([]);
      setTasksError(e?.message || "Failed to load tasks");
    } finally {
      setLoadingTasks(false);
    }
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** -----------------------------
   *  CRUD helpers
   *  ----------------------------- */
  async function createTask(uiTask) {
    const payload = uiTaskToDbPayload(uiTask);

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Create failed (${res.status}) ${txt}`);
    }
    await loadTasks();
  }

  async function updateTask(uiTask) {
    const payload = uiTaskToDbPayload(uiTask);

    const res = await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Update failed (${res.status}) ${txt}`);
    }
    await loadTasks();
  }

  async function deleteTask(id) {
    const res = await fetch(`/api/tasks?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Delete failed (${res.status}) ${txt}`);
    }
    await loadTasks();
  }

  /** -----------------------------
   *  Dashboard: Team vs My Tasks
   *  ----------------------------- */
  const teamCounts = useMemo(() => computeDashboardCounts(tasks), [tasks]);

  const myTasks = useMemo(() => {
    const me = (userName || "").trim();
    if (!me) return [];
    return tasks.filter((t) => (t.owner || "").trim() === me);
  }, [tasks, userName]);

  const myCounts = useMemo(() => computeDashboardCounts(myTasks), [myTasks]);

  /** -----------------------------
   *  Permissions (Rule A)
   *  ----------------------------- */
  const isAdmin = normalizeEmail(userEmail) === normalizeEmail(ADMIN_EMAIL);
  const canEditAny = isAdmin;

  const canEditTask = (task) => {
    if (isAdmin) return true;
    return (task?.owner || "").trim() === (userName || "").trim();
  };

  /** -----------------------------
   *  UI event handlers
   *  ----------------------------- */
  async function onDelete(id) {
    await deleteTask(id);
  }

  async function onUpdateTask(updated) {
    if (!updated?.id) return;
    await updateTask(updated);
  }

  function handleLogin() {
    const returnTo = window.location.origin + "/";
    window.location.href = `/api/login?returnTo=${encodeURIComponent(returnTo)}`;
  }

  function handleLogout() {
    const returnTo = window.location.origin + "/";
    window.location.href = `/api/logout?returnTo=${encodeURIComponent(returnTo)}`;
  }

  function handleExportCSV() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`tasks_${stamp}.csv`, tasks);
  }

  return (
    <div className="dtt-page">
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
                Signed in: {userEmail || "Unknown"} ({role}
                {userName ? `: ${userName}` : ""}) • {BUILD_VERSION}
              </div>
            </div>

            <div className="dtt-actions">
              <button
                className="dtt-btn"
                onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              >
                {theme === "light" ? "Dark Mode" : "Light Mode"}
              </button>

              {!isAuthed ? (
                <button className="dtt-btnPrimary" onClick={handleLogin}>
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

              <span className="dtt-pill">
                {loadingTasks ? "Loading…" : `${tasks.length} tasks`}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="dtt-tabsRow">
          <div className="dtt-tabs">
            <button
              className={`dtt-tab ${tab === "dashboard" ? "dtt-tabActive" : ""}`}
              onClick={() => setTab("dashboard")}
            >
              Dashboard
            </button>

            <button
              className={`dtt-tab ${tab === "tasks" ? "dtt-tabActive" : ""}`}
              onClick={() => setTab("tasks")}
            >
              Tasks
            </button>
          </div>

          <button className="dtt-btnPrimary" onClick={() => setShowModal(true)}>
            + New Task
          </button>
        </div>

        {/* Content */}
        <div className="dtt-card">
          {tasksError ? (
            <div className="dtt-muted">
              <b>Tasks API Error:</b> {tasksError}
            </div>
          ) : null}

          {tab === "dashboard" && (
            <div style={{ display: "grid", gap: 14 }}>
              <div className="dtt-card" style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>Overall Team</div>
                  <div className="dtt-muted">{tasks.length} total tasks</div>
                </div>
              </div>

              <MiniDashboard counts={teamCounts} theme={theme} />

              <div className="dtt-card" style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>My Tasks</div>
                  <div className="dtt-muted">
                    Owner: <b>{userName || "Unknown"}</b> • {myTasks.length} tasks
                  </div>
                </div>
              </div>

              <MiniDashboard counts={myCounts} theme={theme} />

              <div className="dtt-muted" style={{ marginTop: 2 }}>
                Debug: tasks={tasks.length}, myTasks={myTasks.length}, authed={String(isAuthed)}
              </div>
            </div>
          )}

          {tab === "tasks" && (
            <>
              {loadingTasks ? (
                <div className="dtt-muted">Loading tasks…</div>
              ) : tasks.length === 0 ? (
                <div className="dtt-muted">No tasks yet. Click + New Task to create one.</div>
              ) : (
                <TaskTable
                  tasks={tasks}
                  onDelete={onDelete}
                  onUpdateTask={onUpdateTask}
                  canEditAny={canEditAny}
                  canEditTask={canEditTask}
                />
              )}
            </>
          )}
        </div>

        {/* Modal */}
        <Modal
          open={showModal}
          title="Create a new task"
          subtitle="Fill details and save."
          onClose={() => setShowModal(false)}
        >
          <TaskForm
            onSubmit={async (task) => {
              // TaskForm gives: taskName, description, owner, section, priority, status, dueDate, externalStakeholders
              // Build DB payload fields:
              const ownerEmailGuess = ""; // optional; we will map from owner below
              const ownerEmail = ownerEmailFromOwner(task.owner) || ownerEmailGuess;

              await createTask({
                ...task,
                ownerEmail,
              });

              setShowModal(false);
              setTab("tasks");
            }}
            onCancel={() => setShowModal(false)}
          />
        </Modal>
      </div>
    </div>
  );
}

/** Owner -> Email mapping for DB writes.
 *  Update these if emails differ.
 */
function ownerEmailFromOwner(owner) {
  const o = String(owner || "").trim().toLowerCase();
  if (!o) return "";

  // Adjust to your real emails:
  if (o === "ankit") return "ankit@digijabber.com";
  if (o === "sheel") return "sheelp@equiton.com";
  if (o === "aditi") return "aditi@equiton.com";
  if (o === "jacob") return "jacob@equiton.com";
  if (o === "vanessa") return "vanessa@equiton.com";
  if (o === "mandeep") return "mandeep@equiton.com";

  return "";
}