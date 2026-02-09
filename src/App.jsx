import { useEffect, useState } from "react";
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

export default function App() {
  const [theme, setTheme] = useState(
    localStorage.getItem("dtt_theme") || "light"
  );
  const [tab, setTab] = useState("dashboard");
  const [tasks, setTasks] = useState(loadTasks);
  const [showModal, setShowModal] = useState(false);

  // ✅ Theme switch drives CSS variables: :root[data-theme="dark"]
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("dtt_theme", theme);
  }, [theme]);

  useEffect(() => saveTasks(tasks), [tasks]);

  const isAdmin = true; // (you can replace this later with auth)
  const userEmail = ADMIN_EMAIL;

  return (
    <div className="app-root">
      {/* HEADER */}
      <header className="app-header">
        <div>
          <h1 className="app-title">Digital Team Task Tracker</h1>
          <p className="app-subtitle">
            Signed in: {userEmail} {isAdmin ? "(Admin)" : ""}
          </p>
        </div>

        <div className="header-actions">
          <button
            className="btn"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          >
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </button>

          <button className="btn" type="button">
            Logout
          </button>

          <button className="btn" type="button">
            Export CSV
          </button>

          <span className="pill">{tasks.length} tasks</span>
        </div>
      </header>

      {/* TABS */}
      <nav className="tabs">
        <button
          className={`tabBtn ${tab === "dashboard" ? "active" : ""}`}
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </button>

        <button
          className={`tabBtn ${tab === "tasks" ? "active" : ""}`}
          onClick={() => setTab("tasks")}
        >
          Tasks
        </button>

        <button className="btn primary" onClick={() => setShowModal(true)}>
          + New Task
        </button>
      </nav>

      {/* CONTENT */}
      <main className="app-content">
        {tab === "dashboard" && <MiniDashboard tasks={tasks} />}
        {tab === "tasks" && <TaskTable tasks={tasks} setTasks={setTasks} />}
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
            onSubmit={(task) => {
              setTasks([...tasks, task]);
              setShowModal(false);
            }}
            onCancel={() => setShowModal(false)}
          />
        </Modal>
      )}
    </div>
  );
}
