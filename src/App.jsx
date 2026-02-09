import { useEffect, useMemo, useState } from "react";
import MiniDashboard from "./components/MiniDashboard";
import TaskTable from "./components/TaskTable";
import TaskForm from "./components/TaskForm";
import Modal from "./components/Modal";

const STORAGE_KEY = "digital_team_task_tracker_v3";

// ✅ Role config
const ADMIN_EMAIL = "ankit@digijabber.com";
const TEAM_DOMAIN = "digijabber.com";

// names must match your Owner dropdown values (owners.js)
const TEAM = [
  { name: "Ankit", email: `ankit@${TEAM_DOMAIN}` },
  { name: "Sheel", email: `sheel@${TEAM_DOMAIN}` },
  { name: "Aditi", email: `aditi@${TEAM_DOMAIN}` },
  { name: "Jacob", email: `jacob@${TEAM_DOMAIN}` },
  { name: "Vanessa", email: `vanessa@${TEAM_DOMAIN}` },
  { name: "Mandeep", email: `mandeep@${TEAM_DOMAIN}` },
];

function normalizeEmail(v = "") {
  return String(v).trim().toLowerCase();
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    // ✅ Migration for older data
    return Array.isArray(parsed)
      ? parsed.map((t) => ({
          ...t,
          // old -> new field
          taskName: t.taskName ?? t.title ?? "",
          // make sure status matches table badges
          status:
            t.status === "Open"
              ? "To Do"
              : t.status || "To Do",
          priority: t.priority || "Medium",
          owner: t.owner || "Ankit",
          section: t.section || "Other",
          externalStakeholders: t.externalStakeholders || "",
          subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
        }))
      : [];
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
    // CSV escaping
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
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

  // ✅ Auth state from Cloudflare Access
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("Member"); // default

  // Theme
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("dtt_theme", theme);
  }, [theme]);

  // Persist tasks
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  // Fetch Cloudflare Access email from Pages Function (/functions/me.js)
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

        const match = TEAM.find((m) => normalizeEmail(m.email) === email);
        setUserName(match?.name || "Member");
      } catch {
        if (!alive) return;
        // If Access is misconfigured, you'll see this
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

  // Dashboard counts
  const counts = useMemo(() => {
    return {
      overdue: tasks.filter((t) => isOverdue(t)).length,
      inProgress: tasks.filter((t) => t.status === "In Progress").length,
      blocked: tasks.filter((t) => t.status === "Blocked").length,
      done: tasks.filter((t) => t.status === "Done").length,
    };
  }, [tasks]);

  // Permissions (Rule A)
  const isAdmin = normalizeEmail(userEmail) === normalizeEmail(ADMIN_EMAIL);

  const canEditAny = isAdmin;

  const canEditTask = (task) => {
    if (isAdmin) return true;
    // members can only edit/delete/update tasks where task.owner === their name
    return (task?.owner || "").trim() === (userName || "").trim();
  };

  function onDelete(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function onUpdateTask(updated) {
    if (!updated?.id) return;
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }

  function handleLogout() {
    // ✅ Cloudflare Access logout
    // If your org uses a different logout path, tell me and I’ll adjust.
    const returnTo = window.location.origin + window.location.pathname;
    window.location.href = `/cdn-cgi/access/logout?returnTo=${encodeURIComponent(returnTo)}`;
  }

  function handleExportCSV() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`tasks_${stamp}.csv`, tasks);
  }

  return (
    <div className="app-root">
      {/* HEADER */}
      <header className="app-header">
        <div>
          <h1>Digital Team Task Tracker</h1>
          <p>
            Signed in: {userEmail || "Unknown"} ({role}{userName ? `: ${userName}` : ""})
          </p>
        </div>

        <div className="header-actions">
          <button onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}>
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </button>

          <button type="button" onClick={handleLogout}>
            Logout
          </button>

          <button type="button" onClick={handleExportCSV}>
            Export CSV
          </button>

          <span className="pill">{tasks.length} tasks</span>
        </div>
      </header>

      {/* TABS */}
      <nav className="tabs">
        <button
          className={tab === "dashboard" ? "active" : ""}
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </button>

        <button
          className={tab === "tasks" ? "active" : ""}
          onClick={() => setTab("tasks")}
        >
          Tasks
        </button>

        <button className="primary" onClick={() => setShowModal(true)}>
          + New Task
        </button>
      </nav>

      {/* CONTENT */}
      <main className="app-content">
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
          <p style={{ marginTop: 12, opacity: 0.8 }}>
            No tasks yet. Click <b>+ New Task</b> to add your first task.
          </p>
        )}
      </main>

      {/* MODAL */}
      {showModal && (
        <Modal
          title="Create a Task"
          subtitle={
            role === "Admin"
              ? "Admin can create/edit/delete any task."
              : "Members can edit/delete only their own tasks."
          }
          onClose={() => setShowModal(false)}
        >
          <TaskForm
            onSubmit={(task) => {
              const finalTask = {
                ...task,
                id: task?.id || crypto.randomUUID(),
                createdAt: task?.createdAt || new Date().toISOString(),
              };
              setTasks((prev) => [finalTask, ...prev]);
              setShowModal(false);
            }}
            onCancel={() => setShowModal(false)}
          />
        </Modal>
      )}
    </div>
  );
}