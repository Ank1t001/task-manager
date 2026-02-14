// functions/api/_activity.js
export async function logActivity(db, entry) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const {
    projectName = "",
    taskId = "",
    actorEmail = "",
    actorName = "",
    action = "",
    summary = "",
    meta = "",
  } = entry || {};

  await db
    .prepare(
      `INSERT INTO activity_log
       (id, projectName, taskId, actorEmail, actorName, action, summary, meta, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      projectName || "",
      taskId || "",
      actorEmail || "",
      actorName || "",
      action || "",
      summary || "",
      typeof meta === "string" ? meta : JSON.stringify(meta || {}),
      createdAt
    )
    .run();

  return id;
}