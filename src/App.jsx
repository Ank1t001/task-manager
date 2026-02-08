import { useEffect, useMemo, useState } from "react";
import TaskForm from "./components/TaskForm";
import TaskTable from "./components/TaskTable";

const STORAGE_KEY = "task_manager_tasks_v2";

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
    "Priority",
    "Due Date",
    "Status",
    "External Stakeholders",
    "Created At",
    "Updated At",
  ];

  const rows = tasks.map((t) => [
    t.taskName,
    t.owner,
    t.priority,
    t.dueDate,
    t.status,
    t.externalStakeholders,
    t.createdAt,
    t.updatedAt,
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map(csvEscape).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [tasks, setTasks] = useState(() => loadTasks());
  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [sortDue, setSortDue] = useState("asc");

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

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

  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.taskName.toLowerCase().includes(q));
    }
    if (statusFilter !== "All") list = list.filter((t) => t.status === statusFilter);
    if (ownerFilter !== "All") list = list.filter((t) => t.owner === ownerFilter);

    list.sort((a, b) => {
      const da = a.dueDate || "";
      const db = b.dueDate || "";
      return sortDue === "asc" ? da.localeCompare(db) : db.localeCompare(da);
    });

    return list;
  }, [tasks, search, statusFilter, ownerFilter, sortDue]);

  const owners = useMemo(() => {
    const set = new Set(tasks.map((t) => t.owner));
    return ["All", ...Array.from(set)];
  }, [tasks]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Digital Team Task Tracker</h1>
          <div style={{ color: "#6b7280", marginTop: 6, fontSize: 13 }}>
            Track tasks with owners, priority, due dates, and stakeholders.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => downloadCSV(filteredTasks)}
            style={styles.secondaryBtn}
            title="Download current filtered view as CSV"
          >
            Export CSV
          </button>
          <div style={styles.pill}>{filteredTasks.length} tasks</div>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>{editingTask ? "Edit Task" : "Add Task"}</h2>
          <TaskForm
            key={editingTask?.id || "new"}
            initialTask={editingTask}
            onCancel={() => setEditingId(null)}
            onSubmit={(task) => (editingTask ? updateTask(task) : addTask(task))}
          />
        </div>

        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Tasks</h2>
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

          <TaskTable tasks={filteredTasks} onEdit={setEditingId} onDelete={deleteTask} />
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
    background: "rgba(255,255,255,0.75)",
    backdropFilter: "blur(6px)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  grid: {
    maxWidth: 1150,
    margin: "0 auto",
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
  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "white",
    outline: "none",
    flex: "1 1 200px",
  },
  pill: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontSize: 12,
    fontWeight: 700,
    color: "#111827",
  },
  secondaryBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
};
