import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const STAGE_COLUMNS = [
  { key: "Brief/Kickoff",       color: { border: "rgba(99,102,241,0.55)",  glow: "rgba(99,102,241,0.12)"  } },
  { key: "Strategy",            color: { border: "rgba(168,85,247,0.55)",  glow: "rgba(168,85,247,0.12)"  } },
  { key: "Creative/Concept",    color: { border: "rgba(236,72,153,0.55)",  glow: "rgba(236,72,153,0.12)"  } },
  { key: "Production",          color: { border: "rgba(245,158,11,0.55)",  glow: "rgba(245,158,11,0.12)"  } },
  { key: "Internal Review",     color: { border: "rgba(59,130,246,0.55)",  glow: "rgba(59,130,246,0.12)"  } },
  { key: "Compliance Review",   color: { border: "rgba(239,68,68,0.55)",   glow: "rgba(239,68,68,0.12)"   } },
  { key: "Revisions (If Any)",  color: { border: "rgba(251,146,60,0.55)",  glow: "rgba(251,146,60,0.12)"  } },
  { key: "Approval",            color: { border: "rgba(20,184,166,0.55)",  glow: "rgba(20,184,166,0.12)"  } },
  { key: "Launch/Execution",    color: { border: "rgba(34,197,94,0.55)",   glow: "rgba(34,197,94,0.12)"   } },
];

function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }

function isOverdueTask(task) {
  if (!task?.dueDate) return false;
  if (task.status === "Done") return false;
  const due = new Date(`${task.dueDate}T00:00:00`);
  if (isNaN(due.getTime())) return false;
  return due < startOfToday();
}

function priorityMeta(priority) {
  const p = String(priority || "").trim().toLowerCase();
  if (p === "high") return { label: "High", border: "rgba(239,68,68,0.55)", bg: "rgba(239,68,68,0.12)" };
  if (p === "low")  return { label: "Low",  border: "rgba(34,197,94,0.55)", bg: "rgba(34,197,94,0.12)" };
  return { label: "Medium", border: "rgba(245,158,11,0.55)", bg: "rgba(245,158,11,0.12)" };
}

function statusDot(status) {
  if (status === "Done")        return { color: "#4ade80", label: "Done" };
  if (status === "In Progress") return { color: "#fbbf24", label: "In Progress" };
  return { color: "rgba(255,255,255,0.3)", label: "To Do" };
}

function buildColumns(tasks) {
  const map = new Map();
  for (const col of STAGE_COLUMNS) map.set(col.key, []);
  map.set("__Other__", []);

  for (const t of tasks) {
    const stage = String(t.stage || "").trim();
    if (stage && map.has(stage)) map.get(stage).push(t);
    else map.get("__Other__").push(t);
  }
  return map;
}

export default function KanbanBoard({ tasks = [], onUpdateTask, canEditAny, canEditTask, getToken }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [kQuery, setKQuery] = useState("");
  const [kOwner, setKOwner] = useState("All");
  const [kStatus, setKStatus] = useState("All");
  const [activeId, setActiveId] = useState(null);

  const ownerOptions = useMemo(() => {
    const s = new Set(tasks.map(t => t.owner).filter(Boolean));
    return ["All", ...Array.from(s).sort()];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = kQuery.trim().toLowerCase();
    return tasks.filter(t => {
      const matchQ = !q || [t.taskName, t.description, t.stage, t.owner].join(" ").toLowerCase().includes(q);
      const matchO = kOwner === "All" || t.owner === kOwner;
      const matchS = kStatus === "All" || t.status === kStatus;
      return matchQ && matchO && matchS;
    });
  }, [tasks, kQuery, kOwner, kStatus]);

  const filtersActive = kQuery.trim() !== "" || kOwner !== "All" || kStatus !== "All";
  const [columns, setColumns] = useState(() => buildColumns(filteredTasks));
  useEffect(() => { setColumns(buildColumns(filteredTasks)); }, [filteredTasks]);

  const taskById = useMemo(() => {
    const m = new Map();
    for (const t of filteredTasks) m.set(String(t.id), t);
    return m;
  }, [filteredTasks]);

  const activeTask = activeId ? taskById.get(String(activeId)) : null;

  function findColumnOfTask(taskId) {
    for (const [key, arr] of columns.entries()) {
      if (arr.some(t => String(t.id) === String(taskId))) return key;
    }
    return null;
  }

  async function persistStageChange(taskId, newStage) {
    try {
      const token = getToken ? await getToken() : null;
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`/api/tasks/${taskId}`, {
        method: "PUT", headers,
        body: JSON.stringify({ stage: newStage }),
      });
    } catch (e) { console.error("persist stage change failed", e); }
  }

  function onDragStart(event) {
    if (filtersActive) return;
    setActiveId(event.active?.id ?? null);
  }

  async function onDragEnd(event) {
    setActiveId(null);
    if (filtersActive) return;

    const { active, over } = event;
    if (!active?.id || !over?.id) return;

    const activeTaskRaw = taskById.get(String(active.id));
    if (!activeTaskRaw) return;

    const fromCol = findColumnOfTask(active.id);
    if (!fromCol) return;

    // Determine target column
    const overId = String(over.id);
    let toCol = null;
    if (overId.startsWith("col:")) {
      toCol = overId.slice(4);
    } else {
      const overTask = taskById.get(overId);
      if (overTask) toCol = String(overTask.stage || "__Other__");
    }
    if (!toCol) return;

    if (fromCol === toCol) {
      // Reorder within column
      const arr = columns.get(fromCol) || [];
      const oldIdx = arr.findIndex(t => String(t.id) === String(active.id));
      const newIdx = arr.findIndex(t => String(t.id) === overId);
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
      const next = arrayMove(arr, oldIdx, newIdx);
      setColumns(prev => { const m = new Map(prev); m.set(fromCol, next); return m; });
    } else {
      // Move to different stage column
      const fromArr = columns.get(fromCol) || [];
      const toArr = columns.get(toCol) || [];
      const moving = fromArr.find(t => String(t.id) === String(active.id));
      if (!moving) return;
      const nextFrom = fromArr.filter(t => String(t.id) !== String(active.id));
      const movedTask = { ...moving, stage: toCol === "__Other__" ? "" : toCol };
      const nextTo = [...toArr, movedTask];
      setColumns(prev => { const m = new Map(prev); m.set(fromCol, nextFrom); m.set(toCol, nextTo); return m; });
      await persistStageChange(moving.id, toCol === "__Other__" ? "" : toCol);
    }
  }

  // Compute totals
  const totalShown = filteredTasks.length;

  return (
    <div style={{ width: "100%" }}>
      {/* Filters */}
      <div className="dtt-card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontWeight: 1000, fontSize: 15 }}>
            Kanban — Stage View
            <span className="dtt-muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 10 }}>
              {filtersActive ? "Drag disabled while filters active" : "Drag cards to move between stages"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input className="dtt-input" placeholder="Search…" value={kQuery}
              onChange={e => setKQuery(e.target.value)} style={{ width: 220 }} />
            <select className="dtt-select" value={kOwner} onChange={e => setKOwner(e.target.value)} style={{ width: 150 }}>
              {ownerOptions.map(o => <option key={o} value={o}>{o === "All" ? "All Owners" : o}</option>)}
            </select>
            <select className="dtt-select" value={kStatus} onChange={e => setKStatus(e.target.value)} style={{ width: 150 }}>
              {["All", "To Do", "In Progress", "Done"].map(s => <option key={s} value={s}>{s === "All" ? "All Status" : s}</option>)}
            </select>
            <button className="dtt-btn" onClick={() => { setKQuery(""); setKOwner("All"); setKStatus("All"); }}>Clear</button>
            <span className="dtt-pill">{totalShown} tasks</span>
          </div>
        </div>
      </div>

      {/* Board — horizontal scroll for 9 columns */}
      <div style={{ overflowX: "auto", paddingBottom: 12 }}>
        <DndContext
          sensors={filtersActive ? undefined : sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${STAGE_COLUMNS.length}, minmax(220px, 1fr))`,
            gap: 10,
            alignItems: "start",
            minWidth: STAGE_COLUMNS.length * 234,
          }}>
            {STAGE_COLUMNS.map((col, idx) => {
              const colTasks = columns.get(col.key) || [];
              return (
                <KanbanColumn
                  key={col.key}
                  columnKey={col.key}
                  stageNumber={idx + 1}
                  color={col.color}
                  tasks={colTasks}
                  filtersActive={filtersActive}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} overlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function KanbanColumn({ columnKey, stageNumber, color, tasks, filtersActive }) {
  const droppableId = `col:${columnKey}`;

  return (
    <div style={{
      borderRadius: 16,
      border: `1px solid ${color.border}`,
      background: `radial-gradient(400px 160px at 50% 0%, ${color.glow} 0%, transparent 70%), rgba(255,255,255,0.05)`,
      display: "flex", flexDirection: "column", minHeight: 500,
    }}>
      {/* Column header */}
      <div style={{
        padding: "10px 12px",
        borderBottom: `1px solid ${color.border}`,
        background: "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{
              fontSize: 10, fontWeight: 900, padding: "2px 7px", borderRadius: 999,
              background: color.glow, border: `1px solid ${color.border}`, flexShrink: 0,
            }}>{stageNumber}</span>
            <div style={{ fontWeight: 1000, fontSize: 12, lineHeight: "16px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {columnKey}
            </div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 900, padding: "2px 8px", borderRadius: 999,
            border: "1px solid var(--border)", background: "rgba(255,255,255,0.12)", flexShrink: 0,
          }}>{tasks.length}</span>
        </div>
      </div>

      {/* Tasks */}
      <SortableContext items={tasks.map(t => String(t.id))} strategy={verticalListSortingStrategy}>
        <DroppableColumn id={droppableId}>
          <div style={{ padding: 10, display: "grid", gap: 8, flex: 1, overflowY: "auto", maxHeight: 520 }}>
            {tasks.map(t => (
              <SortableTaskCard key={t.id} task={t} disabled={filtersActive} />
            ))}
            {tasks.length === 0 && (
              <div style={{
                border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 12,
                padding: 14, textAlign: "center", color: "var(--muted)", fontSize: 12,
              }}>
                No tasks
              </div>
            )}
          </div>
        </DroppableColumn>
      </SortableContext>
    </div>
  );
}

function DroppableColumn({ id, children }) {
  const { setNodeRef } = useSortable({ id, disabled: true });
  return <div ref={setNodeRef} style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>;
}

function SortableTaskCard({ task, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(task.id), disabled,
  });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, cursor: disabled ? "default" : "grab" }}
      {...attributes} {...listeners}>
      <TaskCard task={task} />
    </div>
  );
}

function TaskCard({ task, overlay = false }) {
  const pri = priorityMeta(task.priority);
  const dot = statusDot(task.status);
  const overdue = isOverdueTask(task);

  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: 13, padding: 10,
      background: overlay ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)",
      boxShadow: overlay ? "0 18px 34px rgba(0,0,0,0.20)" : undefined,
      display: "grid", gap: 7,
    }}>
      {/* Title + status dot */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: dot.color, flexShrink: 0, marginTop: 4 }} title={dot.label} />
        <div style={{ fontWeight: 900, fontSize: 12, lineHeight: "16px", flex: 1, overflow: "hidden" }}>
          {task.taskName || "(No name)"}
        </div>
        {overdue && <span style={{ fontSize: 10, fontWeight: 900, color: "#f87171", flexShrink: 0 }}>Overdue</span>}
      </div>

      {task.description && (
        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: "15px", maxHeight: 30, overflow: "hidden", textOverflow: "ellipsis" }}>
          {task.description}
        </div>
      )}

      {/* Pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {task.owner && <span style={pill}>{task.owner}</span>}
        <span style={{ ...pill, borderColor: pri.border, background: pri.bg }}>{pri.label}</span>
        {task.dueDate && <span style={pill}>{task.dueDate}</span>}
        <span style={{ ...pill, background: "transparent", fontSize: 10 }}>{dot.label}</span>
      </div>
    </div>
  );
}

const pill = {
  padding: "3px 8px", borderRadius: 999, border: "1px solid var(--border)",
  fontWeight: 900, fontSize: 11, background: "rgba(255,255,255,0.08)",
  whiteSpace: "nowrap",
};