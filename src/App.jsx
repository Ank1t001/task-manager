import { useEffect, useMemo, useState } from "react";
import MiniDashboard from "./components/MiniDashboard";
import TaskTable from "./components/TaskTable";
import TaskForm from "./components/TaskForm";
import Modal from "./components/Modal";

const STORAGE_KEY = "digital_team_task_tracker_v3";
const ADMIN_EMAIL = "ankit@digijabber.com";
const TEAM_DOMAIN = "equiton.com";

const TEAM = [
  { name: "Ankit", email: `ankit@${TEAM_DOMAIN}` },
  { name: "Sheel", email: `sheel@${TEAM_DOMAIN}` },
  { name: "Aditi", email: `aditi@${TEAM_DOMAIN}` },
  { name: "Jacob", email: `jacob@${TEAM_DOMAIN}` },
  { name: "Vanessa", email: `vanessa@${TEAM_DOMAIN}` },
  { name: "Mandeep", email: `mandeep@${TEAM_DOMAIN}` },
];

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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("dtt_theme", theme);
  }, [theme]);

  // One-time normalize stored tasks on mount
  useEffect(() => {
    const normalized = tasks.map(migrateTask);
    saveTasks(normalized);
    const changed = JSON.stringify(normalized) !== JSON.stringify(tasks);
    if (changed) setTasks(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  // ✅ Load Cloudflare Access identity
  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const data = await res.json();
        const email = normalizeEmail(data?.email);

        if (!alive) return;

        setUserEmail(email);

        const isAdmin = email === normalizeEmail(ADMIN_EMAIL);
        setRole(isAdmin ? "Admin" : "Member");

        // Name mapping:
        // 1) match from TEAM (equiton.com emails)
        // 2) fallback: if admin email is digijabber.com, still show "Ankit"
        const match = TEAM.find((m) => normalizeEmail(m.email) === email);
        if (match?.name) setUserName(match.name);
        else if (isAdmin) setUserName("Ankit");
        else setUserName("Member");
      } catch {
        if (!alive) return;
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

  const counts = useMemo(() => {
    return {
      overdue: tasks.filter((t) => isOverdue(t)).length,
      inProgress: tasks.filter((t) => t.status === "In Progress").length,
      blocked: tasks.filter((t) => t.status === "Blocked").length,
      done: tasks.filter((t) => t.status === "Done").length,
    };
  }, [tasks]);

  // ✅ Rule A permissions
  const isAdmin = normalizeEmail(userEmail) === normalizeEmail(ADMIN_EMAIL);
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

  function handleLogout() {
    const returnTo = window.location.origin + window.location.pathname;
    window.location.href = `/cdn-cgi/access/logout?returnTo=${encodeURIComponent(returnTo)}`;
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
                Signed in: {userEmail || "Unknown"} ({role}{userName ? `: ${userName}` : ""})
              </div>
            </div>

            <div className="dtt-actions">
              <button
                className="dtt-btn"
                onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              >
                {theme === "light" ? "Dark Mode" : "Light Mode"}
              </button>

              <button className="dtt-btn" type="button" onClick={handleLogout}>
                Logout
              </button>

              <button className="dtt-btn" type="button" onClick={handleExportCSV}>
                Export CSV
              </button>

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
          {tab === "dashboard" && <MiniDashboard counts={counts} theme={theme} />}

          {tab === "tasks" && (
            <TaskTable
              tasks={tasks}
              theme={theme}
              onDelete={onDelete}
              onUpdateTask={onUpdateTask}
              canEditAny={canEditAny}
              canEditTask={canEditTask}
            />
          )}

          {tab === "tasks" && tasks.length === 0 && (
            <div className="dtt-muted" style={{ marginTop: 12 }}>
              No tasks yet. Click <b>+ New Task</b> to add your first task.
            </div>
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