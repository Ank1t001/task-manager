import { useEffect, useMemo, useState } from "react";
import MiniDashboard from "./components/MiniDashboard";
import TaskTable from "./components/TaskTable";
import TaskForm from "./components/TaskForm";
import Modal from "./components/Modal";

const STORAGE_KEY = "digital_team_task_tracker_v3";
const THEME_KEY = "dtt_theme";
const ADMIN_EMAIL = "ankit@digijabber.com";

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
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

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || "light");
  const [tab, setTab] = useState("dashboard");
  const [tasks, setTasks] = useState(loadTasks);
  const [showModal, setShowModal] = useState(false);

  // Theme
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Persist tasks
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  // Dashboard counts (what MiniDashboard expects)
  const counts = useMemo(() => {
    return {
      overdue: tasks.filter((t) => isOverdue(t)).length,
      inProgress: tasks.filter((t) => t.status === "In Progress").length,
      blocked: tasks.filter((t) => t.status === "Blocked").length,
      done: tasks.filter((t) => t.status === "Done").length,
    };
  }, [tasks]);

  // TaskTable expects these callbacks
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
    // clears your local tasks + theme (simple logout)
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(THEME_KEY);
    window.location.reload();
  }

  function handleExportCsv() {
    const header = [
      "id",
      "taskName",
      "owner",
      "section",
      "priority",
      "status",
      "dueDate",
      "externalStakeholders",
      "createdAt",
      "updatedAt",
    ];

    const rows = tasks.map((t) => [
      t.id || "",
      t.taskName || "",
      t.owner || "",
      t.section || "",
      t.priority || "",
      t.status || "",
      t.dueDate || "",
      t.externalStakeholders || "",
      t.createdAt || "",
      t.updatedAt || "",
    ]);

    downloadCsv("tasks.csv", [header, ...rows]);
  }

  // permissions placeholders (your TaskTable expects these)
  const canEditAny = true;
  const canEditTask = () => true;

  const userEmail = ADMIN_EMAIL;

  return (
    <div className="app-root">
      {/* HEADER */}
      <header className="app-header">
        <div>
          <h1>Digital Team Task Tracker</h1>
          <p>Signed in: {userEmail} (Admin)</p>
        </div>

        <div className="header-actions">
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            type="button"
          >
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </button>

          <button onClick={handleLogout} type="button">
            Logout
          </button>

          <button onClick={handleExportCsv} type="button">
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
          type="button"
        >
          Dashboard
        </button>

        <button
          className={tab === "tasks" ? "active" : ""}
          onClick={() => setTab("tasks")}
          type="button"
        >
          Tasks
        </button>

        <button className="primary" onClick={() => setShowModal(true)} type="button">
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
      </main>

      {/* MODAL */}
      {showModal && (
        <Modal
          open={showModal}
          title="Create a new task"
          subtitle="Fill details and save."
          onClose={() => setShowModal(false)}
        >
          <TaskForm
            theme={theme}
            canEdit={true}
            onSubmit={(task) => {
              // TaskForm already returns correct shape; ensure id exists
              const finalTask = {
                ...task,
                id: task?.id || crypto.randomUUID(),
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