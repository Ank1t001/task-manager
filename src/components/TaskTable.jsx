import { useMemo } from "react";

const STATUS_OPTIONS = ["To Do", "In Progress", "Done"];

function priorityStyle(priority) {
  const p = String(priority || "").trim().toLowerCase();
  if (p === "high") return { borderColor: "rgba(239,68,68,0.55)", background: "rgba(239,68,68,0.12)" };
  if (p === "low") return { borderColor: "rgba(34,197,94,0.55)", background: "rgba(34,197,94,0.12)" };
  return { borderColor: "rgba(245,158,11,0.55)", background: "rgba(245,158,11,0.12)" };
}

function pillBase() {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    fontWeight: 900,
    fontSize: 12,
    background: "rgba(255,255,255,0.10)",
    whiteSpace: "nowrap",
  };
}

export default function TaskTable({
  tasks,
  allOwnerOptions,
  allTypeOptions,

  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  ownerFilter,
  setOwnerFilter,

  onDelete,
  onEdit, // ✅ new

  canEditAny,
  canEditTask,
}) {
  const typeOptions = useMemo(() => {
    const set = new Set((allTypeOptions || []).filter((x) => x && x !== "All"));
    return ["All", ...Array.from(set).sort()];
  }, [allTypeOptions]);

  function canEditRow(t) {
    return !!(canEditAny || canEditTask?.(t));
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Toolbar */}
      <div className="dtt-card" style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="dtt-input"
            placeholder="Search tasks (name, description, type, stakeholder)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 360 }}
          />

          <select className="dtt-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 170 }}>
            <option value="All">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select className="dtt-select" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} style={{ width: 170 }}>
            {(allOwnerOptions || ["All"]).map((o) => (
              <option key={o} value={o}>{o === "All" ? "All Owners" : o}</option>
            ))}
          </select>

          <select className="dtt-select" disabled value="All" style={{ width: 170 }} title="Type filter can be wired if you want">
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>
            ))}
          </select>

          <button className="dtt-btn" onClick={() => { setQuery(""); setStatusFilter("All"); setOwnerFilter("All"); }}>
            Clear
          </button>

          <span className="dtt-pill">{tasks.length} tasks</span>
        </div>

        <div className="dtt-muted" style={{ marginTop: 10 }}>
          Tip: Members can edit only their own tasks. Admin can edit everything.
        </div>
      </div>

      {/* Table */}
      <div className="dtt-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, zIndex: 2, backdropFilter: "blur(10px)", background: "rgba(255,255,255,0.22)" }}>
                <Th style={{ width: 260 }}>Task</Th>
                <Th style={{ width: 360 }}>Description</Th>
                <Th style={{ width: 140 }}>Owner</Th>
                <Th style={{ width: 160 }}>Type</Th>
                <Th style={{ width: 130 }}>Priority</Th>
                <Th style={{ width: 140 }}>Due</Th>
                <Th style={{ width: 150 }}>Status</Th>
                <Th style={{ width: 220 }}>Stakeholders</Th>
                <Th style={{ width: 160, textAlign: "right" }}>Actions</Th>
              </tr>
            </thead>

            <tbody>
              {tasks.map((t) => {
                const editable = canEditRow(t);

                return (
                  <tr key={t.id}>
                    <Td>
                      <div style={{ fontWeight: 1000, lineHeight: "18px" }}>{t.taskName}</div>
                    </Td>

                    <Td>
                      <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: "18px", maxWidth: 520, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.description || <span className="dtt-muted">—</span>}
                      </div>
                    </Td>

                    <Td><span style={pillBase()}>{t.owner}</span></Td>
                    <Td><span style={pillBase()}>{t.section}</span></Td>
                    <Td><span style={{ ...pillBase(), ...priorityStyle(t.priority) }}>{t.priority}</span></Td>
                    <Td><span style={pillBase()}>{t.dueDate || "—"}</span></Td>
                    <Td><span style={pillBase()}>{t.status}</span></Td>

                    <Td>
                      <div style={{ color: "var(--muted)", fontSize: 13, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.externalStakeholders || <span className="dtt-muted">—</span>}
                      </div>
                    </Td>

                    <Td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button
                          className="dtt-btn"
                          disabled={!editable}
                          title={!editable ? "You can only edit your own tasks." : ""}
                          onClick={() => onEdit?.(t)}
                        >
                          Edit
                        </button>

                        <button
                          className="dtt-btn"
                          disabled={!editable && !canEditAny}
                          title={!editable && !canEditAny ? "You can only delete your own tasks." : ""}
                          onClick={() => onDelete(t.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}

              {tasks.length === 0 ? (
                <tr>
                  <Td colSpan={9}>
                    <div className="dtt-muted" style={{ padding: 18 }}>No tasks found.</div>
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, style }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "12px 12px",
        fontSize: 12,
        fontWeight: 1000,
        color: "rgba(15,23,42,0.75)",
        borderBottom: "1px solid var(--border)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, style, colSpan }) {
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: "12px 12px",
        borderBottom: "1px solid var(--border)",
        verticalAlign: "top",
        ...style,
      }}
    >
      {children}
    </td>
  );
}