import { useEffect, useMemo, useState } from "react";
import TaskForm from "./components/TaskForm";
import TaskTable from "./components/TaskTable";
import MiniDashboard from "./components/MiniDashboard";

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

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.tab,
        ...(active ? styles.tabActive : {}),
      }}
      type="button"
    >
      {children}
    </button>
  );
}

export default function App() {
  const [tasks, setTasks] = useState(() => loadTasks());
  const [editingId, setEditingId] = useState(null);

  // tabs
  const [tab, setTab] = useState("dashboard"); // "dashboard" | "tasks"

  // filters
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortDue, setSortDue] = useState("asc");

  // identity
  const [email, setEmail] = useState("");

  useEffect(() => saveTasks(tasks), [tasks]);

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

  const editingTask = useMemo(
    () => tasks.find((t) => t.id === editingId) || null,
    [tasks, editingId]
  );

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

  function updateTask(updated) {
    const allowed = canEditAny || canEditTask(updated);
    if (!allowed) return;
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingId(null);
  }

  function deleteTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const allowed = canEditAny || canEditTask(task);
    if (!allowed) return;

    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
  }

  const canEditCurrent = editingTask
    ? canEditAny || canEditTask(editingTask)
    : Boolean(email);

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        {/* Top Bar */}
        <div style={styles.topBar}>
          <div>
            <div style={styles.title}>Digital Team Task Tracker</div>
            <div style={styles.subtitle}>
              Public view • Team edits their own tasks • Admin (Ankit) manages all.
            </div>
            <div style={styles.identity}>
              {email ? (
                <>
                  Signed in: <strong>{email}</strong> ({isAdmin ? "Admin" : "Team"})
                </>
              ) : (
                <>Viewer mode (not signed in)</>
              )}
            </div>
          </div>

          <div style={styles.topActions}>
            {!email ? (
              <button onClick={goToLogin} style={styles.btnSecondary}>
                Login
              </button>
            ) : (
              <button onClick={goToLogout} style={styles.btnSecondary}>
                Logout
              </button>
            )}
            <button onClick={() => downloadCSV(filteredTasks)} style={styles.btnSecondary}>
              Export CSV
            </button>
            <div style={styles.pill}>{filteredTasks.length} tasks</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabsRow}>
          <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
            Dashboard
          </TabButton>
          <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")}>
            Tasks
          </TabButton>
        </div>

        {/* Content */}
        {tab === "dashboard" ? (
          <div style={{ display: "grid", gap: 14 }}>
            <MiniDashboard counts={dashboardCounts} />

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}>Quick Add</div>
                <div style={styles.cardHint}>Add a task fast (sub-tasks supported)</div>
              </div>

              <TaskForm
                key={editingTask?.id || "new"}
                initialTask={editingTask}
                onCancel={() => setEditingId(null)}
                onSubmit={(task) => (editingTask ? updateTask(task) : addTask(task))}
                canEdit={canEditCurrent}
                isAdmin={isAdmin}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}>Tasks</div>
                <div style={styles.cardHint}>
                  Filter, sort, edit (if allowed), export.
                </div>
              </div>

              <div style={styles.filters}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by task name..."
                  style={styles.input}
                />

                <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} style={styles.input}>
                  {owners.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>

                <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} style={styles.input}>
                  {sections.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.input}>
                  {["All", "To Do", "In Progress", "Blocked", "Done"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <select value={sortDue} onChange={(e) => setSortDue(e.target.value)} style={styles.input}>
                  <option value="asc">Due ↑</option>
                  <option value="desc">Due ↓</option>
                </select>
              </div>

              <TaskTable
  tasks={filteredTasks}
  onEdit={(id) => {
    setEditingId(id);
    setTab("dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }}
  onDelete={deleteTask}
  onUpdateTask={(updatedTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  }}
  canEditAny={canEditAny}
  canEditTask={canEditTask}
/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 700px at 20% 0%, rgba(59,130,246,0.20) 0%, transparent 60%), radial-gradient(1100px 600px at 80% 0%, rgba(16,185,129,0.16) 0%, transparent 55%), #070B14",
    padding: 16,
    color: "#e5e7eb",
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },

  // full width shell fixes the “blank space on right” look
  shell: {
    width: "min(1320px, 100%)",
    margin: "0 auto",
    display: "grid",
    gap: 14,
  },

  topBar: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(8px)",
    padding: "16px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  title: { fontSize: 22, fontWeight: 900, color: "#f8fafc" },
  subtitle: { marginTop: 6, color: "rgba(226,232,240,0.78)", fontSize: 13 },
  identity: { marginTop: 6, color: "rgba(226,232,240,0.78)", fontSize: 12 },

  topActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  btnSecondary: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 900,
  },
  pill: {
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    fontWeight: 900,
    color: "#e5e7eb",
  },

  tabsRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  tab: {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(226,232,240,0.85)",
    cursor: "pointer",
    fontWeight: 900,
  },
  tabActive: {
    background: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.22)",
    color: "#ffffff",
  },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(8px)",
    padding: 16,
  },
  cardHeader: { marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: 900, color: "#f8fafc" },
  cardHint: { marginTop: 6, fontSize: 12, color: "rgba(226,232,240,0.78)" },

  filters: {
    display: "grid",
    gridTemplateColumns: "1.2fr repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 12,
  },
  input: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    outline: "none",
    width: "100%",
  },
};
