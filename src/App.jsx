import { useEffect, useMemo, useState } from "react";
import TaskForm from "./components/TaskForm";
import TaskTable from "./components/TaskTable";
import MiniDashboard from "./components/MiniDashboard";
import KanbanBoard from "./components/KanbanBoard";
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

function calcProgress(task) {
  const st = Array.isArray(task?.subtasks) ? task.subtasks : [];
  if (st.length === 0) return task.status === "Done" ? 100 : 0;
  const done = st.filter((x) => x.done).length;
  return Math.round((done / st.length) * 100);
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function downloadCSV(tasks) {
  const headers = [
    "Task Name",
    "Owner",
    "Section",
    "Priority",
    "Due Date",
    "Status",
    "Progress %",
    "Subtasks (count)",
    "External Stakeholders",
    "Created At",
    "Updated At",
  ];

  const rows = tasks.map((t) => {
    const st = Array.isArray(t.subtasks) ? t.subtasks : [];
    return [
      t.taskName,
      t.owner,
      t.section,
      t.priority,
      t.dueDate,
      t.status,
      calcProgress(t),
      st.length,
      t.externalStakeholders,
      t.createdAt,
      t.updatedAt,
    ];
  });

  const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `digital-team-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function goToLogin() {
  const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/api/login?returnTo=${returnTo}`;
}
function goToLogout() {
  window.location.href = "/cdn-cgi/access/logout";
}

function TabButton({ active, onClick, children, theme }) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        ...styles(theme).tab,
        ...(active ? styles(theme).tabActive : {}),
      }}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [tasks, setTasks] = useState(() => loadTasks());
  const [editingId, setEditingId] = useState(null);

  const [tab, setTab] = useState("dashboard"); // dashboard | tasks
  const [tasksView, setTasksView] = useState("table"); // table | kanban

  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortDue, setSortDue] = useState("asc");

  // ✅ Theme: "dark" or "light"
  const [theme, setTheme] = useState(() => localStorage.getItem("dtt_theme") || "dark");

  // Identity
  const [email, setEmail] = useState("");

  // ✅ New Task modal
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  useEffect(() => saveTasks(tasks), [tasks]);

  useEffect(() => {
    localStorage.setItem("dtt_theme", theme);
  }, [theme]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setEmail(String(d?.email || "")))
      .catch(() => setEmail(""));
  }, []);

  const isAdmin = useMemo(
    () => email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
    [email]
  );

  function canEditTask(task) {
    if (!email) return false;
    const ownerName = String(task?.owner || "").toLowerCase().trim();
    const emailUser = (email.split("@")[0] || "").toLowerCase();
    return ownerName && emailUser.includes(ownerName);
  }

  const canEditAny = isAdmin;

  const owners = useMemo(() => {
    const set = new Set(tasks.map((t) => t.owner));
    return ["All", ...Array.from(set)];
  }, [tasks]);

  const sections = useMemo(() => {
    const set = new Set(tasks.map((t) => t.section || "Other"));
    return ["All", ...Array.from(set)];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.taskName.toLowerCase().includes(q));
    }
    if (ownerFilter !== "All") list = list.filter((t) => t.owner === ownerFilter);
    if (sectionFilter !== "All") list = list.filter((t) => (t.section || "Other") === sectionFilter);
    if (statusFilter !== "All") list = list.filter((t) => t.status === statusFilter);

    list.sort((a, b) => {
      const da = a.dueDate || "";
      const db = b.dueDate || "";
      return sortDue === "asc" ? da.localeCompare(db) : db.localeCompare(da);
    });

    return list;
  }, [tasks, search, ownerFilter, sectionFilter, statusFilter, sortDue]);

  const dashboardCounts = useMemo(() => {
    const overdue = tasks.filter((t) => isOverdue(t)).length;
    const inProgress = tasks.filter((t) => t.status === "In Progress").length;
    const blocked = tasks.filter((t) => t.status === "Blocked").length;
    const done = tasks.filter((t) => t.status === "Done").length;
    return { overdue, inProgress, blocked, done };
  }, [tasks]);

  function addTask(task) {
    if (!email) return;
    setTasks((prev) => [{ ...task, id: crypto.randomUUID() }, ...prev]);
  }

  function deleteTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const allowed = canEditAny || canEditTask(task);
    if (!allowed) return;

    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
  }

  const s = styles(theme);

  return (
    <div style={s.page}>
      <div style={s.shell}>
        {/* Header */}
        <div style={s.topBar}>
          <div>
            <div style={s.title}>Digital Team Task Tracker</div>
            <div style={s.subtitle}>
              Public view • Team edits their own tasks • Admin (Ankit) manages all.
            </div>
            <div style={s.identity}>
              {email ? (
                <>
                  Signed in: <strong>{email}</strong> ({isAdmin ? "Admin" : "Team"})
                </>
              ) : (
                <>Viewer mode (not signed in)</>
              )}
            </div>
          </div>

          <div style={s.topActions}>
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              style={s.btnSecondary}
              title="Toggle theme"
            >
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>

            {!email ? (
              <button onClick={goToLogin} style={s.btnSecondary}>
                Login
              </button>
            ) : (
              <button onClick={goToLogout} style={s.btnSecondary}>
                Logout
              </button>
            )}

            <button onClick={() => downloadCSV(filteredTasks)} style={s.btnSecondary}>
              Export CSV
            </button>

            <div style={s.pill}>{filteredTasks.length} tasks</div>
          </div>
        </div>

        {/* Tabs row + New Task */}
        <div style={s.tabsTopRow}>
          <div style={s.tabsRow}>
            <TabButton theme={theme} active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
              Dashboard
            </TabButton>
            <TabButton theme={theme} active={tab === "tasks"} onClick={() => setTab("tasks")}>
              Tasks
            </TabButton>
          </div>

          <button
            type="button"
            style={s.btnPrimary}
            onClick={() => setNewTaskOpen(true)}
            disabled={!email}
            title={!email ? "Login to add tasks" : "Create a new task"}
          >
            ＋ New Task
          </button>
        </div>

        {/* Content */}
        {tab === "dashboard" ? (
          <div style={{ display: "grid", gap: 14 }}>
            <MiniDashboard counts={dashboardCounts} />

            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardTitle}>Overview</div>
                <div style={s.cardHint}>
                  Use <strong>New Task</strong> to create tasks. Use the <strong>Tasks</strong> tab to manage.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={s.card}>
              <div style={s.cardHeaderRow}>
                <div>
                  <div style={s.cardTitle}>Tasks</div>
                  <div style={s.cardHint}>Table + Kanban, filters, inline sub-tasks.</div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setTasksView("table")}
                    style={tasksView === "table" ? s.tabActive : s.tab}
                  >
                    Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setTasksView("kanban")}
                    style={tasksView === "kanban" ? s.tabActive : s.tab}
                  >
                    Kanban
                  </button>
                </div>
              </div>

              <div style={s.filters}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by task name..."
                  style={s.input}
                />

                <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} style={s.input}>
                  {owners.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>

                <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} style={s.input}>
                  {sections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>

                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={s.input}>
                  {["All", "To Do", "In Progress", "Blocked", "Done"].map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>

                <select value={sortDue} onChange={(e) => setSortDue(e.target.value)} style={s.input}>
                  <option value="asc">Due ↑</option>
                  <option value="desc">Due ↓</option>
                </select>
              </div>

              {tasksView === "table" ? (
                <TaskTable
                  tasks={filteredTasks}
                  onDelete={deleteTask}
                  onUpdateTask={(updatedTask) => {
                    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
                  }}
                  canEditAny={canEditAny}
                  canEditTask={canEditTask}
                />
              ) : (
                <KanbanBoard
                  tasks={filteredTasks}
                  onDelete={deleteTask}
                  onUpdateTask={(updatedTask) => {
                    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
                  }}
                  canEditAny={canEditAny}
                  canEditTask={canEditTask}
                />
              )}
            </div>
          </div>
        )}

        {/* New Task Modal */}
        <Modal
          open={newTaskOpen}
          title="New Task"
          subtitle="Fill details and create a task."
          onClose={() => setNewTaskOpen(false)}
          footer={
            <button style={s.btnSecondary} onClick={() => setNewTaskOpen(false)}>
              Close
            </button>
          }
        >
          <TaskForm
            initialTask={null}
            canEdit={Boolean(email)}
            isAdmin={isAdmin}
            onCancel={() => setNewTaskOpen(false)}
            onSubmit={(task) => {
              addTask(task);
              setNewTaskOpen(false);
              setTab("tasks");
            }}
            theme={theme}
          />
        </Modal>
      </div>
    </div>
  );
}

function styles(theme) {
  const dark = theme === "dark";

  const bg = dark
    ? "radial-gradient(1200px 700px at 20% 0%, rgba(59,130,246,0.22) 0%, transparent 60%), radial-gradient(1100px 600px at 80% 0%, rgba(168,85,247,0.18) 0%, transparent 55%), #070B14"
    : "radial-gradient(1200px 700px at 20% 0%, rgba(59,130,246,0.14) 0%, transparent 60%), radial-gradient(1100px 600px at 80% 0%, rgba(168,85,247,0.12) 0%, transparent 55%), #F6F8FC";

  const cardBg = dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)";
  const border = dark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.12)";
  const text = dark ? "#EAF0FF" : "#0f172a";
  const subtext = dark ? "rgba(226,232,240,0.78)" : "rgba(15,23,42,0.68)";

  return {
    page: { minHeight: "100vh", background: bg, padding: 16, color: text, fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial" },
    shell: { width: "100%", maxWidth: 1320, margin: "0 auto", display: "grid", gap: 14 },

    topBar: {
      borderRadius: 18,
      border: `1px solid ${border}`,
      background: cardBg,
      backdropFilter: "blur(10px)",
      padding: "16px 16px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 14,
      flexWrap: "wrap",
    },
    title: { fontSize: 22, fontWeight: 950, color: text },
    subtitle: { marginTop: 6, color: subtext, fontSize: 13 },
    identity: { marginTop: 6, color: subtext, fontSize: 12 },

    topActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
    btnSecondary: {
      padding: "10px 12px",
      borderRadius: 12,
      border: `1px solid ${border}`,
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
      color: dark ? text : "#0f172a",
      cursor: "pointer",
      fontWeight: 900,
    },
    btnPrimary: {
      padding: "12px 16px",
      borderRadius: 16,
      border: `1px solid ${dark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.14)"}`,
      background: "linear-gradient(135deg, rgba(99,102,241,0.95), rgba(168,85,247,0.95))",
      color: "white",
      cursor: "pointer",
      fontWeight: 950,
      boxShadow: dark ? "0 12px 30px rgba(99,102,241,0.25)" : "0 12px 30px rgba(99,102,241,0.20)",
      opacity: 1,
    },
    pill: {
      padding: "7px 10px",
      borderRadius: 999,
      border: `1px solid ${border}`,
      background: cardBg,
      fontSize: 12,
      fontWeight: 900,
      color: text,
    },

    tabsTopRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
    tabsRow: { display: "flex", gap: 10, alignItems: "center" },

    tab: {
      padding: "10px 12px",
      borderRadius: 999,
      border: `1px solid ${border}`,
      background: cardBg,
      color: subtext,
      cursor: "pointer",
      fontWeight: 900,
    },
    tabActive: {
      padding: "10px 12px",
      borderRadius: 999,
      border: `1px solid ${dark ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.18)"}`,
      background: dark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.06)",
      color: text,
      cursor: "pointer",
      fontWeight: 950,
    },

    card: {
      borderRadius: 18,
      border: `1px solid ${border}`,
      background: cardBg,
      backdropFilter: "blur(10px)",
      padding: 16,
    },
    cardHeader: { marginBottom: 12 },
    cardHeaderRow: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "center",
      flexWrap: "wrap",
      marginBottom: 12,
    },
    cardTitle: { fontSize: 16, fontWeight: 950, color: text },
    cardHint: { marginTop: 6, fontSize: 12, color: subtext },

    filters: {
      display: "grid",
      gridTemplateColumns: "1.2fr repeat(4, minmax(0, 1fr))",
      gap: 10,
      marginBottom: 12,
    },
    input: {
      padding: "10px 12px",
      borderRadius: 12,
      border: `1px solid ${border}`,
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)",
      color: dark ? text : "#0f172a",
      outline: "none",
      width: "100%",
    },
  };
}
