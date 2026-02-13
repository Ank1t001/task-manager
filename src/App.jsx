import { useEffect, useMemo, useState } from "react";
import MiniDashboard from "./components/MiniDashboard";
import TaskTable from "./components/TaskTable";
import TaskForm from "./components/TaskForm";
import Modal from "./components/Modal";

const ADMIN_EMAIL = "ankit@digijabber.com";
const BUILD_VERSION = "v8.2-dashboard-date-range-no-blocked";

const TEAM_MAP = {
  "ankit@digijabber.com": "Ankit",
  "ankit@equiton.com": "Ankit",
  "sheel@equiton.com": "Sheel",
  "sheelp@equiton.com": "Sheel",
  "aditi@equiton.com": "Aditi",
  "jacob@equiton.com": "Jacob",
  "vanessa@equiton.com": "Vanessa",
  "mandeep@equiton.com": "Mandeep",
};

const normalizeEmail = (v = "") => String(v).trim().toLowerCase();

/** -----------------------------
 *  Metrics logic (NO BLOCKED TILE)
 *  - Overdue: past due + (To Do / In Progress / Blocked)
 *  - In Progress: In Progress AND not overdue
 *  - Blocked tasks (not overdue) are counted inside In Progress (since Blocked removed)
 *  - Done: status Done
 *  - Total: all tasks in the list
 *  ----------------------------- */
function statusKey(status = "") {
  return String(status).trim().toLowerCase().replace(/[\s-]+/g, "");
}
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function dueDateAsDate(dueDate) {
  if (!dueDate) return null;
  const d = new Date(`${dueDate}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}
function isPastDue(task) {
  const due = dueDateAsDate(task?.dueDate);
  if (!due) return false;
  return due < startOfToday();
}
function isOverdueBucket(task) {
  const s = statusKey(task?.status);
  const active = s === "todo" || s === "inprogress" || s === "blocked";
  return active && isPastDue(task);
}
function computeDashboardCounts(taskList) {
  const total = taskList.length;

  let overdue = 0;
  let inProgress = 0;
  let done = 0;

  for (const t of taskList) {
    const s = statusKey(t?.status);

    if (isOverdueBucket(t)) {
      overdue++;
      continue;
    }

    if (s === "done") {
      done++;
      continue;
    }

    // Blocked removed → treat as In Progress (as long as NOT overdue)
    if (s === "inprogress" || s === "blocked") {
      inProgress++;
      continue;
    }
  }

  return { total, overdue, inProgress, done };
}

/** -----------------------------
 *  DB row <-> UI mapping
 *  - DB uses: type
 *  - UI uses: section (label "Type")
 *  - Map Blocked -> In Progress so UI never shows "Blocked"
 *  ----------------------------- */
function normalizeStatusForUI(status) {
  const s = statusKey(status);
  if (s === "blocked") return "In Progress";
  if (s === "inprogress") return "In Progress";
  if (s === "todo") return "To Do";
  if (s === "done") return "Done";
  return status || "To Do";
}

function dbRowToUiTask(row) {
  return {
    id: row.id,
    taskName: row.taskName || "",
    description: row.description || "",
    owner: row.owner || "Ankit",
    ownerEmail: row.ownerEmail || "",
    section: row.type || "Other",
    priority: row.priority || "Medium",
    status: normalizeStatusForUI(row.status),
    dueDate: row.dueDate || "",
    externalStakeholders: row.externalStakeholders || "",
    createdAt: row.createdAt || "",
    updatedAt: row.updatedAt || "",
  };
}

function uiTaskToDbPayload(task) {
  // Ensure Blocked never gets written going forward
  const cleanedStatus = normalizeStatusForUI(task.status);

  return {
    id: task.id,
    taskName: task.taskName || "",
    description: task.description || "",
    owner: task.owner || "",
    ownerEmail: task.ownerEmail || "",
    type: task.section || "Other",
    priority: task.priority || "Medium",
    status: cleanedStatus,
    dueDate: task.dueDate || "",
    externalStakeholders: task.externalStakeholders || "",
  };
}

/** -----------------------------
 *  Date Range Filter helper
 *  - Filter uses dueDate field (YYYY-MM-DD)
 *  - If date range is set, tasks without dueDate are excluded
 *  ----------------------------- */
function inDateRange(dueDate, from, to) {
  if (!from && !to) return true;
  if (!dueDate) return false;
  if (from && dueDate < from) return false;
  if (to && dueDate > to) return false;
  return true;
}

/** CSV Export */
function downloadCSV(filename, rows) {
  const headers = [
    "Task Name",
    "Task Description",
    "Owner",
    "Owner Email",
    "Type",
    "Priority",
    "Due Date",
    "Status",
    "External Stakeholders",
    "Created At",
    "Updated At",
  ];

  const escape = (v) => {
    const s = String(v ?? "");
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((t) =>
      [
        t.taskName,
        t.description,
        t.owner,
        t.ownerEmail,
        t.section,
        t.priority,
        t.dueDate,
        t.status,
        t.externalStakeholders,
        t.createdAt,
        t.updatedAt,
      ]
        .map(escape)
        .join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Owner -> Email mapping used when creating tasks */
function ownerEmailFromOwner(owner) {
  const o = String(owner || "").trim().toLowerCase();
  if (!o) return "";
  if (o === "ankit") return "ankit@digijabber.com";
  if (o === "sheel") return "sheelp@equiton.com";
  if (o === "aditi") return "aditi@equiton.com";
  if (o === "jacob") return "jacob@equiton.com";
  if (o === "vanessa") return "vanessa@equiton.com";
  if (o === "mandeep") return "mandeep@equiton.com";
  return "";
}

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem("dtt_theme") || "light");
  const [tab, setTab] = useState("dashboard");

  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState("");

  const [showModal, setShowModal] = useState(false);

  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("Member");
  const [isAuthed, setIsAuthed] = useState(false);

  // Global filters (apply to Tasks + Dashboard)
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); // Blocked removed from choices in TaskTable
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");

  // Theme
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("dtt_theme", theme);
  }, [theme]);

  /** Identity */
  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });

        if (res.status === 401) {
          if (!alive) return;
          setIsAuthed(false);
          setUserEmail("");
          setUserName("");
          setRole("Member");
          return;
        }

        const data = await res.json();
        const email = normalizeEmail(data?.email);

        if (!alive) return;

        setIsAuthed(true);
        setUserEmail(email);

        const isAdminNow = email === normalizeEmail(ADMIN_EMAIL);
        setRole(isAdminNow ? "Admin" : "Member");

        const mapped = TEAM_MAP[email];
        const fallback = email ? email.split("@")[0] : "Member";
        setUserName(mapped || fallback);
      } catch {
        if (!alive) return;
        setIsAuthed(false);
        setUserEmail("");
        setUserName("");
        setRole("Member");
      }
    }

    loadMe();
    return () => {
      alive = false;
    };
  }, []);

  /** Load tasks from D1 via /api/tasks */
  async function loadTasks() {
    try {
      setLoadingTasks(true);
      setTasksError("");

      const res = await fetch("/api/tasks", { cache: "no-store" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to load tasks (${res.status}) ${txt}`);
      }

      const data = await res.json();
      const uiTasks = Array.isArray(data) ? data.map(dbRowToUiTask) : [];
      setTasks(uiTasks);
    } catch (e) {
      setTasks([]);
      setTasksError(e?.message || "Failed to load tasks");
    } finally {
      setLoadingTasks(false);
    }
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** CRUD */
  async function createTask(uiTask) {
    const payload = uiTaskToDbPayload(uiTask);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Create failed (${res.status}) ${txt}`);
    }
    await loadTasks();
  }

  async function updateTask(uiTask) {
    const payload = uiTaskToDbPayload(uiTask);
    const res = await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Update failed (${res.status}) ${txt}`);
    }
    await loadTasks();
  }

  async function deleteTask(id) {
    const res = await fetch(`/api/tasks?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Delete failed (${res.status}) ${txt}`);
    }
    await loadTasks();
  }

  /** Owner options */
  const ownerOptions = useMemo(() => {
    const set = new Set(tasks.map((t) => t.owner).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [tasks]);

  /** Base filtered tasks (query + status + date range) */
  const baseFilteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();

    return tasks.filter((t) => {
      const matchesQuery =
        !q ||
        (t.taskName || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.section || "").toLowerCase().includes(q) ||
        (t.externalStakeholders || "").toLowerCase().includes(q);

      const matchesStatus = statusFilter === "All" || t.status === statusFilter;
      const matchesDate = inDateRange(t.dueDate, dueFrom, dueTo);

      return matchesQuery && matchesStatus && matchesDate;
    });
  }, [tasks, query, statusFilter, dueFrom, dueTo]);

  /** Table filtered tasks (includes owner filter) */
  const tableFilteredTasks = useMemo(() => {
    if (ownerFilter === "All") return baseFilteredTasks;
    return baseFilteredTasks.filter((t) => t.owner === ownerFilter);
  }, [baseFilteredTasks, ownerFilter]);

  /** Dashboard counts */
  const teamCounts = useMemo(
    () => computeDashboardCounts(baseFilteredTasks),
    [baseFilteredTasks]
  );

  const selectedOwner = useMemo(() => {
    if (ownerFilter !== "All") return ownerFilter;
    return userName || "";
  }, [ownerFilter, userName]);

  const selectedOwnerTasks = useMemo(() => {
    const name = (selectedOwner || "").trim();
    if (!name) return [];
    return baseFilteredTasks.filter((t) => (t.owner || "").trim() === name);
  }, [baseFilteredTasks, selectedOwner]);

  const selectedOwnerCounts = useMemo(
    () => computeDashboardCounts(selectedOwnerTasks),
    [selectedOwnerTasks]
  );

  /** Permissions */
  const isAdminNow = normalizeEmail(userEmail) === normalizeEmail(ADMIN_EMAIL);
  const canEditAny = isAdminNow;
  const canEditTask = (task) => {
    if (isAdminNow) return true;
    return (task?.owner || "").trim() === (userName || "").trim();
  };

  /** Auth handlers */
  function handleLogin() {
    const returnTo = window.location.origin + "/";
    window.location.href = `/api/login?returnTo=${encodeURIComponent(returnTo)}`;
  }
  function handleLogout() {
    const returnTo = window.location.origin + "/";
    window.location.href = `/api/logout?returnTo=${encodeURIComponent(returnTo)}`;
  }

  function handleExportCSV() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`tasks_${stamp}.csv`, tableFilteredTasks);
  }

  return (
    <div className="dtt-page">
      <div className="dtt-shell">
        {/* Header */}
        <div className="dtt-card">
          <div className="dtt-titleRow" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="dtt-dot" />
                <div className="dtt-h1">Digital Team Task Tracker</div>
              </div>

              <div className="dtt-muted" style={{ marginTop: 6 }}>
                Signed in: {userEmail || "Unknown"} ({role}
                {userName ? `: ${userName}` : ""}) • {BUILD_VERSION}
              </div>
            </div>

            <div className="dtt-actions">
              <button
                className="dtt-btn"
                onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              >
                {theme === "light" ? "Dark Mode" : "Light Mode"}
              </button>

              {!isAuthed ? (
                <button className="dtt-btnPrimary" onClick={handleLogin}>
                  Login
                </button>
              ) : (
                <>
                  <button className="dtt-btn" onClick={handleLogout}>
                    Logout
                  </button>
                  <button className="dtt-btn" onClick={handleExportCSV}>
                    Export CSV
                  </button>
                </>
              )}

              <span className="dtt-pill">
                {loadingTasks ? "Loading…" : `${tasks.length} tasks`}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
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

          <button className="dtt-btnPrimary" onClick={() => setShowModal(true)}>
            + New Task
          </button>
        </div>

        {/* Content */}
        <div className="dtt-card">
          {tasksError ? (
            <div className="dtt-muted">
              <b>Tasks API Error:</b> {tasksError}
            </div>
          ) : null}

          {tab === "dashboard" && (
            <div style={{ display: "grid", gap: 14 }}>
              {/* ✅ Date Range Filter bar above Overall Team */}
              <div className="dtt-card" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>Date Range Filter</div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      className="dtt-input"
                      type="date"
                      value={dueFrom}
                      onChange={(e) => setDueFrom(e.target.value)}
                      title="Due date from"
                      style={{ width: 170 }}
                    />
                    <input
                      className="dtt-input"
                      type="date"
                      value={dueTo}
                      onChange={(e) => setDueTo(e.target.value)}
                      title="Due date to"
                      style={{ width: 170 }}
                    />

                    <button
                      className="dtt-btn"
                      type="button"
                      onClick={() => {
                        setDueFrom("");
                        setDueTo("");
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="dtt-muted" style={{ marginTop: 8 }}>
                  Applies to Dashboard tiles and Tasks view.
                </div>
              </div>

              {/* Overall Team */}
              <div className="dtt-card" style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>Overall Team</div>
                  <div className="dtt-muted">{baseFilteredTasks.length} tasks (filtered)</div>
                </div>
                <div className="dtt-muted" style={{ marginTop: 6 }}>
                  Filters applied: Status={statusFilter}, Due={dueFrom || "—"} → {dueTo || "—"}
                  {query ? `, Search="${query}"` : ""}
                </div>
              </div>

              <MiniDashboard counts={teamCounts} />

              {/* My / Selected Owner */}
              <div className="dtt-card" style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>
                    {ownerFilter !== "All" ? "Selected Owner" : "My"} Tasks
                  </div>
                  <div className="dtt-muted">
                    Owner: <b>{selectedOwner || "Unknown"}</b> • {selectedOwnerTasks.length} tasks
                  </div>
                </div>
              </div>

              <MiniDashboard counts={selectedOwnerCounts} />

              <div className="dtt-muted" style={{ marginTop: 2 }}>
                Debug: total={tasks.length}, baseFiltered={baseFilteredTasks.length}, selectedOwner={selectedOwner || "—"}
              </div>
            </div>
          )}

          {tab === "tasks" && (
            <>
              {loadingTasks ? (
                <div className="dtt-muted">Loading tasks…</div>
              ) : (
                <TaskTable
                  tasks={tableFilteredTasks}
                  allOwnerOptions={ownerOptions}
                  query={query}
                  setQuery={setQuery}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  ownerFilter={ownerFilter}
                  setOwnerFilter={setOwnerFilter}
                  dueFrom={dueFrom}
                  setDueFrom={setDueFrom}
                  dueTo={dueTo}
                  setDueTo={setDueTo}
                  onDelete={async (id) => deleteTask(id)}
                  onUpdateTask={async (t) => updateTask(t)}
                  canEditAny={canEditAny}
                  canEditTask={canEditTask}
                />
              )}
            </>
          )}
        </div>

        {/* Modal */}
        <Modal
          open={showModal}
          title="Create a new task"
          subtitle="Fill details and save."
          onClose={() => setShowModal(false)}
        >
          <TaskForm
            onSubmit={async (task) => {
              const ownerEmail = ownerEmailFromOwner(task.owner) || "";
              await createTask({ ...task, ownerEmail });
              setShowModal(false);
              setTab("tasks");
            }}
            onCancel={() => setShowModal(false)}
          />
        </Modal>
      </div>
    </div>
  );
}