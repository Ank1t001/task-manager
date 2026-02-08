import { useEffect, useMemo, useState } from "react";
import TaskForm from "./components/TaskForm";
import TaskTable from "./components/TaskTable";

const STORAGE_KEY = "task_manager_tasks_v1";

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
  const [tasks, setTasks] = useState(() => loadTasks());
  const [editingId, setEditingId] = useState(null);

  // Simple filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [sortDue, setSortDue] = useState("asc"); // asc | desc

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

    if (statusFilter !== "All") {
      list = list.filter((t) => t.status === statusFilter);
    }

    if (ownerFilter !== "All") {
      list = list.filter((t) => t.owner === ownerFilter);
    }

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
    <div style={{ maxWidth: 1100, margin: "30px auto", padding: 16, fontFamily: "Arial" }}>
      <h1 style={{ marginBottom: 8 }}>Task Manager</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Fields: Task Name, Owner, Priority, Due date, Status, External stakeholders
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start" }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>{editingTask ? "Edit Task" : "Add Task"}</h2>
          <TaskForm
            key={editingTask?.id || "new"}
            initialTask={editingTask}
            onCancel={() => setEditingId(null)}
            onSubmit={(task) => {
              if (editingTask) updateTask(task);
              else addTask(task);
            }}
          />
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Tasks</h2>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by task name..."
              style={{ padding: 8, flex: "1 1 220px" }}
            />

            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} style={{ padding: 8 }}>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: 8 }}>
              {["All", "To Do", "In Progress", "Blocked", "Done"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select value={sortDue} onChange={(e) => setSortDue(e.target.value)} style={{ padding: 8 }}>
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
