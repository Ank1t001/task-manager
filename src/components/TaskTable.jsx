import { useMemo, useState } from "react";

const STATUS_OPTIONS = ["To Do", "In Progress", "Done"];
const PRIORITY_OPTIONS = ["High", "Medium", "Low"];

function pillStyle(priority) {
  const p = String(priority || "").toLowerCase();
  if (p === "high") return { borderColor: "rgba(239,68,68,0.55)", background: "rgba(239,68,68,0.12)" };
  if (p === "low") return { borderColor: "rgba(34,197,94,0.55)", background: "rgba(34,197,94,0.12)" };
  return { borderColor: "rgba(245,158,11,0.55)", background: "rgba(245,158,11,0.12)" };
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
  dueFrom,
  setDueFrom,
  dueTo,
  setDueTo,

  onDelete,
  onUpdateTask,

  canEditAny,
  canEditTask,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const typeOptions = useMemo(() => {
    const unique = new Set((allTypeOptions || []).filter((x) => x && x !== "All"));
    // keep existing
    return Array.from(unique).sort();
  }, [allTypeOptions]);

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

  function canEditRow(t) {
    return !!(canEditAny || canEditTask?.(t));
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Filters */}
      <div className="dtt-card" style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="dtt-input"
            placeholder="Search tasks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 240 }}
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

          <input className="dtt-input" type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} style={{ width: 170 }} />
          <input className="dtt-input" type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} style={{ width: 170 }} />

          <button className="dtt-btn" onClick={() => { setQuery(""); setStatusFilter("All"); setOwnerFilter("All"); setDueFrom(""); setDueTo(""); }}>
            Clear
          </button>

          <span className="dtt-pill">{tasks.length} tasks</span>
        </div>
      </div>

      {/* Table */}
      <div className="dtt-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.18)" }}>
                <Th>Task</Th>
                <Th>Description</Th>
                <Th>Owner</Th>
                <Th>Type</Th>
                <Th>Priority</Th>
                <Th>Due</Th>
                <Th>Status</Th>
                <Th>Stakeholders</Th>
                <Th style={{ textAlign: "right" }}>Actions</Th>
              </tr>
            </thead>

            <tbody>
              {tasks.map((t) => {
                const isEditing = editingId === t.id;
                const editable = canEditRow(t);
                const row = isEditing ? draft : t;

                return (
                  <tr key={t.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <Td>
                      {isEditing ? (
                        <input
                          className="dtt-input"
                          value={row.taskName}
                          onChange={(e) => setDraft((d) => ({ ...d, taskName: e.target.value }))}
                          style={{ width: 240 }}
                        />
                      ) : (
                        <div style={{ fontWeight: 950 }}>{t.taskName}</div>
                      )}
                    </Td>

                    <Td>
                      {isEditing ? (
                        <textarea
                          className="dtt-input"
                          value={row.description || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                          rows={2}
                          style={{ width: 320, resize: "vertical" }}
                        />
                      ) : (
                        <div className="dtt-muted" style={{ maxWidth: 340, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {t.description || "—"}
                        </div>
                      )}
                    </Td>

                    <Td>
                      {isEditing ? (
                        <select
                          className="dtt-select"
                          value={row.owner}
                          onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}
                          disabled={!canEditAny} // admin only
                          style={{ width: 150 }}
                          title={!canEditAny ? "Only Admin can change owner" : ""}
                        >
                          {(allOwnerOptions || []).filter((x) => x !== "All").map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="dtt-pill">{t.owner}</span>
                      )}
                    </Td>

                    <Td>
                      {isEditing ? (
                        <select
                          className="dtt-select"
                          value={row.section}
                          onChange={(e) => setDraft((d) => ({ ...d, section: e.target.value }))}
                          style={{ width: 160 }}
                        >
                          {[...new Set(["Other", ...typeOptions])].map((x) => (
                            <option key={x} value={x}>{x}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="dtt-pill">{t.section}</span>
                      )}
                    </Td>

                    <Td>
                      {isEditing ? (
                        <select
                          className="dtt-select"
                          value={row.priority}
                          onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}
                          style={{ width: 140 }}
                        >
                          {PRIORITY_OPTIONS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="dtt-pill" style={{ ...pillStyle(t.priority) }}>
                          {t.priority}
                        </span>
                      )}
                    </Td>

                    <Td>
                      {isEditing ? (
                        <input
                          className="dtt-input"
                          type="date"
                          value={row.dueDate || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                          style={{ width: 160 }}
                        />
                      ) : (
                        <span className="dtt-pill">{t.dueDate || "—"}</span>
                      )}
                    </Td>

                    <Td>
                      {isEditing ? (
                        <select
                          className="dtt-select"
                          value={row.status}
                          onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                          style={{ width: 160 }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="dtt-pill">{t.status}</span>
                      )}
                    </Td>

                    <Td>
                      {isEditing ? (
                        <input
                          className="dtt-input"
                          value={row.externalStakeholders || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, externalStakeholders: e.target.value }))}
                          placeholder="Vendor, agency, partner"
                          style={{ width: 240 }}
                        />
                      ) : (
                        <div className="dtt-muted" style={{ maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {t.externalStakeholders || "—"}
                        </div>
                      )}
                    </Td>

                    <Td style={{ textAlign: "right" }}>
                      {!isEditing ? (
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
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
                            disabled={!canEditAny && !editable}
                            title={!canEditAny && !editable ? "You can only delete your own tasks." : ""}
                            onClick={() => onDelete(t.id)}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
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
                    <div className="dtt-muted" style={{ padding: 16 }}>
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