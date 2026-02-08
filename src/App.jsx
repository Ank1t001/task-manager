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

function TabButton({ active, onClick, children, s }) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        ...s.tab,
        ...(active ? s.tabActive : {}),
      }}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [tasks, setTasks] = useState(() => loadTasks());

  const [tab, setTab] = useState("dashboard");
  const [tasksView, setTasksView] = useState("table");

  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortDue, setSortDue] = useState("asc");

  const [theme, setTheme] = useState(() => localStorage.getItem("dtt_theme") || "dark");
  const [email, setEmail] = useState("");

  const [newTaskOpen, setNewTaskOpen] = useState(false);

  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => localStorage.setItem("dtt_theme", theme), [theme]);

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
  }

  const s = styles(theme);

  return (
    <div style={s.page}>
      <div style={s.bgGrid} />

      <div style={s.shell}>
        {/* Header */}
        <div style={s.topBar}>
          <div>
            <div style={s.titleRow}>
              <div style={s.brandDot} />
              <div style={s.title}>Digital Team Task Tracker</div>
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
              style={s.btnSoft}
              title="Toggle theme"
            >
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>

            {!email ? (
              <button onClick={goToLogin} style={s.btnSoft}>
                Login
              </button>
            ) : (
              <button onClick={goToLogout} style={s.btnSoft}>
                Logout
              </button>
            )}

            <button onClick={() => downloadCSV(filteredTasks)} style={s.btnSoft}>
              Export CSV
            </button>

            <div style={s.pill}>{filteredTasks.length} tasks</div>
          </div>
        </div>

        {/* Tabs row + New Task */}
        <div style={s.tabsTopRow}>
          <div style={s.tabsRow}>
            <TabButton s={s} active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
              Dashboard
            </TabButton>
            <TabButton s={s} active={tab === "tasks"} onClick={() => setTab("tasks")}>
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
            <MiniDashboard counts={dashboardCounts} theme={theme} />
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardTitle}>Quick Tips</div>
                <div style={s.cardHint}>
                  Use <strong>New Task</strong> to create tasks. Manage progress via <strong>sub-tasks</strong>.
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
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>

                <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} style={s.input}>
                  {sections.map((sec) => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>

                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={s.input}>
                  {["All", "To Do", "In Progress", "Blocked", "Done"].map((st) => (
                    <option key={st} value={st}>{st}</option>
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
            <button style={s.btnSoft} onClick={() => setNewTaskOpen(false)}>
              Close
            </button>
          }
        >
          <TaskForm
            initialTask={null}
            canEdit={Boolean(email)}
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

  const NAVY_900 = "#071321";
  const NAVY_800 = "#0B1E33";
  const GOLD = "#D4AF37";
  const GOLD_SOFT = "rgba(212,175,55,0.22)";

  // ✅ Optimized light mode: clean, not washed-out
  const bg = dark
    ? `radial-gradient(1200px 700px at 20% 0%, rgba(59,130,246,0.18) 0%, transparent 60%),
       radial-gradient(1100px 600px at 80% 0%, rgba(212,175,55,0.12) 0%, transparent 55%),
       linear-gradient(180deg, ${NAVY_800}, ${NAVY_900})`
    : `linear-gradient(180deg, #F8FAFF 0%, #EEF3FF 40%, #F8FAFF 100%)`;

  const text = dark ? "#EAF0FF" : "#0f172a";
  const subtext = dark ? "rgba(226,232,240,0.78)" : "rgba(15,23,42,0.70)";

  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)";

  const cardBg = dark
    ? "linear-gradient(180deg, rgba(16,42,70,0.55), rgba(7,19,33,0.55))"
    : "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.80))";

  const shadow = dark ? "0 14px 40px rgba(0,0,0,0.28)" : "0 14px 40px rgba(15,23,42,0.10)";

  return {
    page: {
      minHeight: "100vh",
      background: bg,
      padding: 16,
      color: text,
      fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial",
      position: "relative",
    },

    bgGrid: {
      position: "fixed",
      inset: 0,
      backgroundImage: dark
        ? "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)"
        : "linear-gradient(rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.05) 1px, transparent 1px)",
      backgroundSize: "60px 60px",
      maskImage: "radial-gradient(closest-side, rgba(0,0,0,0.35), transparent 75%)",
      pointerEvents: "none",
      opacity: dark ? 0.18 : 0.14,
    },

    shell: {
  width: "100%",
  maxWidth: "none",
  margin: 0,
  display: "grid",
  gap: 14,
  position: "relative",
},

    topBar: {
      borderRadius: 18,
      border: `1px solid ${dark ? GOLD_SOFT : border}`,
      background: cardBg,
      backdropFilter: "blur(10px)",
      padding: "16px 16px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 14,
      flexWrap: "wrap",
      boxShadow: shadow,
    },

    titleRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
    brandDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      background: GOLD,
      boxShadow: "0 0 0 4px rgba(212,175,55,0.12)",
    },
    title: { fontSize: 22, fontWeight: 950, color: text },

    identity: { marginTop: 8, color: subtext, fontSize: 12 },

    topActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },

    btnSoft: {
      padding: "10px 12px",
      borderRadius: 12,
      border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : border}`,
      background: dark
        ? "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))"
        : "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.86))",
      color: dark ? text : "#0f172a",
      cursor: "pointer",
      fontWeight: 950,
      boxShadow: dark ? "none" : "0 8px 16px rgba(15,23,42,0.06)",
    },

    btnPrimary: {
      padding: "12px 16px",
      borderRadius: 16,
      border: `1px solid ${dark ? "rgba(212,175,55,0.30)" : "rgba(99,102,241,0.20)"}`,
      background: dark
        ? "linear-gradient(135deg, rgba(212,175,55,0.95), rgba(99,102,241,0.85))"
        : "linear-gradient(135deg, rgba(99,102,241,0.92), rgba(212,175,55,0.88))",
      color: dark ? "#0B1E33" : "#0f172a",
      cursor: "pointer",
      fontWeight: 950,
      boxShadow: dark ? "0 16px 36px rgba(212,175,55,0.18)" : "0 16px 30px rgba(99,102,241,0.14)",
    },

    pill: {
      padding: "7px 10px",
      borderRadius: 999,
      border: `1px solid ${dark ? GOLD_SOFT : border}`,
      background: dark ? "rgba(212,175,55,0.10)" : "rgba(255,255,255,0.86)",
      fontSize: 12,
      fontWeight: 950,
      color: dark ? "#FDE68A" : "#0f172a",
    },

    tabsTopRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
    tabsRow: { display: "flex", gap: 10, alignItems: "center" },

    tab: {
      padding: "10px 12px",
      borderRadius: 999,
      border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : border}`,
      background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.70)",
      color: subtext,
      cursor: "pointer",
      fontWeight: 950,
    },
    tabActive: {
      padding: "10px 12px",
      borderRadius: 999,
      border: `1px solid ${dark ? GOLD_SOFT : "rgba(99,102,241,0.22)"}`,
      background: dark
        ? "linear-gradient(135deg, rgba(212,175,55,0.16), rgba(255,255,255,0.06))"
        : "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(212,175,55,0.10))",
      color: text,
      cursor: "pointer",
      fontWeight: 950,
    },

    card: {
      borderRadius: 18,
      border: `1px solid ${dark ? GOLD_SOFT : border}`,
      background: cardBg,
      backdropFilter: "blur(10px)",
      padding: 16,
      boxShadow: shadow,
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
      border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : border}`,
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.96)",
      color: dark ? text : "#0f172a",
      outline: "none",
      width: "100%",
    },
  };
}
