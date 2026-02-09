import { useEffect, useMemo, useState } from "react";
import Modal from "./components/Modal";

const STORAGE_KEY = "digital_team_task_tracker_v3";

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

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("dtt_theme") || "light");
  const [tab, setTab] = useState("dashboard");
  const [tasks, setTasks] = useState(() => loadTasks());
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  // ✅ theme drives CSS variables
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("dtt_theme", theme);
  }, [theme]);

  useEffect(() => saveTasks(tasks), [tasks]);

  const email = "ankit@digijabber.com";
  const role = "Admin";

  const counts = useMemo(() => {
    const c = { overdue: 0, inProgress: 0, blocked: 0, done: 0 };
    for (const t of tasks) {
      if (t.status === "In Progress") c.inProgress++;
      if (t.status === "Blocked") c.blocked++;
      if (t.status === "Done") c.done++;
      // simple overdue example
      if (t.dueDate && t.status !== "Done") {
        const today = new Date(); today.setHours(0,0,0,0);
        const due = new Date(t.dueDate + "T00:00:00");
        if (due < today) c.overdue++;
      }
    }
    return c;
  }, [tasks]);

  function addTask(task) {
    setTasks((prev) => [{ ...task, id: crypto.randomUUID() }, ...prev]);
  }

  return (
    <div className="dtt-page">
      <div className="dtt-shell">
        {/* HEADER */}
        <div className="dtt-card" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="dtt-titleRow">
              <div className="dtt-dot" />
              <div className="dtt-h1">Digital Team Task Tracker</div>
            </div>
            <div className="dtt-muted" style={{ marginTop: 8 }}>
              Signed in: <strong>{email}</strong> ({role})
            </div>
          </div>

          <div className="dtt-actions">
            <button className="dtt-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
            <button className="dtt-btn">Logout</button>
            <button className="dtt-btn">Export CSV</button>
            <div className="dtt-pill">{tasks.length} tasks</div>
          </div>
        </div>

        {/* TABS + NEW TASK */}
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

          <button className="dtt-btnPrimary" onClick={() => setNewTaskOpen(true)}>
            + New Task
          </button>
        </div>

        {/* CONTENT */}
        {tab === "dashboard" ? (
          <div className="dtt-card">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Kpi label="🔴 Overdue" value={counts.overdue} />
              <Kpi label="⏳ In Progress" value={counts.inProgress} />
              <Kpi label="🚫 Blocked" value={counts.blocked} />
              <Kpi label="✅ Done" value={counts.done} />
            </div>
          </div>
        ) : (
          <div className="dtt-card">
            <div style={{ fontWeight: 1000, marginBottom: 12 }}>Tasks</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr style={{ background: "var(--card2)" }}>
                    {["Task", "Owner", "Priority", "Due", "Status"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: 12, borderBottom: "1px solid var(--border)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 14, color: "var(--muted)" }}>No tasks yet.</td>
                    </tr>
                  ) : (
                    tasks.map((t) => (
                      <tr key={t.id}>
                        <td style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>{t.taskName}</td>
                        <td style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>{t.owner}</td>
                        <td style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>{t.priority}</td>
                        <td style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>{t.dueDate}</td>
                        <td style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>{t.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL */}
        <Modal
          open={newTaskOpen}
          onClose={() => setNewTaskOpen(false)}
          title="New Task"
          subtitle="Fill details and create a task."
          footer={
            <>
              <button className="dtt-btn" onClick={() => setNewTaskOpen(false)}>Cancel</button>
            </>
          }
        >
          <NewTaskForm
            onSubmit={(task) => {
              addTask(task);
              setNewTaskOpen(false);
              setTab("tasks");
            }}
          />
        </Modal>
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div style={{ padding: 14, borderRadius: 16, border: "1px solid var(--border)", background: "var(--card2)" }}>
      <div style={{ fontWeight: 900, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 1000, marginTop: 8, color: "var(--text)" }}>{value}</div>
    </div>
  );
}

function NewTaskForm({ onSubmit }) {
  const [taskName, setTaskName] = useState("");
  const [owner, setOwner] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("To Do");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          taskName: taskName.trim(),
          owner,
          priority,
          dueDate,
          status,
        });
      }}
      style={{ display: "grid", gap: 10 }}
    >
      <label className="dtt-muted">
        Task Name
        <input className="dtt-input" value={taskName} onChange={(e) => setTaskName(e.target.value)} />
      </label>

      <label className="dtt-muted">
        Owner
        <input className="dtt-input" value={owner} onChange={(e) => setOwner(e.target.value)} />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="dtt-muted">
          Priority
          <select className="dtt-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {["Low", "Medium", "High"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>

        <label className="dtt-muted">
          Due Date
          <input className="dtt-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
      </div>

      <label className="dtt-muted">
        Status
        <select className="dtt-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["To Do", "In Progress", "Blocked", "Done"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <button className="dtt-btnPrimary" type="submit">Add Task</button>
    </form>
  );
}