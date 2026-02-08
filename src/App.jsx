import { useEffect, useMemo, useState } from "react";
import TaskForm from "./components/TaskForm";
import TaskTable from "./components/TaskTable";
import MiniDashboard from "./components/MiniDashboard";

const STORAGE_KEY = "digital_team_task_tracker_v3";
const ADMIN_EMAIL = "ankit@digijabber.com"; // ✅ set your admin email here

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

/** ✅ Login triggers Cloudflare Access because /api/* is protected */
function goToLogin() {
  window.location.href = "/api/login";
}

/** ✅ Logout endpoint for Cloudflare Access */
function goToLogout() {
  window.location.href = "/cdn-cgi/access/logout";
}

export default function App() {
  const [tasks, setTasks] = useState(() => loadTasks());
  const [editingId, setEditingId] = useState(null);

  // filters
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortDue, setSortDue] = useState("asc");

  // identity (optional)
  const [email, setEmail] = useState(""); // empty = public viewer

  useEffect(() => saveTasks(tasks), [tasks]);

  // Try to fetch identity — will fail for public viewers (Access blocks /api/*)
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

  // Team member can edit ONLY if logged in (email exists) and task owner matches their name or email
  function canEditTask(task) {
    if (!email) return false; // public viewer
    const ownerName = String(task?.owner || "").toLowerCase();
    const emailUser = email.split("@")[0]?.toLowerCase() || "";
    return ownerName && emailUser && emailUser.includes(ownerName);
  }

  const canEditAny = isAdmin; // admin can edit all

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
    // only logged-in users should add tasks
    if (!email) return;
    setTasks((prev) => [{ ...task, id: crypto.randomUUID() }, ...prev]);
  }

  function updateTask(updated) {
    const canEditThis = canEditAny || canEditTask(updated);
    if (!canEditThis) return;
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingId(null);
  }

  function deleteTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const canEditThis = canEditAny || canEditTask(task);
    if (!canEditThis) return;

    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
  }

  const canEditCurrent = editingTask ? (canEditAny || canEditTask(editingTask)) : Boolean(email);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Digital Team Task Tracker</h1>
          <div style={{ color: "#6b7280", marginTop: 6, fontSize: 13 }}>
            Public view • Team edits their own tasks • Admin (Ankit) manages all.
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
            {email ? (
              <>
                Signed in: <strong>{email}</strong> ({isAdmin ? "Admin" : "Team"})
              </>
            ) : (
              <>Viewer mode (not signed in)</>
            )}
          </div>
        </div>

        {/* ✅ LOGIN / LOGOUT BUTTONS ADDED HERE */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {!email ? (
            <button onClick={goToLogin} style={styles.secondaryBtn}>
              Login
            </button>
          ) : (
            <button onClick={goToLogout} style={styles.secondaryBtn}>
              Logout
            </button>
          )}

          <button onClick={() => downloadCSV(filteredTasks)} style={styles.secondaryBtn}>
            Export CSV
          </button>

          <div style={styles.pill}>{filteredTasks.length} tasks</div>
        </div>
      </div>

      <div style={{ maxWidth: 1150, margin: "0 auto" }}>
        <MiniDashboard counts={dashboardCounts} />

        <div style={styles.grid}>
          <div style={styles.card}>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>{editingTask ? "Edit Task" : "Add Task"}</h2>
            <TaskForm
              key={editingTask?.id || "new"}
              initialTask={editingTask}
              onCancel={() => setEditingId(null)}
              onSubmit={(task) => (editingTask ? updateTask(task) : addTask(task))}
              canEdit={canEditCurrent}
              isAdmin={isAdmin}
            />
          </div>

          <div style={styles.card}>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Tasks</h2>

            <div style={styles.filters}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." style={styles.input} />

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
              onEdit={setEditingId}
              onDelete={deleteTask}
              canEditAny={canEditAny}
              canEditTask={canEditTask}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 18,
    background:
      "radial-gradient(1200px 600px at 20% 0%, #eef2ff 0%, transparent 60%), radial-gradient(1000px 500px at 80% 0%, #ecfeff 0%, transparent 55%), #f8fafc",
    fontFamily: "Arial",
  },
  header: {
    maxWidth: 1150,
    margin: "8px auto 16px",
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(6px)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1.3fr",
    gap: 16,
    alignItems: "start",
  },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    background: "rgba(255,255,255,0.9)",
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.05)",
  },
  filters: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  input: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", outline: "none", flex: "1 1 180px" },
  pill: { padding: "6px 10px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 900, color: "#111827" },
  secondaryBtn: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: "pointer", fontWeight: 900 },
};
