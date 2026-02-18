import { useMemo, useState } from "react";
import TaskStageProgress from "./TaskStageProgress";

const STATUS_OPTIONS = ["To Do", "In Progress", "Done"];

function priorityStyle(priority) {
  const p = String(priority || "").trim().toLowerCase();
  if (p === "high") return { borderColor: "rgba(239,68,68,0.55)", background: "rgba(239,68,68,0.12)" };
  if (p === "low")  return { borderColor: "rgba(34,197,94,0.55)",  background: "rgba(34,197,94,0.12)" };
  return { borderColor: "rgba(245,158,11,0.55)", background: "rgba(245,158,11,0.12)" };
}

function pillBase() {
  return {
    display: "inline-flex", alignItems: "center", padding: "6px 10px",
    borderRadius: 999, border: "1px solid var(--border)", fontWeight: 900,
    fontSize: 12, background: "rgba(255,255,255,0.10)", whiteSpace: "nowrap",
  };
}

export default function TaskTable({
  tasks, allOwnerOptions, allTypeOptions,
  query, setQuery, statusFilter, setStatusFilter, ownerFilter, setOwnerFilter,
  onDelete, onEdit,
  canEditAny, canEditTask,
  getToken,          // NEW — for stage progress fetch
  projectStages,     // NEW — [{stageName, sortOrder, stageOwnerEmail}] for the current project
}) {
  const [expandedTask, setExpandedTask] = useState(null);

  const typeOptions = useMemo(() => {
    const set = new Set((allTypeOptions || []).filter(x => x && x !== "All"));
    return ["All", ...Array.from(set).sort()];
  }, [allTypeOptions]);

  function canEditRow(t) { return !!(canEditAny || canEditTask?.(t)); }

  // Only show stage progress column if we have project stages context
  const hasStages = Array.isArray(projectStages) && projectStages.length > 0;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Toolbar */}
      <div className="dtt-card" style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input className="dtt-input" placeholder="Search tasks..." value={query}
            onChange={e => setQuery(e.target.value)} style={{ width: 340 }} />
          <select className="dtt-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160 }}>
            <option value="All">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="dtt-select" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={{ width: 160 }}>
            {(allOwnerOptions || ["All"]).map(o => <option key={o} value={o}>{o === "All" ? "All Owners" : o}</option>)}
          </select>
          <button className="dtt-btn" onClick={() => { setQuery(""); setStatusFilter("All"); setOwnerFilter("All"); }}>Clear</button>
          <span className="dtt-pill">{tasks.length} tasks</span>
        </div>
      </div>

      {/* Table */}
      <div className="dtt-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, zIndex: 2, backdropFilter: "blur(10px)", background: "rgba(255,255,255,0.22)" }}>
                <Th style={{ width: 240 }}>Task</Th>
                <Th style={{ width: 320 }}>Description</Th>
                <Th style={{ width: 130 }}>Owner</Th>
                <Th style={{ width: 120 }}>Priority</Th>
                <Th style={{ width: 120 }}>Due</Th>
                <Th style={{ width: 130 }}>Status</Th>
                {hasStages && <Th style={{ width: 200 }}>Stage Progress</Th>}
                <Th style={{ width: 180, textAlign: "right" }}>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => {
                const editable = canEditRow(t);
                const isExpanded = expandedTask === t.id;
                const stageIdx = hasStages ? projectStages.findIndex(s => s.stageName === t.stage) : -1;

                return (
                  <>
                    <tr key={t.id} style={{ background: isExpanded ? "rgba(77,124,255,0.04)" : undefined }}>
                      <Td>
                        <div style={{ fontWeight: 1000, lineHeight: "18px" }}>{t.taskName}</div>
                        {t.stage && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>📁 {t.stage}</div>}
                      </Td>
                      <Td>
                        <div style={{ color: "var(--muted)", fontSize: 13, maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {t.description || "—"}
                        </div>
                      </Td>
                      <Td><span style={pillBase()}>{t.owner}</span></Td>
                      <Td><span style={{ ...pillBase(), ...priorityStyle(t.priority) }}>{t.priority}</span></Td>
                      <Td><span style={pillBase()}>{t.dueDate || "—"}</span></Td>
                      <Td><span style={pillBase()}>{t.status}</span></Td>

                      {hasStages && (
                        <Td>
                          {/* Compact stage progress bar */}
                          {stageIdx >= 0 ? (
                            <TaskStageProgress
                              taskId={t.id}
                              projectName={t.projectName}
                              currentStageName={t.stage}
                              allProjectStages={projectStages}
                              getToken={getToken}
                              compact={true}
                              onStageAdvanced={() => {}}
                            />
                          ) : (
                            <span style={{ ...pillBase(), fontSize: 11 }}>No stage</span>
                          )}
                        </Td>
                      )}

                      <Td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
                          {hasStages && (
                            <button className="dtt-btn" style={{ fontSize: 12, padding: "5px 10px" }}
                              onClick={() => setExpandedTask(isExpanded ? null : t.id)}>
                              {isExpanded ? "▲" : "▼ Stages"}
                            </button>
                          )}
                          <button className="dtt-btn" disabled={!editable} onClick={() => onEdit?.(t)}>Edit</button>
                          <button className="dtt-btn" disabled={!editable && !canEditAny} onClick={() => onDelete(t.id)}>Delete</button>
                        </div>
                      </Td>
                    </tr>

                    {/* Expanded stage tracker row */}
                    {isExpanded && hasStages && (
                      <tr key={`${t.id}-progress`}>
                        <td colSpan={8} style={{ padding: "0 16px 16px", borderBottom: "1px solid var(--border)", background: "rgba(77,124,255,0.04)" }}>
                          <div style={{ paddingTop: 12 }}>
                            <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10, color: "var(--muted)" }}>
                              Stage Progress — {t.taskName}
                            </div>
                            <TaskStageProgress
                              taskId={t.id}
                              projectName={t.projectName}
                              currentStageName={t.stage}
                              allProjectStages={projectStages}
                              getToken={getToken}
                              compact={false}
                              onStageAdvanced={() => {}}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {tasks.length === 0 && (
                <tr><Td colSpan={hasStages ? 8 : 7}>
                  <div className="dtt-muted" style={{ padding: 18 }}>No tasks found.</div>
                </Td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, style }) {
  return (
    <th style={{ textAlign: "left", padding: "12px 12px", fontSize: 12, fontWeight: 1000,
      color: "rgba(15,23,42,0.75)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", ...style }}>
      {children}
    </th>
  );
}
function Td({ children, style, colSpan }) {
  return (
    <td colSpan={colSpan} style={{ padding: "12px 12px", borderBottom: "1px solid var(--border)", verticalAlign: "top", ...style }}>
      {children}
    </td>
  );
}