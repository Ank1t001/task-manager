import { useEffect, useMemo, useState } from "react";
import TaskForm from "./components/TaskForm";
import TaskTable from "./components/TaskTable";
import MiniDashboard from "./components/MiniDashboard";

const STORAGE_KEY = "digital_team_task_tracker_v2";
const ADMIN_EMAIL = "ankit@equiton.com"; // ✅ CHANGE this to your Access email if different

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
    const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
    const done = subtasks.filter((x) => x.done).length;
    const progress = subtasks.length === 0 ? (t.status === "Done" ? 100 : 0) : Math.round((done / subtasks.length) * 100);

    return [
      t.taskName,
      t.owner,
      t.section,
      t.priority,
      t.dueDate,
      t.status,
      progress,
      subtasks.length,
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

function isOverdue(task) {
  if (!task?.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate + "T00:00:00");
  return due < today && task.status !== "Done";
}

export default function App() {
  const [tasks, setTasks] = useState(() => loadTasks());
  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortDue, setSortDue] = useState("asc");

  // Role / identity
  const [email, setEmail] = useState("");
  const isAdmin = useMemo(() => (email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase(), [email]);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    // requires Cloudflare Access in front of the app
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setEmail(d?.email || ""))
      .catch(() => setEmail(""));
  }, []);

  const editingTask = useMemo(
    () => tasks.find((t) => t.id === editingId) || null,
    [tasks, editingId]
  );

  function addTask(task) {
    setTasks((prev) => [{ ...task, id: crypto.randomUUID() }, ...prev]);
  }

  function updateTask(updated) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingId(null);
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
  }

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

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <div style={styles.brand}>
          <img src="/logo.svg" alt="Logo" style={styles.logo} onError={(e) => (e.currentTarget.style.display = "none")} />
          <div>
            <div style={styles.title}>Digital Team Task Tracker</div>
            <div style={styles.subtitle}>
              CRM-style visibility • Sections • Sub-tasks • Export
            </div>
          </div>
        </div>

        <div style={styles.right}>
          <div style={styles.userPill}>
            {email ? (
              <>
                <span style={{ opacity: 0.85 }}>Signed in:</span> <strong>{email}</strong>
                <span style={{ marginLeft: 8, ...styles.roleTag }}>{isAdmin ? "Admin" : "Viewer"}</span>
              </>
            ) : (
              <span style={{ opacity: 0.85 }}>Access protected (email not detected)</span>
            )}
          </div>

          <button onClick={() => downloadCSV(filteredTasks)} style={styles.csvBtn}>
            Export CSV
          </button>
        </div>
      </div>

      <div style={styles.container}>
        <MiniDashboard counts={dashboardCounts} />

        <div style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.cardTitle}>{editingTask ? "Edit Task" : "Add Task"}</div>
            <TaskForm
              key={editingTask?.id || "new"}
              initialTask={editingTask}
              onCancel={() => setEditingId(null)}
              onSubmit={(task) => (editingTask ? updateTask(task) : addTask(task))}
              isAdmin={isAdmin}
            />
          </div>

          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={styles.cardTitle}>Tasks</div>
              <div style={styles.countPill}>{filteredTasks.length} shown</div>
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
                <option value="asc">Due date ↑</option>
                <option value="desc">Due date ↓</option>
              </select>
            </div>

            <TaskTable tasks={filteredTasks} onEdit={setEditingId} onDelete={deleteTask} isAdmin={isAdmin} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Theme shell (navy header, clean cards). Replace colors to exactly match your compliance checker.
const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(900px 600px at 20% 0%, rgba(59,130,246,0.12) 0%, transparent 60%), radial-gradient(800px 500px at 80% 10%, rgba(16,185,129,0.10) 0%, transparent 55%), #070B14",
    fontFamily: "Arial",
    color: "#e2e8f0",
  },
  topbar: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(7, 11, 20, 0.82)",
    backdropFilter: "blur(10px)",
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  brand: { display: "flex", gap: 12, alignItems: "center" },
  logo: { width: 38, height: 38, objectFit: "contain" },
  title: { fontSize: 16, fontWeight: 900, letterSpacing: 0.2 },
  subtitle: { fontSize: 12, opacity: 0.75, marginTop: 3 },
  right: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },
  userPill: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    fontSize: 12,
    display: "flex",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
  },
  roleTag: {
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 11,
    fontWeight: 900,
  },
  csvBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "#ffffff",
    color: "#0b1220",
    cursor: "pointer",
    fontWeight: 900,
  },
  container: { maxWidth: 1200, margin: "0 auto", padding: 16 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16, alignItems: "start" },
  card: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 16,
    background: "rgba(255,255,255,0.04)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  },
  cardTitle: { fontSize: 14, fontWeight: 900, marginBottom: 10 },
  filters: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  input: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#e2e8f0",
    outline: "none",
    flex: "1 1 190px",
  },
  countPill: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    fontSize: 12,
    fontWeight: 900,
  },
};
