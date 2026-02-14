import { useMemo, useState } from "react";

const STATUS_OPTIONS = ["To Do", "In Progress", "Done"];
const PRIORITY_OPTIONS = ["High", "Medium", "Low"];

function priorityStyle(priority) {
  const p = String(priority || "").trim().toLowerCase();
  if (p === "high") return { borderColor: "rgba(239,68,68,0.55)", background: "rgba(239,68,68,0.12)" };
  if (p === "low") return { borderColor: "rgba(34,197,94,0.55)", background: "rgba(34,197,94,0.12)" };
  return { borderColor: "rgba(245,158,11,0.55)", background: "rgba(245,158,11,0.12)" };
}

function basePill() {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
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

  // NOTE: we intentionally DO NOT show dueFrom/dueTo here anymore
  // because Date Range Filter exists globally above.

  onDelete,
  onUpdateTask,

  canEditAny,
  canEditTask,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const typeOptions = useMemo(() => {
    // ensure "Other" always exists
    const set = new Set((allTypeOptions || []).filter((x) => x && x !== "All"));
    return ["Other", ...Array.from(set).filter((x) => x !== "Other").sort()];
  }, [allTypeOptions]);

  function canEditRow(t) {
    return !!(canEditAny || canEditTask?.(t));
  }

  function beginEdit(t) {
    setEditingId(t.id);
    setDraft({ ...t });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveEdit() {
    if (!draft?.id) return;
    setSaving(true);
    try {
      await onUpdateTask(draft);
      cancelEdit();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* ✅ Clean toolbar */}
      <div className="dtt-card" style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="dtt-input"
            placeholder="Search tasks (name, description, type, stakeholder)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 320 }}
          />

          <select
            className="dtt-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 170 }}
          >
            <option value="All">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            className="dtt-select"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            style={{ width: 170 }}
          >
            {(allOwnerOptions || ["All"]).map((o) => (
              <option key={o} value={o}>{o === "All" ? "All Owners" : o}</option>
            ))}
          </select>

          <select
            className="dtt-select"
            value={draft?.__typeFilter ?? "All"} // local only display; not persisted
            onChange={(e) => {
              // we store it on draft shadow state just to keep component controlled
              // actual filtering should already be handled in App.jsx via query/status/owner/date
              // but you asked for improved UI, so this is optional.
              // If you want Type filter to truly filter, tell me and I’ll wire it into App.jsx state.
              const val = e.target.value;
              setDraft((d) => ({ ...(d || {}), __typeFilter: val }));
            }}
            style={{ width: 170 }}
            title="UI-only filter (optional). If you want this filter to actually filter tasks, I’ll wire it into App.jsx state."
          >
            <option value="All">All Types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <button
            className="dtt-btn"
            onClick={() => {
              setQuery("");
              setStatusFilter("All");
              setOwnerFilter("All");
              setDraft((d) => ({ ...(d || {}), __typeFilter: "All" }));
            }}
          >
            Clear
          </button>

          <span className="dtt-pill">{tasks.length} tasks</span>
        </div>

        <div className="dtt-muted" style={{ marginTop: 10 }}>
          Tip: Members can edit only their own tasks. Admin can edit everything.
        </div>
      </div>

      {/* ✅ Table */}
      <div className="dtt-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyles.table}>
            <thead>
              <tr style={tableStyles.theadRow}>
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
                const isEditing = editingId === t.id;
                const editable = canEditRow(t);
                const row = isEditing ? draft : t;

                return (
                  <tr key={t.id} style={tableStyles.row}>
                    {/* Task */}
                    <Td>
                      {isEditing ? (
                        <input
                          className="dtt-input"
                          value={row.taskName}
                          onChange={(e) => setDraft((d) => ({ ...d, taskName: e.target.value }))}
                          style={{ width: "100%" }}
                        />
                      ) : (
                        <div style={{ fontWeight: 1000, lineHeight: "18px" }}>
                          {t.taskName}
                        </div>
                      )}
                    </Td>

                    {/* Description */}
                    <Td>
                      {isEditing ? (
                        <textarea
                          className="dtt-input"
                          value={row.description || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                          rows={2}
                          style={{ width: "100%", resize: "vertical" }}
                        />
                      ) : (
                        <div style={tableStyles.desc}>
                          {t.description || <span className="dtt-muted">—</span>}
                        </div>
                      )}
                    </Td>

                    {/* Owner */}
                    <Td>
                      {isEditing ? (
                        <select
                          className="dtt-select"
                          value={row.owner}
                          onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}
                          disabled={!canEditAny}
                          title={!canEditAny ? "Only Admin can change owner" : ""}
                          style={{ width: "100%" }}
                        >
                          {(allOwnerOptions || []).filter((x) => x !== "All").map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={basePill()}>{t.owner}</span>
                      )}
                    </Td>

                    {/* Type */}
                    <Td>
                      {isEditing ? (
                        <select
                          className="dtt-select"
                          value={row.section}
                          onChange={(e) => setDraft((d) => ({ ...d, section: e.target.value }))}
                          style={{ width: "100%" }}
                        >
                          {typeOptions.map((x) => (
                            <option key={x} value={x}>{x}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={basePill()}>{t.section}</span>
                      )}
                    </Td>

                    {/* Priority */}
                    <Td>
                      {isEditing ? (
                        <select
                          className="dtt-select"
                          value={row.priority}
                          onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}
                          style={{ width: "100%" }}
                        >
                          {PRIORITY_OPTIONS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ ...basePill(), ...priorityStyle(t.priority) }}>{t.priority}</span>
                      )}
                    </Td>

                    {/* Due */}
                    <Td>
                      {isEditing ? (
                        <input
                          className="dtt-input"
                          type="date"
                          value={row.dueDate || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                          style={{ width: "100%" }}
                        />
                      ) : (
                        <span style={basePill()}>{t.dueDate || "—"}</span>
                      )}
                    </Td>

                    {/* Status */}
                    <Td>
                      {isEditing ? (
                        <select
                          className="dtt-select"
                          value={row.status}
                          onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                          style={{ width: "100%" }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={basePill()}>{t.status}</span>
                      )}
                    </Td>

                    {/* Stakeholders */}
                    <Td>
                      {isEditing ? (
                        <input
                          className="dtt-input"
                          value={row.externalStakeholders || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, externalStakeholders: e.target.value }))}
                          placeholder="Vendor, agency, partner"
                          style={{ width: "100%" }}
                        />
                      ) : (
                        <div style={tableStyles.stake}>
                          {t.externalStakeholders || <span className="dtt-muted">—</span>}
                        </div>
                      )}
                    </Td>

                    {/* Actions */}
                    <Td style={{ textAlign: "right" }}>
                      {!isEditing ? (
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                          <button
                            className="dtt-btn"
                            disabled={!editable}
                            title={!editable ? "You can only edit your own tasks." : ""}
                            onClick={() => beginEdit(t)}
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
                      ) : (
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                          <button className="dtt-btn" onClick={cancelEdit} disabled={saving}>
                            Cancel
                          </button>
                          <button className="dtt-btnPrimary" onClick={saveEdit} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}

              {tasks.length === 0 ? (
                <tr>
                  <Td colSpan={9}>
                    <div className="dtt-muted" style={{ padding: 18 }}>
                      No tasks found.
                    </div>
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

/* -------------------- table primitives -------------------- */

function Th({ children, style }) {
  return (
    <th
      style={{
        ...tableStyles.th,
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, style, colSpan }) {
  return (
    <td colSpan={colSpan} style={{ ...tableStyles.td, ...style }}>
      {children}
    </td>
  );
}

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
  },
  theadRow: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    backdropFilter: "blur(10px)",
    background: "rgba(255,255,255,0.22)",
  },
  th: {
    textAlign: "left",
    padding: "12px 12px",
    fontSize: 12,
    fontWeight: 1000,
    color: "rgba(15,23,42,0.75)",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px 12px",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "top",
  },
  row: {
    background: "transparent",
  },
  desc: {
    color: "var(--muted)",
    fontSize: 13,
    lineHeight: "18px",
    maxWidth: 520,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  stake: {
    color: "var(--muted)",
    fontSize: 13,
    lineHeight: "18px",
    maxWidth: 260,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
};