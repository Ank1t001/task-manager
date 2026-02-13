import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function statusKey(status = "") {
  return String(status).trim().toLowerCase().replace(/[\s-]+/g, "");
}

function normalizeStatus(status) {
  const s = statusKey(status);
  if (s === "blocked") return "In Progress";
  if (s === "inprogress") return "In Progress";
  if (s === "todo") return "To Do";
  if (s === "done") return "Done";
  return "To Do";
}

const COLUMNS = [
  { key: "To Do", title: "To Do" },
  { key: "In Progress", title: "In Progress" },
  { key: "Done", title: "Done" },
];

function colId(colKey) {
  return `col:${colKey}`;
}

function getColKeyFromDroppableId(id) {
  const s = String(id || "");
  if (s.startsWith("col:")) return s.slice(4);
  return null;
}

function buildColumns(tasks) {
  const cols = { "To Do": [], "In Progress": [], Done: [] };

  for (const t of tasks) {
    const st = normalizeStatus(t.status);
    cols[st].push({ ...t, status: st });
  }

  // Order by sortOrder, then createdAt
  for (const key of Object.keys(cols)) {
    cols[key].sort((a, b) => {
      const ao = Number(a.sortOrder ?? 0);
      const bo = Number(b.sortOrder ?? 0);
      if (ao !== bo) return ao - bo;
      const ac = a.createdAt || "";
      const bc = b.createdAt || "";
      return bc.localeCompare(ac);
    });
  }

  return cols;
}

function priorityMeta(priority) {
  const p = String(priority || "").trim().toLowerCase();
  if (p === "high") return { label: "High", border: "rgba(239,68,68,0.55)", bg: "rgba(239,68,68,0.12)" };
  if (p === "low") return { label: "Low", border: "rgba(34,197,94,0.55)", bg: "rgba(34,197,94,0.12)" };
  return { label: "Medium", border: "rgba(245,158,11,0.55)", bg: "rgba(245,158,11,0.12)" };
}

export default function KanbanBoard({ tasks = [], onUpdateTask, canEditAny, canEditTask }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [activeId, setActiveId] = useState(null);
  const [columns, setColumns] = useState(() => buildColumns(tasks));

  useEffect(() => {
    setColumns(buildColumns(tasks));
  }, [tasks]);

  const taskById = useMemo(() => {
    const m = new Map();
    for (const t of tasks) m.set(String(t.id), t);
    return m;
  }, [tasks]);

  const activeTask = activeId ? taskById.get(String(activeId)) : null;

  function canMove(task) {
    return !!(canEditAny || canEditTask?.(task));
  }

  function findColumnOfTask(taskId) {
    for (const col of COLUMNS) {
      if (columns[col.key].some((t) => String(t.id) === String(taskId))) return col.key;
    }
    return null;
  }

  async function persistReorder(updates) {
    await fetch("/api/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
  }

  function makeSortUpdates(colKey, orderedTasks, overrideStatus = null) {
    return orderedTasks.map((t, i) => ({
      id: t.id,
      status: overrideStatus ?? t.status,
      sortOrder: (i + 1) * 10,
    }));
  }

  function onDragStart(event) {
    setActiveId(event.active?.id ?? null);
  }

  async function onDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);

    if (!active?.id || !over?.id) return;

    const activeTaskRaw = taskById.get(String(active.id));
    if (!activeTaskRaw) return;
    if (!canMove(activeTaskRaw)) return;

    const fromCol = findColumnOfTask(active.id);
    if (!fromCol) return;

    const overCol = getColKeyFromDroppableId(over.id);
    const overTaskRaw = taskById.get(String(over.id));
    const toCol = overCol || (overTaskRaw ? normalizeStatus(overTaskRaw.status) : null);
    if (!toCol) return;

    // reorder within same column
    if (fromCol === toCol) {
      const colArr = columns[fromCol];
      const oldIndex = colArr.findIndex((t) => String(t.id) === String(active.id));
      const newIndex = colArr.findIndex((t) => String(t.id) === String(over.id));
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

      const nextArr = arrayMove(colArr, oldIndex, newIndex);
      setColumns((prev) => ({ ...prev, [fromCol]: nextArr }));

      const updates = makeSortUpdates(fromCol, nextArr);
      await persistReorder(updates);
      return;
    }

    // move across columns
    const fromArr = columns[fromCol];
    const toArr = columns[toCol];

    const moving = fromArr.find((t) => String(t.id) === String(active.id));
    if (!moving) return;

    const nextFrom = fromArr.filter((t) => String(t.id) !== String(active.id));

    let insertIndex = toArr.length;
    if (overTaskRaw) {
      const idx = toArr.findIndex((t) => String(t.id) === String(overTaskRaw.id));
      if (idx >= 0) insertIndex = idx;
    }

    const movedTask = { ...moving, status: toCol };
    const nextTo = [...toArr.slice(0, insertIndex), movedTask, ...toArr.slice(insertIndex)];

    setColumns((prev) => ({ ...prev, [fromCol]: nextFrom, [toCol]: nextTo }));

    const updates = [
      ...makeSortUpdates(fromCol, nextFrom),
      ...makeSortUpdates(toCol, nextTo, toCol),
    ];
    await persistReorder(updates);

    // safe redundancy
    await onUpdateTask?.({ ...activeTaskRaw, status: toCol });
  }

  return (
    <div style={ui.wrap}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div style={ui.grid}>
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.key}
              columnKey={col.key}
              title={col.title}
              tasks={columns[col.key]}
              canMove={canMove}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard task={{ ...activeTask, status: normalizeStatus(activeTask.status) }} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function KanbanColumn({ columnKey, title, tasks, canMove }) {
  const droppableId = colId(columnKey);

  return (
    <div style={ui.col}>
      <div style={ui.colHeader}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div style={ui.colTitle}>{title}</div>
          <span style={ui.count}>{tasks.length}</span>
        </div>
        <div style={ui.colHint}>Drag & drop cards</div>
      </div>

      <SortableContext items={tasks.map((t) => String(t.id))} strategy={verticalListSortingStrategy}>
        <DroppableColumn id={droppableId}>
          <div style={ui.colBody}>
            {tasks.map((t) => (
              <SortableTaskCard key={t.id} task={t} disabled={!canMove(t)} />
            ))}

            {tasks.length === 0 ? (
              <div style={ui.empty}>
                <div style={{ fontWeight: 900 }}>Drop tasks here</div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                  Column is empty
                </div>
              </div>
            ) : null}
          </div>
        </DroppableColumn>
      </SortableContext>
    </div>
  );
}

function DroppableColumn({ id, children }) {
  const { setNodeRef } = useSortable({ id, disabled: true });
  return (
    <div ref={setNodeRef} style={{ minHeight: 420 }}>
      {children}
    </div>
  );
}

function SortableTaskCard({ task, disabled }) {
  const id = String(task.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    cursor: disabled ? "not-allowed" : "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} disabled={disabled} />
    </div>
  );
}

function TaskCard({ task, overlay = false, disabled = false }) {
  const pri = priorityMeta(task.priority);
  const due = task.dueDate ? task.dueDate : "No due date";

  return (
    <div
      style={{
        ...ui.card,
        ...(overlay ? ui.cardOverlay : null),
        ...(disabled ? ui.cardLocked : null),
      }}
    >
      <div style={ui.cardTop}>
        <div style={ui.cardTitle} title={task.taskName || ""}>
          {task.taskName || "(No task name)"}
        </div>
        {disabled ? <span style={ui.lockPill}>Locked</span> : null}
      </div>

      {task.description ? (
        <div style={ui.cardDesc}>{task.description}</div>
      ) : null}

      <div style={ui.pills}>
        <span style={ui.pill}>{task.owner || "—"}</span>
        <span style={ui.pill}>{task.section || "Other"}</span>
        <span style={{ ...ui.pill, borderColor: pri.border, background: pri.bg }}>
          {pri.label}
        </span>
        <span style={ui.pill}>{due}</span>
      </div>
    </div>
  );
}

/** ---------- UI styles (clean, compact, scrollable columns) ---------- */
const ui = {
  wrap: { width: "100%" },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    alignItems: "start",
  },

  col: {
    border: "1px solid var(--border)",
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    boxShadow: "0 14px 26px rgba(15,23,42,0.08)",
    overflow: "hidden",
    minHeight: 640,
    display: "flex",
    flexDirection: "column",
  },

  colHeader: {
    padding: 14,
    borderBottom: "1px solid var(--border)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10))",
  },

  colTitle: { fontSize: 16, fontWeight: 1000 },

  count: {
    fontSize: 12,
    fontWeight: 950,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.18)",
  },

  colHint: { marginTop: 6, fontSize: 12, color: "var(--muted)" },

  colBody: {
    padding: 12,
    display: "grid",
    gap: 10,
    overflowY: "auto",
    maxHeight: 560, // ✅ scroll inside columns
  },

  empty: {
    border: "1px dashed rgba(15,23,42,0.25)",
    borderRadius: 14,
    padding: 18,
    textAlign: "center",
    color: "var(--muted)",
    background: "rgba(255,255,255,0.12)",
  },

  card: {
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 12,
    background: "rgba(255,255,255,0.08)",
  },

  cardOverlay: {
    background: "rgba(255,255,255,0.18)",
    boxShadow: "0 18px 34px rgba(0,0,0,0.16)",
  },

  cardLocked: { opacity: 0.9 },

  cardTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  cardTitle: {
    fontWeight: 1000,
    fontSize: 14,
    lineHeight: "18px",
    maxHeight: 36,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  cardDesc: {
    marginTop: 6,
    color: "var(--muted)",
    fontSize: 12,
    lineHeight: "16px",
    maxHeight: 34,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  pills: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 },

  pill: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    fontWeight: 900,
    fontSize: 12,
    background: "rgba(255,255,255,0.10)",
  },

  lockPill: {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.20)",
    background: "rgba(15,23,42,0.06)",
    fontSize: 12,
    fontWeight: 950,
  },
};