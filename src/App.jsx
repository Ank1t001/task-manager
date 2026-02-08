import { useEffect, useMemo, useState } from "react";
import MiniDashboard from "./components/MiniDashboard";
import TaskTable from "./components/TaskTable";
import TaskForm from "./components/TaskForm";
import Modal from "./components/Modal";

const STORAGE_KEY = "digital_team_task_tracker_v3";
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

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("dtt_theme") || "light");
  const [tab, setTab] = useState("dashboard");
  const [tasks, setTasks] = useState(() => loadTasks());

  // mock signed-in user (replace with your /api/me later)
  const [me] = useState(() => ({
    email: ADMIN_EMAIL,
    role: "Admin",
  }));

  const [newTaskOpen, setNewTaskOpen] = useState(false);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("dtt_theme", theme);
  }, [theme]);

  const dark = theme === "dark";
  const s = styles(dark);

  const counts = useMemo(() => {
    let overdue = 0, inProgress = 0, blocked = 0, done = 0;
    for (const t of tasks) {
      if (isOverdue(t)) overdue++;
      if (t.status === "In Progress") inProgress++;
      if (t.status === "Blocked") blocked++;
      if (t.status === "Done") done++;
    }
    return { overdue, inProgress, blocked, done };
  }, [tasks]);

  function addOrUpdateTask(task) {
    if (!task?.id) {
      const created = { ...task, id: crypto.randomUUID() };
      setTasks((prev) => [created, ...prev]);
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div style={s.page}>
      <div style={s.shell}>
        {/* Header */}
        <div style={s.headerCard}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={s.titleRow}>
              <div style={s.dot} />
              <div style={s.h1}>Digital Team Task Tracker</div>
            </div>
            <div style={s.signedIn}>
              Signed in: <strong>{me.email}</strong> ({me.role})
            </div>
          </div>

          <div style={s.headerActions}>
            <button style={s.btn} onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              {dark ? "Light Mode" : "Dark Mode"}
            </button>
            <button style={s.btn} onClick={() => alert("Logout handled by Cloudflare Access")}>
              Logout
            </button>
            <button style={s.btn} onClick={() => alert("CSV export button already exists in your build")}>
              Export CSV
            </button>
            <div style={s.pill}>{tasks.length} tasks</div>
          </div>
        </div>

        {/* Tabs + New Task */}
        <div style={s.tabsRow}>
          <div style={s.tabs}>
            <button style={{ ...s.tabBtn, ...(tab === "dashboard" ? s.tabActive : {}) }} onClick={() => setTab("dashboard")}>
              Dashboard
            </button>
            <button style={{ ...s.tabBtn, ...(tab === "tasks" ? s.tabActive : {}) }} onClick={() => setTab("tasks")}>
              Tasks
            </button>
          </div>

          <button style={s.newTaskBtn} onClick={() => setNewTaskOpen(true)}>
            + New Task
          </button>
        </div>

        {/* Content */}
        {tab === "dashboard" ? (
          <>
            <MiniDashboard counts={counts} theme={theme} />
            <div style={s.card}>
              <div style={s.cardTitle}>Quick Tips</div>
              <div style={s.cardSub}>Use <strong>New Task</strong> to create tasks. Manage progress via <strong>sub-tasks</strong>.</div>
            </div>
          </>
        ) : (
          <div style={s.card}>
            <div style={s.cardTitle}>Tasks</div>
            <div style={s.cardSub}>Table view with sticky header + subtasks.</div>

            <div style={{ marginTop: 12 }}>
              {/* ✅ theme is passed */}
              <TaskTable
                theme={theme}
                tasks={tasks}
                onDelete={deleteTask}
                onUpdateTask={addOrUpdateTask}
                canEditAny={me.role === "Admin"}
                canEditTask={() => true}
              />
            </div>
          </div>
        )}

        {/* ✅ Modal MUST follow theme */}
        <Modal
          open={newTaskOpen}
          theme={theme}
          title="New Task"
          subtitle="Fill details and create a task."
          onClose={() => setNewTaskOpen(false)}
          footer={
            <>
              <button style={s.btn} onClick={() => setNewTaskOpen(false)}>Cancel</button>
              <button style={s.primaryBtn} form="taskFormSubmit" type="submit">Add Task</button>
            </>
          }
        >
          <TaskForm
            initialTask={null}
            onCancel={() => setNewTaskOpen(false)}
            onSubmit={(task) => {
              addOrUpdateTask(task);
              setNewTaskOpen(false);
            }}
            // ✅ lets footer submit work
            formId="taskFormSubmit"
            theme={theme}
          />
        </Modal>
      </div>
    </div>
  );
}

function styles(dark) {
  const NAVY_900 = "#071321";
  const NAVY_800 = "#0B1E33";
  const GOLD = "#D4AF37";

  return {
    page: {
      minHeight: "100vh",
      width: "100vw",                 // ✅ full screen
      overflowX: "hidden",
      background: dark
        ? "radial-gradient(1200px 700px at 20% 0%, rgba(59,130,246,0.22) 0%, transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(212,175,55,0.14) 0%, transparent 55%), linear-gradient(180deg, #020617 0%, #071321 60%, #020617 100%)"
        : "radial-gradient(1200px 700px at 20% 0%, rgba(59,130,246,0.12) 0%, transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(212,175,55,0.12) 0%, transparent 55%), linear-gradient(180deg, #f5f7ff 0%, #eef2ff 55%, #f8fafc 100%)",
      padding: 16,
    },

    shell: {
      width: "100%",
      maxWidth: "none",               // ✅ no cap
      margin: 0,
      display: "grid",
      gap: 14,
    },

    headerCard: {
      width: "100%",
      borderRadius: 18,
      padding: 16,
      border: dark ? "1px solid rgba(212,175,55,0.22)" : "1px solid rgba(15,23,42,0.12)",
      background: dark
        ? `linear-gradient(180deg, rgba(11,30,51,0.90), rgba(7,19,33,0.90))`
        : `linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.86))`,
      boxShadow: dark ? "0 20px 50px rgba(0,0,0,0.40)" : "0 18px 46px rgba(15,23,42,0.12)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },

    titleRow: { display: "flex", alignItems: "center", gap: 10 },

    dot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      background: GOLD,
      boxShadow: "0 0 0 4px rgba(212,175,55,0.14)",
    },

    h1: { fontSize: 22, fontWeight: 1000, color: dark ? "#EAF0FF" : "#0f172a" },

    signedIn: { fontSize: 13, color: dark ? "rgba(226,232,240,0.74)" : "rgba(15,23,42,0.62)" },

    headerActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

    btn: {
      padding: "10px 14px",
      borderRadius: 14,
      border: dark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(15,23,42,0.12)",
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)",
      color: dark ? "rgba(226,232,240,0.92)" : "#0f172a",
      fontWeight: 950,
      cursor: "pointer",
    },

    primaryBtn: {
      padding: "10px 14px",
      borderRadius: 14,
      border: "1px solid rgba(212,175,55,0.28)",
      background: "linear-gradient(90deg, rgba(99,102,241,0.95), rgba(212,175,55,0.85))",
      color: "#0b1220",
      fontWeight: 1000,
      cursor: "pointer",
    },

    pill: {
      padding: "10px 14px",
      borderRadius: 999,
      border: dark ? "1px solid rgba(212,175,55,0.22)" : "1px solid rgba(15,23,42,0.12)",
      background: dark ? "rgba(212,175,55,0.10)" : "rgba(99,102,241,0.08)",
      color: dark ? "rgba(226,232,240,0.92)" : "#0f172a",
      fontWeight: 950,
    },

    tabsRow: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },

    tabs: { display: "flex", gap: 10, alignItems: "center" },

    tabBtn: {
      padding: "10px 14px",
      borderRadius: 999,
      border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(15,23,42,0.12)",
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)",
      cursor: "pointer",
      fontWeight: 950,
      color: dark ? "rgba(226,232,240,0.86)" : "rgba(15,23,42,0.76)",
    },

    tabActive: {
      outline: "2px solid rgba(59,130,246,0.55)",
      color: dark ? "#EAF0FF" : "#0f172a",
    },

    newTaskBtn: {
      padding: "12px 18px",
      borderRadius: 16,
      border: "1px solid rgba(212,175,55,0.28)",
      background: "linear-gradient(90deg, rgba(99,102,241,0.92), rgba(212,175,55,0.85))",
      color: "#0b1220",
      fontWeight: 1000,
      cursor: "pointer",
    },

    card: {
      width: "100%",
      borderRadius: 18,
      padding: 16,
      border: dark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(15,23,42,0.10)",
      background: dark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.84)",
      boxShadow: dark ? "0 16px 40px rgba(0,0,0,0.35)" : "0 14px 36px rgba(15,23,42,0.10)",
    },

    cardTitle: { fontWeight: 1000, fontSize: 18, color: dark ? "#EAF0FF" : "#0f172a" },
    cardSub: { marginTop: 6, color: dark ? "rgba(226,232,240,0.70)" : "rgba(15,23,42,0.62)", fontSize: 13 },
  };
}
