function badgeStyleForPriority(priority = "") {
  const p = String(priority).trim().toLowerCase();
  const base = {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    fontWeight: 900,
    fontSize: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
  if (p === "high") return { ...base, borderColor: "rgba(255, 80, 80, 0.55)", background: "rgba(255, 80, 80, 0.14)" };
  if (p === "medium") return { ...base, borderColor: "rgba(255, 200, 0, 0.55)", background: "rgba(255, 200, 0, 0.14)" };
  if (p === "low") return { ...base, borderColor: "rgba(50, 205, 120, 0.55)", background: "rgba(50, 205, 120, 0.14)" };
  return base;
}

function Badge({ children, style }) {
  return <span style={style}>{children}</span>;
}

function Btn({ children, onClick, disabled, title }) {
  return (
    <button
      type="button"
      className="dtt-btn"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{ padding: "8px 10px", opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  );
}

export default function TaskTable({
  tasks,
  onDelete,
  onUpdateTask,
  canEditAny,
  canEditTask,

  allOwnerOptions = ["All"],
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  ownerFilter,
  setOwnerFilter,
  dueFrom,
  setDueFrom,
  dueTo,
  setDueTo,
}) {
  function setStatus(task, nextStatus) {
    if (!task?.id) return;
    if (!(canEditAny || canEditTask?.(task))) return;
    onUpdateTask?.({ ...task, status: nextStatus });
  }

  function clearFilters() {
    setQuery?.("");
    setStatusFilter?.("All");
    setOwnerFilter?.("All");
    setDueFrom?.("");
    setDueTo?.("");
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="dtt-input"
            placeholder="Search tasks, description, type, stakeholders..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 340 }}
          />

          <select
            className="dtt-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 170 }}
          >
            <option value="All">All Status</option>
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
          </select>

          <select
            className="dtt-select"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            style={{ width: 170 }}
          >
            {allOwnerOptions.map((o) => (
              <option key={o} value={o}>
                {o === "All" ? "All Owners" : o}
              </option>
            ))}
          </select>

          <input
            className="dtt-input"
            type="date"
            value={dueFrom}
            onChange={(e) => setDueFrom(e.target.value)}
            title="Due date from"
            style={{ width: 165 }}
          />
          <input
            className="dtt-input"
            type="date"
            value={dueTo}
            onChange={(e) => setDueTo(e.target.value)}
            title="Due date to"
            style={{ width: 165 }}
          />

          <Btn title="Reset all filters" onClick={clearFilters}>
            Clear
          </Btn>
        </div>

        <span style={{ color: "var(--muted)", fontWeight: 900 }}>{tasks.length} shown</span>
      </div>

      {/* Table */}
      <div
        style={{
          overflowX: "auto",
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              {["Task", "Owner", "Type", "Priority", "Due", "Status", "Stakeholders", "Actions"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "12px 12px",
                      fontSize: 12,
                      letterSpacing: 0.3,
                      color: "var(--muted)",
                      borderBottom: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {tasks.map((t, idx) => {
              const editable = canEditAny || canEditTask?.(t);

              return (
                <tr key={t.id || idx}>
                  <td style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 950 }}>{t.taskName || "(No task name)"}</div>

                    {t.description ? (
                      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                        {t.description}
                      </div>
                    ) : null}

                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
                      Created: {t.createdAt ? new Date(t.createdAt).toLocaleString() : "-"}
                    </div>
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
                    {t.owner || "-"}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
                    {t.section || "-"}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
                    <Badge style={badgeStyleForPriority(t.priority)}>
                      {t.priority || "Medium"}
                    </Badge>
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
                    {t.dueDate || "-"}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
                    <select
                      className="dtt-select"
                      value={t.status || "To Do"}
                      onChange={(e) => setStatus(t, e.target.value)}
                      disabled={!editable}
                      style={{ width: 150 }}
                    >
                      <option>To Do</option>
                      <option>In Progress</option>
                      <option>Done</option>
                    </select>
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
                    <div
                      style={{
                        maxWidth: 260,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {t.externalStakeholders || "-"}
                    </div>
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn
                        title={editable ? "Delete task" : "You can only delete your own tasks"}
                        disabled={!editable}
                        onClick={() => onDelete?.(t.id)}
                      >
                        Delete
                      </Btn>
                    </div>
                  </td>
                </tr>
              );
            })}

            {tasks.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 16, color: "var(--muted)" }}>
                  No tasks match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}