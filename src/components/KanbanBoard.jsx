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
    // 10,20,30... gives us breathing room for future inserts
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

    // 1) Reorder within same column
    if (fromCol === toCol) {
      const colArr = columns[fromCol];

      const oldIndex = colArr.findIndex((t) => String(t.id) === String(active.id));
      const newIndex = colArr.findIndex((t) => String(t.id) === String(over.id));

      // If dropped on the column container (not on a card), do nothing
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

      const nextArr = arrayMove(colArr, oldIndex, newIndex);

      // Update UI immediately
      setColumns((prev) => ({ ...prev, [fromCol]: nextArr }));

      // Persist sortOrder
      const updates = makeSortUpdates(fromCol, nextArr);
      await persistReorder(updates);

      return;
    }

    // 2) Move across columns
    const fromArr = columns[fromCol];
    const toArr = columns[toCol];

    const moving = fromArr.find((t) => String(t.id) === String(active.id));
    if (!moving) return;

    const nextFrom = fromArr.filter((t) => String(t.id) !== String(active.id));

    // insert before hovered card if any, otherwise at end
    let insertIndex = toArr.length;
    if (overTaskRaw) {
      const idx = toArr.findIndex((t) => String(t.id) === String(overTaskRaw.id));
      if (idx >= 0) insertIndex = idx;
    }

    const movedTask = { ...moving, status: toCol };
    const nextTo = [...toArr.slice(0, insertIndex), movedTask, ...toArr.slice(insertIndex)];

    setColumns((prev) => ({
      ...prev,
      [fromCol]: nextFrom,
      [toCol]: nextTo,
    }));

    // Persist both columns
    const updates = [
      ...makeSortUpdates(fromCol, nextFrom),
      ...makeSortUpdates(toCol, nextTo, toCol),
    ];

    await persistReorder(updates);

    // Optional: ensure DB gets status update even if reorder endpoint succeeded (safe redundancy)
    await onUpdateTask?.({ ...activeTaskRaw, status: toCol });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
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
    <div className="dtt-card" style={{ padding: 14, minHeight: 520 }}>
      <div style={{ fontWeight: 950, fontSize: 16, marginBottom: 10 }}>
        {title} <span className="dtt-muted">({tasks.length})</span>
      </div>

      <SortableContext items={tasks.map((t) => String(t.id))} strategy={verticalListSortingStrategy}>
        <DroppableColumn id={droppableId}>
          <div style={{ display: "grid", gap: 10 }}>
            {tasks.map((t) => (
              <SortableTaskCard key={t.id} task={t} disabled={!canMove(t)} />
            ))}

            {tasks.length === 0 ? (
              <div className="dtt-muted" style={{ padding: 10 }}>
                Drop tasks here
              </div>
            ) : null}
          </div>
        </DroppableColumn>
      </SortableContext>
    </div>
  );
}

function DroppableColumn({ id, children }) {
  // lightweight droppable anchor (works even when column is empty)
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
    opacity: isDragging ? 0.4 : 1,
    cursor: disabled ? "not-allowed" : "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} disabled={disabled} />
    </div>
  );
}

function TaskCard({ task, overlay = false, disabled = false }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 12,
        background: overlay ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.03)",
        boxShadow: overlay ? "0 16px 30px rgba(0,0,0,0.18)" : "none",
      }}
    >
      <div style={{ fontWeight: 950, display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task.taskName || "(No task name)"}
        </span>
        {disabled ? <span className="dtt-pill">Locked</span> : null}
      </div>

      {task.description ? (
        <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
          {task.description}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <span className="dtt-pill">{task.owner || "—"}</span>
        <span className="dtt-pill">{task.section || "Other"}</span>
        <span className="dtt-pill">{task.priority || "Medium"}</span>
        <span className="dtt-pill">{task.dueDate || "No due date"}</span>
      </div>
    </div>
  );
}