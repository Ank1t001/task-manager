import { useEffect, useMemo, useState } from "react";
import MiniDashboard from "./components/MiniDashboard";
import TaskTable from "./components/TaskTable";
import TaskForm from "./components/TaskForm";
import Modal from "./components/Modal";

const STORAGE_KEY = "digital_team_task_tracker_v3";
const ADMIN_EMAIL = "ankit@digijabber.com";

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
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

export default function App() {
  const [theme, setTheme] = useState(
    localStorage.getItem("dtt_theme") || "light"
  );
  const [tab, setTab] = useState("dashboard");
  const [tasks, setTasks] = useState(loadTasks);
  const [showModal, setShowModal] = useState(false);

  // drives :root[data-theme="dark"]
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("dtt_theme", theme);
  }, [theme]);

  useEffect(() => saveTasks(tasks), [tasks]);

  // ✅ Counts for MiniDashboard (your component expects counts, not tasks)
  const counts = useMemo(() => {
    return {
      overdue: tasks.filter((t) => isOverdue(t)).length,
      inProgress: tasks.filter((t) => t.status === "In Progress").length,
      blocked: tasks.filter((t) => t.status === "Blocked").length,
      done: tasks.filter((t) => t.status === "Done").length,
    };
  }, [tasks]);

  // ✅ TaskTable expects these callbacks
  function handleDelete(taskId) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  function handleUpdateTask(updatedTask) {
    setTasks((prev) => {
      const id = updatedTask?.id;
      if (!id) return prev;

      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return [...prev, updatedTask];

      const next = [...prev];
      next[idx] = updatedTask;
      return next;
    });
  }

  // simple permissions (you can wire Cloudflare Access later)
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
            onClick={() =>
              setTheme((t) => (t === "light" ? "dark" : "light"))
            }
          >
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </button>

          <button type="button">Logout</button>
          <button type="button">Export CSV</button>
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
        {tab === "dashboard" && (
          <MiniDashboard counts={counts} theme={theme} />
        )}

        {tab === "tasks" && (
          <TaskTable
            tasks={tasks}
            theme={theme}
            onDelete={handleDelete}
            onUpdateTask={handleUpdateTask}
            canEditAny={canEditAny}
            canEditTask={canEditTask}
          />
        )}
      </main>

      {/* MODAL */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <TaskForm
            theme={theme}
            canEdit={true}
            onSubmit={(task) => {
              const finalTask = {
                ...task,
                id: task?.id || crypto.randomUUID(),
              };
              handleUpdateTask(finalTask);
              setShowModal(false);
            }}
            onCancel={() => setShowModal(false)}
          />
        </Modal>
      )}
    </div>
  );
}
