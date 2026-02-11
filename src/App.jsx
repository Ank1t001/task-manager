import { useEffect, useMemo, useState } from "react";
import MiniDashboard from "./components/MiniDashboard";
import TaskTable from "./components/TaskTable";
import TaskForm from "./components/TaskForm";
import Modal from "./components/Modal";

const STORAGE_KEY = "digital_team_task_tracker_v3";
const ADMIN_EMAIL = "ankit@digijabber.com";
const BUILD_VERSION = "v7.2.5";

// Email -> Display name mapping (adjust if needed)
const TEAM_MAP = {
  "ankit@digijabber.com": "Ankit",
  "AKumar@equiton.com": "Ankit",
  "SPatel@equiton.com": "Sheel",
  "ASharma@equiton.com": "Aditi",
  "JIlton@equiton.com": "Jacob",
  "VEbhohimhen@equiton.com": "Vanessa",
  "MSuri@equiton.com": "Mandeep",
};

const normalizeEmail = (v = "") => String(v).trim().toLowerCase();

function migrateTask(t) {
  const taskName = t.taskName ?? t.title ?? "";
  const status = t.status === "Open" ? "To Do" : (t.status || "To Do");

  return {
    ...t,
    id: t.id || crypto.randomUUID(),
    taskName,
    owner: t.owner || "Ankit",
    section: t.section || "Other",
    priority: t.priority || "Medium",
    dueDate: t.dueDate || "",
    status,
    externalStakeholders: t.externalStakeholders || "",
    subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
    createdAt: t.createdAt || new Date().toISOString(),
    updatedAt: t.updatedAt || "",
  };
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(migrateTask) : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function isOverdue(task) {
  if (!task?.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate + "T00:00:00");
  return due < today && task.status !== "Done";
}

function downloadCSV(filename, rows) {
  const headers = [
    "Task Name",
    "Owner",
    "Section",
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
        t.owner,
        t.section,
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
  const [tasks, setTasks] = useState(loadTasks);
  const [showModal, setShowModal] = useState(false);

  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("Member");
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("dtt_theme", theme);
  }, [theme]);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  // one-time migrate stored tasks
  useEffect(() => {
    const normalized = tasks.map(migrateTask);
    const changed = JSON.stringify(normalized) !== JSON.stringify(tasks);
    if (changed) {
      setTasks(normalized);
      saveTasks(normalized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // identity from /api/me (returns 401 if not authed)
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

  // ✅ Overall Team counts
  const teamCounts = useMemo(() => {
    return {
      overdue: tasks.filter((t) => isOverdue(t)).length,
      inProgress: tasks.filter((t) => t.status === "In Progress").length,
      blocked: tasks.filter((t) => t.status === "Blocked").length,
      done: tasks.filter((t) => t.status === "Done").length,
    };
  }, [tasks]);

  // ✅ My tasks (owner === userName)
  const myTasks = useMemo(() => {
    const me = (userName || "").trim();
    if (!me) return [];
    return tasks.filter((t) => (t.owner || "").trim() === me);
  }, [tasks, userName]);

  const myCounts = useMemo(() => {
    return {
      overdue: myTasks.filter((t) => isOverdue(t)).length,
      inProgress: myTasks.filter((t) => t.status === "In Progress").length,
      blocked: myTasks.filter((t) => t.status === "Blocked").length,
      done: myTasks.filter((t) => t.status === "Done").length,
    };
  }, [myTasks]);

  const isAdmin = normalizeEmail(userEmail) === normalizeEmail(ADMIN_EMAIL);

  // Rule A permissions
  const canEditAny = isAdmin;
  const canEditTask = (task) => {
    if (isAdmin) return true;
    return (task?.owner || "").trim() === (userName || "").trim();
  };

  function onDelete(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function onUpdateTask(updated) {
    if (!updated?.id) return;
    const nextUpdated = { ...migrateTask(updated), updatedAt: new Date().toISOString() };

    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === nextUpdated.id);
      if (idx === -1) return [nextUpdated, ...prev];
      const next = [...prev];
      next[idx] = nextUpdated;
      return next;
    });
  }

  function handleLogin() {
    // Access protects /api/*, so go there to trigger OTP
    window.location.href = "/api/login?redirectTo=/";
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

              <span className="dtt-pill">{tasks.length} tasks</span>
            </div>
          </div>
        </div>

        {/* TABS */}
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

        {/* CONTENT */}
        <div className="dtt-card">
          {tab === "dashboard" && (
            <div style={{ display: "grid", gap: 14 }}>
              {/* Overall Team */}
              <div className="dtt-card" style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>Overall Team</div>
                  <div className="dtt-muted">{tasks.length} total tasks</div>
                </div>
              </div>

              <MiniDashboard title="Overall Team" counts={teamCounts} theme={theme} />

              {/* My Tasks */}
              <div className="dtt-card" style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>My Tasks</div>
                  <div className="dtt-muted">
                    Owner: <b>{userName || "Unknown"}</b> • {myTasks.length} tasks
                  </div>
                </div>
              </div>

<MiniDashboard title="My Tasks" counts={myCounts} theme={theme} />

              <div className="dtt-muted" style={{ marginTop: 2 }}>
                Debug: tasks={tasks.length}, myTasks={myTasks.length}, authed={String(isAuthed)}
              </div>
            </div>
          )}

          {tab === "tasks" && (
            <>
              {tasks.length === 0 ? (
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

        {/* MODAL */}
        <Modal
          open={showModal}
          title="Create a new task"
          subtitle="Fill details and save."
          onClose={() => setShowModal(false)}
        >
          <TaskForm
            onSubmit={(task) => {
              const finalTask = migrateTask({
                ...task,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
              });
              setTasks((prev) => [finalTask, ...prev]);
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